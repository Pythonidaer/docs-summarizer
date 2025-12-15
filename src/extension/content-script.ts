// src/extension/content-script.ts
import type {
  Message,
  ModelSettings,
  ModelId,
  ReasoningEffort,
  VerbosityLevel,
} from "./types";
import {
  DRAWER_ROOT_ID,
  DRAWER_WIDTH_PX,
  DEFAULT_MODEL_SETTINGS,
} from "./constants";
import { createDrawerShell } from "./ui/shell";
import { createHeader } from "./ui/header";
import { createFooter } from "./ui/footer";
import { createToolbar } from "./ui/toolbar";
import { createMainArea } from "./ui/mainArea";
import { DRAWER_STYLE_CSS, GLOBAL_HIGHLIGHT_STYLE_CSS, LOADING_ANIMATION_CSS, MODAL_ANIMATION_CSS } from "./ui/styles";
import { setPageTextForLinks } from "./pageText";
import { clearAllHighlights, scrollToPageMatch } from "./highlight";
import { showAlert, showModal } from "./ui/modal";
import { deleteApiKey } from "./storage/apiKey";
import type { PromptVoiceId } from "./prompts/voices";
import { wireDrawerEvents } from "./ui/events";
import {
  injectBlurStyles,
  setPageBlur,
  setBlurEnabled,
} from "./ui/focusBlur";
import {
    extractPageStructure,
    serializePageStructureForModel,
} from "./pageStructure";

// Global UI / prompt state
let messages: Message[] = [];
let useCustomInstructions = false;
let customInstructions = "";
let currentPromptVoiceId: PromptVoiceId = "default";
let currentModelSettings: ModelSettings = { ...DEFAULT_MODEL_SETTINGS };

/**
 * Extracts readable page text from the current document.
 * This stays local to the content script since it depends on `document`.
 */
export function extractPageTextFromDoc(doc: Document): string {
  const body = doc.body;
  if (!body) return "";

  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style").forEach((el) => el.remove());

  const raw =
    // innerText in real browsers
    (clone as any).innerText ??
    // fallback for jsdom or older environments
    clone.textContent ??
    "";

  return raw.replace(/\s+/g, " ").trim();
}

// Track resize listener to avoid duplicates
let resizeListener: (() => void) | null = null;
let currentDrawerState: {
  root: HTMLElement;
  drawer: HTMLElement;
  handle: HTMLElement;
  isOpen: boolean;
} | null = null;

/**
 * Updates handle position based on drawer's actual rendered width.
 * This is called both when opening/closing and on window resize.
 * @param isResizeUpdate - If true, temporarily disables transition to prevent animation gap
 */
function updateHandlePosition(
  drawer: HTMLElement,
  handle: HTMLElement,
  isOpen: boolean,
  isResizeUpdate: boolean = false
): void {
  // During resize, temporarily disable transition to prevent animation gap
  const originalTransition = handle.style.transition;
  if (isResizeUpdate) {
    handle.style.transition = "none";
  }

  if (isOpen) {
    // Get the actual rendered width of the drawer (respects maxWidth: 80vw)
    // This ensures the handle aligns correctly even in split-screen mode
    const drawerRect = drawer.getBoundingClientRect();
    const actualDrawerWidth = drawerRect.width;
    // Position handle's right edge at drawer's left edge (no gap)
    handle.style.right = `${actualDrawerWidth}px`;
    handle.style.transform = "translateY(-50%)";
  } else {
    // Closed: handle at viewport edge
    handle.style.right = "0";
    handle.style.transform = "translateY(-50%)";
  }

  // Re-enable transition after a brief moment (allows browser to apply the position change)
  if (isResizeUpdate) {
    // Use requestAnimationFrame to ensure the position is applied before re-enabling transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        handle.style.transition = originalTransition;
      });
    });
  }
}

/**
 * Controls drawer open/close state and handle positioning.
 */
export function setDrawerOpen(
  root: HTMLElement,
  drawer: HTMLElement,
  handle: HTMLElement,
  isOpen: boolean
): void {
  drawer.style.transform = isOpen ? "translateX(0)" : "translateX(100%)";

  // Update handle position (not a resize update, so allow smooth transition)
  updateHandlePosition(drawer, handle, isOpen, false);
  
  // Update arrow SVG direction and tooltip
  // Arrow is already centered via flexbox (handle has display: flex, alignItems: center, justifyContent: center)
  const arrowSvg = handle.querySelector("svg");
  const arrowPath = arrowSvg?.querySelector("path");
  if (arrowSvg && arrowPath) {
    if (isOpen) {
      // Right arrow (drawer is open, arrow points right to close)
      arrowPath.setAttribute("d", "M5 12h14M12 5l7 7-7 7");
      handle.title = "Close Chat Window";
    } else {
      // Left arrow (drawer is closed, arrow points left to open)
      arrowPath.setAttribute("d", "M19 12H5M12 19l-7-7 7-7");
      handle.title = "Open Chat Window";
    }
  }

  if (isOpen) {
    root.classList.add("docs-summarizer--open");
  } else {
    root.classList.remove("docs-summarizer--open");
  }

  // Set up or remove resize listener
  if (isOpen) {
    // Store current state for resize listener
    currentDrawerState = { root, drawer, handle, isOpen };
    
    // Remove old listener if it exists
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
    }
    
    // Add new resize listener
    resizeListener = () => {
      if (currentDrawerState && currentDrawerState.isOpen) {
        // Use requestAnimationFrame to ensure layout has updated
        // Pass isResizeUpdate=true to disable transition and prevent animation gap
        requestAnimationFrame(() => {
          updateHandlePosition(
            currentDrawerState!.drawer,
            currentDrawerState!.handle,
            true,
            true // isResizeUpdate - prevents animation gap
          );
        });
      }
    };
    window.addEventListener("resize", resizeListener);
  } else {
    // Remove resize listener when drawer is closed
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
      resizeListener = null;
    }
    currentDrawerState = null;
  }
}

/**
 * Checks if the page is ready for drawer injection.
 * Returns true if body exists and has meaningful content.
 */
function isPageReadyForInjection(): boolean {
  // Don't inject on detached window page
  try {
    if (typeof window !== "undefined" && window.location) {
      const url = (window.location.href || "").toLowerCase();
      if (url.includes("detached-window.html")) {
        return false;
      }
    }
  } catch (e) {
    // Some environments (like JSDOM) may throw when accessing location.href
    // In that case, continue with other checks
  }

  // Check if drawer already exists
  if (document.getElementById(DRAWER_ROOT_ID)) {
    return false;
  }

  // Check if body exists and has content
  const body = document.body;
  if (!body) {
    return false;
  }

  // Check if body has meaningful content (not just empty or whitespace)
  // Look for elements that indicate real content - be more lenient for SPAs
  const hasContent = 
    body.children.length > 0 || 
    body.textContent?.trim().length > 0 ||
    body.querySelector("main, article, [role='main'], div, section") !== null ||
    // Also check for common SPA patterns
    body.querySelector("[data-reactroot], [data-v-app], #app, #root, [ng-app]") !== null ||
    // Check if body has any non-script/style children
    Array.from(body.children).some(child => 
      !['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(child.tagName)
    );

  return hasContent;
}

/* Main entry: builds the drawer UI and wires events.*/
function createDrawerUI(): void {
  // Check if page is ready
  if (!isPageReadyForInjection()) {
    return;
  }

  // Inject blur CSS once (no blur active until user toggles)
  injectBlurStyles();

  const pageText = extractPageTextFromDoc(document);
  setPageTextForLinks(pageText);

  const structure = extractPageStructure(document);
  const pageStructureSummary = serializePageStructureForModel(
    structure
  );

  // Inject global highlight styles once
  if (!document.getElementById("docs-summarizer-global-styles")) {
    const globalStyle = document.createElement("style");
    globalStyle.id = "docs-summarizer-global-styles";
    globalStyle.textContent = GLOBAL_HIGHLIGHT_STYLE_CSS;
    document.head.appendChild(globalStyle);
  }

  const { root, shadow, handle, drawer, content } =
    createDrawerShell(DRAWER_WIDTH_PX);

  // Scoped styles (Shadow DOM)
  const style = document.createElement("style");
  style.textContent = DRAWER_STYLE_CSS + LOADING_ANIMATION_CSS + MODAL_ANIMATION_CSS;

  // Header
  const { header, closeButton, deleteKeyButton } = createHeader();
  
  // Delete Key button handler
  deleteKeyButton.addEventListener("click", () => {
    showModal({
      title: "Delete API Key",
      message: "Are you sure you want to delete your API key? You will need to provide it again before using the application.",
      type: "alert",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        await deleteApiKey();
        await showAlert("API key deleted successfully. You will be prompted to enter it again when you next use the application.");
      },
      onCancel: () => {
        // User cancelled, do nothing
      },
    });
  });

  // Main content area (messages)
  const { main } = createMainArea(messages);

  // Toolbar (now minimal - controls moved to footer)
  const { toolbar } = createToolbar();

  // Footer: chat input + send button + action buttons + settings
  const {
    footer,
    chatInput,
    sendBtn,
    summarizeBtn,
    clearHighlightsBtn,
    newWindowBtn,
    reasoningSelect,
    voiceSelect,
    maxTokensSelect,
    blurCheckbox,
  } = createFooter();

  // Keep labels as default (empty value shows the label)
  // Users will see "Reasoning", "Voice", "Max Tokens" until they select a value
  // We'll use the actual defaults when syncing, but show labels in UI

  const syncModelSettings = () => {
    // Use selected value, or default to actual defaults if label is still selected
    const reasoningValue = reasoningSelect.value || "low";
    const maxTokensValue = maxTokensSelect.value || String(DEFAULT_MODEL_SETTINGS.maxOutputTokens);
    
    currentModelSettings = {
      model: "gpt-5-nano", // Hard-coded: always use gpt-5-nano
      reasoningEffort: reasoningValue as ReasoningEffort,
      verbosity: "low", // Hard-coded: always use low
      maxOutputTokens: parseInt(maxTokensValue, 10),
    };
  };
  
  // Initialize with defaults (but UI shows labels)
  syncModelSettings();

  // Keep in sync with selects
  reasoningSelect.addEventListener("change", syncModelSettings);
  maxTokensSelect.addEventListener("change", syncModelSettings);

  // Initialize prompt voice from dropdown
  const voiceValue = voiceSelect.value || "default";
  currentPromptVoiceId = voiceValue as PromptVoiceId;
  voiceSelect.addEventListener("change", () => {
    const newValue = voiceSelect.value || "default";
    currentPromptVoiceId = newValue as PromptVoiceId;
  });

  // --- Blur toggle: off by default; independent of drawer open/close ---
  blurCheckbox.checked = false;
  setBlurEnabled(false);
  setPageBlur(false);

  blurCheckbox.addEventListener("change", () => {
    const enabled = blurCheckbox.checked;
    setBlurEnabled(enabled);
    setPageBlur(enabled);
  });

  // Clear highlights button
  clearHighlightsBtn.addEventListener("click", () => {
    clearAllHighlights();
  });

  // New window button (formerly "Detach to Window")
  newWindowBtn.addEventListener("click", () => {
    const state = {
      pageText,
      pageStructureSummary,
      messages: [...messages],
      settings: {
        voice: currentPromptVoiceId,
        model: currentModelSettings.model,
        reasoning: currentModelSettings.reasoningEffort,
        verbosity: currentModelSettings.verbosity,
        useCustomInstructions,
        customInstructions,
      },
      tabId: null, // Will be set by background script
    };

    chrome.runtime.sendMessage(
      {
        type: "OPEN_DETACHED_WINDOW",
        state,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Docs Summarizer] Error opening detached window:",
            chrome.runtime.lastError
          );
          void showAlert(
            `Failed to open detached window: ${chrome.runtime.lastError.message}`,
            "Error"
          );
        } else if (response && response.success !== false) {
          // Successfully opened detached window - close the drawer
          setDrawerOpen(root, drawer, handle, false);
        }
      }
    );
  });

  // Assemble drawer content
  drawer.appendChild(style);
  drawer.appendChild(content);
  content.appendChild(header);
  content.appendChild(toolbar);
  content.appendChild(main);
  content.appendChild(footer);

  shadow.appendChild(handle);
  shadow.appendChild(drawer);
  document.body.appendChild(root);

  // Wire events (open/close, chat send, summarize)
  wireDrawerEvents({
    root,
    drawer,
    handle,
    closeButton,
    chatInput,
    sendBtn,
    summarizeBtn,
    main,
    pageText,
    pageStructureSummary,
    messages,
    setDrawerOpen,
    getUseCustomInstructions: () => useCustomInstructions,
    getCustomInstructions: () => customInstructions,
    getPromptVoiceId: () => currentPromptVoiceId,
    getModelSettings: () => currentModelSettings,
  });
}


// Listen for scroll/highlight requests from detached window
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCROLL_AND_HIGHLIGHT") {
    void scrollToPageMatch(message.phrase);
    sendResponse({ success: true });
  }
  return true;
});

/**
 * Attempts to create the drawer UI with retry logic.
 * Uses exponential backoff and MutationObserver for dynamic content.
 */
function attemptDrawerInjection(): void {
  if (isPageReadyForInjection()) {
    createDrawerUI();
    return;
  }

  // Retry with exponential backoff - more aggressive for SPAs
  let attempt = 0;
  const maxAttempts = 8; // Increased from 5 to 8
  const baseDelay = 50; // Reduced from 100ms to 50ms for faster initial retry

  const retry = () => {
    attempt++;
    
    if (attempt > maxAttempts) {
      console.warn("[Docs Summarizer] Failed to inject drawer after", maxAttempts, "attempts. Body state:", {
        bodyExists: !!document.body,
        bodyChildren: document.body?.children.length || 0,
        bodyTextLength: document.body?.textContent?.trim().length || 0,
        readyState: document.readyState,
      });
      return;
    }

    if (isPageReadyForInjection()) {
      console.log("[Docs Summarizer] Successfully injected drawer on attempt", attempt);
      createDrawerUI();
      return;
    }

    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, 6400ms
    const delay = baseDelay * Math.pow(2, attempt - 1);
    setTimeout(retry, delay);
  };

  // Start first retry after initial delay
  setTimeout(retry, baseDelay);
}

/**
 * Sets up MutationObserver to watch for dynamic content changes.
 * This helps with SPAs that load content asynchronously.
 */
function setupContentWatcher(): void {
  // Only set up if drawer doesn't exist yet
  if (document.getElementById(DRAWER_ROOT_ID)) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // Check if any mutations added meaningful content
    let hasNewContent = false;
    
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            // Check if it's a meaningful element (not script, style, etc.)
            if (
              element.tagName !== "SCRIPT" &&
              element.tagName !== "STYLE" &&
              element.tagName !== "NOSCRIPT" &&
              (element.textContent?.trim().length > 0 || element.children.length > 0)
            ) {
              hasNewContent = true;
              break;
            }
          }
        }
        if (hasNewContent) break;
      }
    }

    if (hasNewContent && isPageReadyForInjection()) {
      createDrawerUI();
      observer.disconnect(); // Stop observing once drawer is created
    }
  });

  // Start observing body for child additions AND removals
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also observe document for body changes (in case body gets replaced)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: false, // Only watch direct children of html
    });

    // Don't disconnect - keep watching for drawer removal
    // This is important for SPAs that might remove/replace the drawer during navigation
  }
}

// Initialize drawer injection
// Use multiple strategies to ensure injection works on SPAs
function initializeDrawerInjection(): void {
  // Wait for body to exist (document_end should have it, but be safe)
  if (!document.body) {
    // If body doesn't exist yet, wait for it
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        bodyObserver.disconnect();
        console.log("[Docs Summarizer] Body now exists, initializing drawer injection. Ready state:", document.readyState);
        attemptDrawerInjection();
        setupContentWatcher();
        setupDrawerWatcher(); // Watch for drawer removal
      }
    });
    
    // Watch document for body creation
    bodyObserver.observe(document.documentElement, {
      childList: true,
    });
    
    // Fallback: try again after a short delay
    setTimeout(() => {
      if (document.body) {
        bodyObserver.disconnect();
        console.log("[Docs Summarizer] Body exists after delay, initializing drawer injection");
        attemptDrawerInjection();
        setupContentWatcher();
        setupDrawerWatcher();
      }
    }, 100);
    
    return;
  }
  
  console.log("[Docs Summarizer] Initializing drawer injection. Ready state:", document.readyState);
  
  attemptDrawerInjection();
  setupContentWatcher();
  setupDrawerWatcher(); // Watch for drawer removal
  
  // Also listen for DOMContentLoaded if page is still loading
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      console.log("[Docs Summarizer] DOMContentLoaded fired, re-attempting injection");
      attemptDrawerInjection();
    });
  }
  
  // Listen for load event as well (for SPAs that finish loading later)
  window.addEventListener("load", () => {
    console.log("[Docs Summarizer] Window load event fired, checking drawer");
    if (!document.getElementById(DRAWER_ROOT_ID)) {
      console.log("[Docs Summarizer] Drawer missing after load, re-injecting");
      attemptDrawerInjection();
    }
  });
}

/**
 * Sets up a MutationObserver specifically to watch for drawer removal.
 * This is critical for Next.js/React SPAs that might remove the drawer during hydration.
 */
function setupDrawerWatcher(): void {
  // Only set up if drawer doesn't exist (to avoid duplicate watchers)
  if (!document.body) {
    return;
  }
  
  // Skip watcher in test environments to avoid async operations after tests complete
  // Detect Jest/test environment by checking for jest globals or test-specific patterns
  const isTestEnvironment = 
    typeof jest !== "undefined" || 
    typeof process !== "undefined" && process.env?.NODE_ENV === "test" ||
    (typeof window !== "undefined" && (window as any).__JEST_ENV__);
  
  if (isTestEnvironment) {
    return; // Skip watcher in tests
  }
  
  let drawerWatcher: MutationObserver | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  
  const checkAndReinject = () => {
    // Only check if we don't already have a drawer
    if (!document.getElementById(DRAWER_ROOT_ID) && document.body) {
      console.log("[Docs Summarizer] Drawer was removed, re-injecting...");
      attemptDrawerInjection();
    }
  };
  
  // Check periodically (but less frequently to avoid performance issues)
  intervalId = setInterval(() => {
    checkAndReinject();
  }, 1000); // Check every 1 second
  
  try {
    drawerWatcher = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check if drawer was removed
          for (const node of Array.from(mutation.removedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.id === DRAWER_ROOT_ID || element.querySelector(`#${DRAWER_ROOT_ID}`)) {
                console.log("[Docs Summarizer] Drawer removed via MutationObserver, re-injecting");
                if (intervalId) clearInterval(intervalId);
                attemptDrawerInjection();
                return;
              }
            }
          }
        }
      }
    });
    
    if (document.body) {
      drawerWatcher.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  } catch (e) {
    // If MutationObserver fails (e.g., in some test environments), just use interval
    console.warn("[Docs Summarizer] MutationObserver setup failed, using interval only:", e);
  }
  
  // Clean up after 60 seconds (to avoid memory leaks, but give enough time for SPAs)
  setTimeout(() => {
    if (intervalId) clearInterval(intervalId);
    drawerWatcher?.disconnect();
  }, 60000);
}

// Start initialization
// In browser environment, this will run automatically
if (typeof window !== "undefined") {
  // Use requestAnimationFrame or setTimeout to ensure DOM is ready
  if (document.body || document.readyState === "complete" || document.readyState === "interactive") {
    initializeDrawerInjection();
  } else {
    // Wait for body to be available
    const initWhenReady = () => {
      if (document.body) {
        initializeDrawerInjection();
      } else {
        setTimeout(initWhenReady, 10);
      }
    };
    initWhenReady();
  }
}

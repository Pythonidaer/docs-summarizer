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
import { DRAWER_STYLE_CSS, GLOBAL_HIGHLIGHT_STYLE_CSS } from "./ui/styles";
import { setPageTextForLinks } from "./pageText";
import { clearAllHighlights, scrollToPageMatch } from "./highlight";
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
  
  // Update arrow SVG direction and tooltip
  const arrowSvg = handle.querySelector("svg");
  const arrowPath = arrowSvg?.querySelector("path");
  if (arrowPath) {
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
}

/* Main entry: builds the drawer UI and wires events.*/
function createDrawerUI(): void {
  // Don't inject drawer on the detached window page itself (prevents recursive injection)
  if (typeof window !== "undefined" && window.location) {
    const url = window.location.href.toLowerCase();
    if (url.includes("detached-window.html")) {
      console.log("[Docs Summarizer] Skipping drawer injection on detached window page");
      return;
    }
  }

  // Avoid creating multiple drawers if script runs twice
  if (document.getElementById(DRAWER_ROOT_ID)) return;

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
  style.textContent = DRAWER_STYLE_CSS;

  // Header
  const { header, closeButton } = createHeader();

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
          alert(
            `Failed to open detached window: ${chrome.runtime.lastError.message}`
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
    scrollToPageMatch(message.phrase);
    sendResponse({ success: true });
  }
  return true;
});

// Run when content script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createDrawerUI);
} else {
  createDrawerUI();
}

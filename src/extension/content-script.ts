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
import {
  createInstructionsPanel,
  wireInstructionsToggle,
} from "./ui/instructionsPanel";
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
    handle.style.right = `${actualDrawerWidth}px`;
  } else {
    // Closed: handle at viewport edge
    handle.style.right = "0";
  }
  
  handle.textContent = isOpen ? ">" : "<";

  if (isOpen) {
    root.classList.add("docs-summarizer--open");
  } else {
    root.classList.remove("docs-summarizer--open");
  }
}

/* Main entry: builds the drawer UI and wires events.*/
function createDrawerUI(): void {
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

  // Custom instructions panel
  const {
    container: instructionsContainer,
    textarea: instructionsTextarea,
  } = createInstructionsPanel((value: string) => {
    if (useCustomInstructions) {
      customInstructions = value;
    }
  });

  // Main content area (messages)
  const { main } = createMainArea(messages);

  // Toolbar (instructions toggle, voice select, summarize / clear buttons, blur toggle)
  const {
    toolbar,
    instructionsCheckbox,
    voiceSelect,
    reasoningSelect,
    summarizeBtn,
    clearHighlightsBtn,
    detachBtn,
    blurCheckbox,
  } = createToolbar();

  const syncModelSettings = () => {
    currentModelSettings = {
      model: "gpt-5-nano", // Hard-coded: always use gpt-5-nano
      reasoningEffort: reasoningSelect.value as ReasoningEffort,
      verbosity: "low", // Hard-coded: always use low
    };
  };

  // Initialize from defaults and keep in sync with reasoning select
  syncModelSettings();
  reasoningSelect.addEventListener("change", syncModelSettings);

  // Initialize prompt voice from dropdown
  currentPromptVoiceId = voiceSelect.value as PromptVoiceId;
  voiceSelect.addEventListener("change", () => {
    currentPromptVoiceId = voiceSelect.value as PromptVoiceId;
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

  // Wire custom instructions checkbox -> panel show/hide + seeding
  wireInstructionsToggle({
    checkbox: instructionsCheckbox,
    container: instructionsContainer,
    textarea: instructionsTextarea,
    getUseCustomInstructions: () => useCustomInstructions,
    setUseCustomInstructions: (value: boolean) => {
      useCustomInstructions = value;
    },
    setCustomInstructions: (value: string) => {
      customInstructions = value;
    },
  });

  // Clear highlights button
  clearHighlightsBtn.addEventListener("click", () => {
    clearAllHighlights();
  });

  // Detach to window button
  detachBtn.addEventListener("click", () => {
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
        }
      }
    );
  });

  // Footer: chat input + send button
  const { footer, chatInput, sendBtn } = createFooter();

  // Assemble drawer content
  drawer.appendChild(style);
  drawer.appendChild(content);
  content.appendChild(header);
  content.appendChild(toolbar);
  content.appendChild(instructionsContainer);
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

// src/extension/detached-window.ts
// Script for the detached window - loads state and initializes UI

import type { Message, ModelSettings } from "./types";
import { createHeader } from "./ui/header";
import { createFooter } from "./ui/footer";
import { createToolbar } from "./ui/toolbar";
import { createMainArea } from "./ui/mainArea";
import { DRAWER_STYLE_CSS } from "./ui/styles";
import { setPageTextForLinks } from "./pageText";
import type { PromptVoiceId } from "./prompts/voices";
import { wireDrawerEvents } from "./ui/events";
import { chatWithOpenAI, summarizeWithOpenAI } from "./openai";
import { renderMessages } from "./ui/messages";
import { DEFAULT_MODEL_SETTINGS } from "./constants";

// Global state
let messages: Message[] = [];
let useCustomInstructions = false;
let customInstructions = "";
let currentPromptVoiceId: PromptVoiceId = "default";
let currentModelSettings: ModelSettings = { ...DEFAULT_MODEL_SETTINGS };
let pageText = "";
let pageStructureSummary = "";
let originalTabId: number | null = null; // Preserve the original tabId from state
let originalPageUrl: string | null = null; // Store the original page URL for fallback lookup

// Load state from background script
chrome.runtime.sendMessage(
  { type: "GET_DETACHED_WINDOW_STATE" },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "[Docs Summarizer] Error loading state:",
        chrome.runtime.lastError
      );
      return;
    }

    const state = response?.state;
    if (!state) {
      console.error("[Docs Summarizer] No state found");
      return;
    }

    // Restore state
    pageText = state.pageText || "";
    pageStructureSummary = state.pageStructureSummary || "";
    messages = state.messages || [];
    useCustomInstructions = state.settings?.useCustomInstructions || false;
    customInstructions = state.settings?.customInstructions || "";
    currentPromptVoiceId = state.settings?.voice || "default";
    currentModelSettings = {
      model: state.settings?.model || "gpt-5-nano",
      reasoningEffort: state.settings?.reasoning || "low",
      verbosity: state.settings?.verbosity || "low",
      maxOutputTokens: state.settings?.maxOutputTokens || 8000,
    };

    // Preserve the original tabId and pageUrl from state (important for scroll links)
    originalTabId = state.tabId || null;
    originalPageUrl = state.pageUrl || null;

    setPageTextForLinks(pageText);
    initializeUI();
  }
);

function initializeUI(): void {
  const app = document.getElementById("app");
  if (!app) {
    console.error("[Docs Summarizer] App container not found");
    return;
  }

  // Inject styles
  const style = document.createElement("style");
  style.textContent = DRAWER_STYLE_CSS;
  document.head.appendChild(style);

  // Create container (similar to drawer content but without shadow DOM)
  const container = document.createElement("div");
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    padding: "12px",
    boxSizing: "border-box",
    overflow: "hidden",
    fontFamily:
      "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontSize: "14px",
  } as CSSStyleDeclaration);

  // Header
  const { header, closeButton } = createHeader();
  closeButton.addEventListener("click", () => {
    window.close();
  });

  // Main content area (messages)
  const { main } = createMainArea(messages);

  // Toolbar
  const {
    toolbar,
    voiceSelect,
    reasoningSelect,
    maxTokensSelect,
    summarizeBtn,
    clearHighlightsBtn,
    detachBtn,
    blurCheckbox,
  } = createToolbar();

  // Hide detach button and blur checkbox in detached window
  detachBtn.style.display = "none";
  blurCheckbox.parentElement!.style.display = "none";

  // Set default value for max tokens dropdown (use restored state or default)
  maxTokensSelect.value = String(currentModelSettings.maxOutputTokens);

  const syncModelSettings = () => {
    currentModelSettings = {
      model: "gpt-5-nano",
      reasoningEffort: reasoningSelect.value as any,
      verbosity: "low",
      maxOutputTokens: parseInt(maxTokensSelect.value, 10),
    };
    updateState();
  };

  syncModelSettings();
  reasoningSelect.addEventListener("change", syncModelSettings);
  maxTokensSelect.addEventListener("change", syncModelSettings);

  currentPromptVoiceId = voiceSelect.value as PromptVoiceId;
  voiceSelect.addEventListener("change", () => {
    currentPromptVoiceId = voiceSelect.value as PromptVoiceId;
    updateState();
  });

  // Clear highlights button (disabled in detached window, but show message)
  clearHighlightsBtn.addEventListener("click", () => {
    alert(
      "Clear highlights is only available in the main window. Please use the main window to clear highlights."
    );
  });

  // Footer: chat input + send button
  const { footer, chatInput, sendBtn } = createFooter();

  // Assemble UI
  container.appendChild(style);
  container.appendChild(header);
  container.appendChild(toolbar);
  container.appendChild(main);
  container.appendChild(footer);
  app.appendChild(container);

  // Wire events
  wireDrawerEvents({
    root: container as any,
    drawer: container as any,
    handle: container as any,
    closeButton,
    chatInput,
    sendBtn,
    summarizeBtn,
    main,
    pageText,
    pageStructureSummary,
    messages,
    setDrawerOpen: () => {}, // No-op in detached window
    getUseCustomInstructions: () => useCustomInstructions,
    getCustomInstructions: () => customInstructions,
    getPromptVoiceId: () => currentPromptVoiceId,
    getModelSettings: () => currentModelSettings,
  });

  // Render existing messages
  if (messages.length > 0) {
    renderMessages(main, messages);
  }
}

function updateState(): void {
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
    tabId: originalTabId, // Preserve the original tabId
    pageUrl: originalPageUrl, // Preserve the original pageUrl for fallback lookup
  };

  chrome.runtime.sendMessage(
    {
      type: "UPDATE_DETACHED_WINDOW_STATE",
      state,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Docs Summarizer] Error updating state:",
          chrome.runtime.lastError
        );
      }
    }
  );
}


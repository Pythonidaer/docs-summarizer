// src/extension/detached-window.ts
// Script for the detached window - loads state and initializes UI

import type { Message, ModelSettings } from "./types";
import { createHeader } from "./ui/header";
import { createFooter } from "./ui/footer";
import { createToolbar } from "./ui/toolbar";
import { createMainArea } from "./ui/mainArea";
import { DRAWER_STYLE_CSS, LOADING_ANIMATION_CSS, MODAL_ANIMATION_CSS } from "./ui/styles";
import { setPageTextForLinks } from "./pageText";
import type { PromptVoiceId } from "./prompts/voices";
import { wireDrawerEvents } from "./ui/events";
import { chatWithOpenAI, summarizeWithOpenAI } from "./openai";
import { renderMessages } from "./ui/messages";
import { DEFAULT_MODEL_SETTINGS } from "./constants";
import { showAlert, showModal } from "./ui/modal";
import { deleteApiKey } from "./storage/apiKey";

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
  style.textContent = DRAWER_STYLE_CSS + LOADING_ANIMATION_CSS + MODAL_ANIMATION_CSS;
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
  const { header, closeButton, deleteKeyButton } = createHeader();
  closeButton.addEventListener("click", () => {
    window.close();
  });
  
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

  // Hide new window button in detached window (can't detach from detached window)
  newWindowBtn.style.display = "none";

  // Hide clear highlights button in detached window (doesn't work in detached window)
  clearHighlightsBtn.style.display = "none";

  // Hide blur checkbox in detached window
  if (blurCheckbox.parentElement) {
    blurCheckbox.parentElement.style.display = "none";
  }

  // Set actual values from restored state (not labels)
  if (maxTokensSelect.options.length > 1) {
    const tokenOption = maxTokensSelect.querySelector(`option[value="${currentModelSettings.maxOutputTokens}"]`);
    if (tokenOption) {
      maxTokensSelect.value = String(currentModelSettings.maxOutputTokens);
    }
  }
  if (reasoningSelect.options.length > 1) {
    const reasoningOption = reasoningSelect.querySelector(`option[value="${currentModelSettings.reasoningEffort}"]`);
    if (reasoningOption) {
      reasoningSelect.value = currentModelSettings.reasoningEffort;
    }
  }
  if (voiceSelect.options.length > 1) {
    const voiceOption = voiceSelect.querySelector(`option[value="${currentPromptVoiceId}"]`);
    if (voiceOption) {
      voiceSelect.value = currentPromptVoiceId;
    }
  }

  const syncModelSettings = () => {
    // Skip empty value (label option)
    const reasoningValue = reasoningSelect.value || currentModelSettings.reasoningEffort;
    const maxTokensValue = maxTokensSelect.value || String(currentModelSettings.maxOutputTokens);
    
    currentModelSettings = {
      model: "gpt-5-nano",
      reasoningEffort: reasoningValue as any,
      verbosity: "low",
      maxOutputTokens: parseInt(maxTokensValue, 10),
    };
    updateState();
  };

  syncModelSettings();
  reasoningSelect.addEventListener("change", syncModelSettings);
  maxTokensSelect.addEventListener("change", syncModelSettings);

  const voiceValue = voiceSelect.value || currentPromptVoiceId;
  currentPromptVoiceId = voiceValue as PromptVoiceId;
  voiceSelect.addEventListener("change", () => {
    const newValue = voiceSelect.value || currentPromptVoiceId;
    currentPromptVoiceId = newValue as PromptVoiceId;
    updateState();
  });

  // Clear highlights button is hidden in detached window (see above)
  // No event listener needed since button is hidden

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


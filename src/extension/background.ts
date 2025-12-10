// src/extension/background.ts
// Service worker for managing detached window and message passing

interface DetachedWindowState {
  pageText: string;
  pageStructureSummary: string;
  messages: any[];
  settings: {
    voice: string;
    model: string;
    reasoning: string;
    verbosity: string;
    useCustomInstructions: boolean;
    customInstructions: string;
  };
  tabId: number | null;
}

let detachedWindowState: DetachedWindowState | null = null;
let sourceTabId: number | null = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DETACHED_WINDOW') {
    const state = message.state as DetachedWindowState;
    detachedWindowState = {
      ...state,
      tabId: sender.tab?.id || null,
    };
    sourceTabId = sender.tab?.id || null;

    // Open detached window
    chrome.windows.create(
      {
        url: chrome.runtime.getURL('detached-window.html'),
        type: 'popup',
        width: 800,
        height: 900,
        focused: true,
      },
      (window) => {
        if (window?.id) {
          // Store window ID for later communication
          chrome.storage.local.set({ detachedWindowId: window.id });
        }
        sendResponse({ success: true });
      }
    );
    return true; // Keep channel open for async response
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_DETACHED_WINDOW_STATE') {
    sendResponse({ state: detachedWindowState });
    return true;
  }

  if (message.type === 'SCROLL_TO_PHRASE') {
    // Forward scroll request to content script on the source tab
    if (sourceTabId !== null) {
      chrome.tabs.sendMessage(
        sourceTabId,
        {
          type: 'SCROLL_AND_HIGHLIGHT',
          phrase: message.phrase,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              '[Docs Summarizer] Error sending scroll message:',
              chrome.runtime.lastError
            );
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response || { success: true });
          }
        }
      );
    } else {
      sendResponse({ success: false, error: 'Source tab not found' });
    }
    return true;
  }

  if (message.type === 'UPDATE_DETACHED_WINDOW_STATE') {
    detachedWindowState = message.state;
    sendResponse({ success: true });
    return true;
  }
});

// Clean up when detached window closes
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get(['detachedWindowId'], (result) => {
    if (result.detachedWindowId === windowId) {
      detachedWindowState = null;
      sourceTabId = null;
      chrome.storage.local.remove(['detachedWindowId']);
    }
  });
});


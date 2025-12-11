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
  pageUrl: string | null; // Store URL for fallback tab lookup
}

let detachedWindowState: DetachedWindowState | null = null;
let sourceTabId: number | null = null;

// Persist state to storage so it survives service worker restarts
const persistState = () => {
  if (detachedWindowState) {
    chrome.storage.local.set({ 
      detachedWindowState: detachedWindowState,
      sourceTabId: sourceTabId 
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Docs Summarizer] Failed to persist state:', chrome.runtime.lastError);
      }
    });
  }
};

// Restore state from storage on service worker startup
chrome.storage.local.get(['detachedWindowState', 'sourceTabId'], (result) => {
  if (result.detachedWindowState && typeof result.detachedWindowState === 'object') {
    detachedWindowState = result.detachedWindowState as DetachedWindowState;
    console.log('[Docs Summarizer] Restored detachedWindowState from storage');
  }
  if (result.sourceTabId !== undefined && typeof result.sourceTabId === 'number') {
    sourceTabId = result.sourceTabId;
    console.log('[Docs Summarizer] Restored sourceTabId from storage:', sourceTabId);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DETACHED_WINDOW') {
    const state = message.state as DetachedWindowState;
    detachedWindowState = {
      ...state,
      tabId: sender.tab?.id || null,
      pageUrl: sender.tab?.url || null,
    };
    sourceTabId = sender.tab?.id || null;
    persistState(); // Persist immediately

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
    // Restore sourceTabId from state if lost (service worker restart)
    if (sourceTabId === null && detachedWindowState !== null && detachedWindowState.tabId !== null) {
      sourceTabId = detachedWindowState.tabId;
      console.log('[Docs Summarizer] Restored sourceTabId on GET_STATE:', sourceTabId);
    }
    sendResponse({ state: detachedWindowState });
    return true;
  }

  if (message.type === 'SCROLL_TO_PHRASE') {
    // CRITICAL: Return true immediately to keep channel open for async response
    // This prevents Chrome from timing out the message handler
    
    // Try to restore sourceTabId from in-memory state first
    if (sourceTabId === null && detachedWindowState !== null && detachedWindowState.tabId !== null) {
      sourceTabId = detachedWindowState.tabId;
      console.log('[Docs Summarizer] Restored sourceTabId from in-memory state for scroll:', sourceTabId);
    }
    
    // If still null, try synchronous storage lookup (handles race condition)
    if (sourceTabId === null) {
      // This is a synchronous check - if storage hasn't loaded yet, we'll try async below
      chrome.storage.local.get(['sourceTabId', 'detachedWindowState'], (result) => {
        if (result.sourceTabId !== undefined && typeof result.sourceTabId === 'number') {
          sourceTabId = result.sourceTabId;
          console.log('[Docs Summarizer] Restored sourceTabId from storage (sync check):', sourceTabId);
          // Continue with the scroll request using the restored tabId
          handleScrollRequest(message.phrase, sendResponse);
        } else if (result.detachedWindowState && typeof result.detachedWindowState === 'object') {
          const state = result.detachedWindowState as DetachedWindowState;
          if (state.tabId) {
            sourceTabId = state.tabId;
            if (!detachedWindowState) {
              detachedWindowState = state;
            }
            console.log('[Docs Summarizer] Restored sourceTabId from detachedWindowState in storage:', sourceTabId);
            handleScrollRequest(message.phrase, sendResponse);
          } else {
            console.error('[Docs Summarizer] No tabId in detachedWindowState from storage');
            sendResponse({ 
              success: false, 
              error: 'Connection lost. The connection may restore automatically—please try clicking the link again in a moment. If it still fails, refresh the main page and detach the window again.' 
            });
          }
        } else {
          // No state found in storage either
          console.error('[Docs Summarizer] No sourceTabId found in storage - connection lost');
          sendResponse({ 
            success: false, 
            error: 'Connection lost. The connection may restore automatically—please try clicking the link again in a moment. If it still fails, refresh the main page and detach the window again.' 
          });
        }
      });
      return true; // Keep channel open for async storage lookup
    }
    
    // If we have sourceTabId, proceed with scroll request
    handleScrollRequest(message.phrase, sendResponse);
    return true;
  }
  
  // Helper function to handle the actual scroll request
  function handleScrollRequest(phrase: string, sendResponse: (response: any) => void): void {
    // If we have no state at all, fail with helpful message
    if (sourceTabId === null && (!detachedWindowState || !detachedWindowState.pageUrl)) {
      console.error('[Docs Summarizer] No sourceTabId and no pageUrl in state - state may have been lost');
      sendResponse({ 
        success: false, 
        error: 'Connection lost. The connection may restore automatically—please try clicking the link again in a moment. If it still fails, refresh the main page and detach the window again.' 
      });
      return;
    }
    
    // Helper function to try sending message to a tab
    const trySendToTab = (tabId: number, onError: (error: string) => void) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          const errorMsg = chrome.runtime.lastError?.message || 'Tab not found';
          console.error('[Docs Summarizer] Tab lookup failed:', errorMsg, 'tabId:', tabId);
          onError(errorMsg);
          return;
        }

        console.log('[Docs Summarizer] Attempting to send scroll message to tab:', tabId, 'URL:', tab.url);
        
        chrome.tabs.sendMessage(
          tabId,
          {
            type: 'SCROLL_AND_HIGHLIGHT',
            phrase: phrase,
          },
          (response: any) => {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
              console.error(
                '[Docs Summarizer] Error sending scroll message to tab',
                tabId,
                ':',
                errorMsg,
                'Full error:',
                chrome.runtime.lastError
              );
              
              // If error is "Could not establish connection", content script might not be loaded
              if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist')) {
                console.warn('[Docs Summarizer] Content script may not be loaded on tab, attempting to inject...');
                // Try to inject the content script
                chrome.scripting.executeScript(
                  {
                    target: { tabId: tabId },
                    files: ['dist/extension/content-script.js'],
                  },
                  () => {
                    if (chrome.runtime.lastError) {
                      console.error('[Docs Summarizer] Failed to inject content script:', chrome.runtime.lastError);
                      onError(`Content script not available: ${errorMsg}`);
                    } else {
                      console.log('[Docs Summarizer] Content script injected, retrying message...');
                      // Retry after a short delay to let the script initialize
                      setTimeout(() => {
                        chrome.tabs.sendMessage(
                          tabId,
                          {
                            type: 'SCROLL_AND_HIGHLIGHT',
                            phrase: phrase,
                          },
                          (retryResponse: any) => {
                            if (chrome.runtime.lastError) {
                              onError(chrome.runtime.lastError.message || 'Failed after injection');
                            } else {
                              sendResponse(retryResponse || { success: true });
                            }
                          }
                        );
                      }, 100);
                    }
                  }
                );
              } else {
                onError(errorMsg);
              }
            } else {
              console.log('[Docs Summarizer] Successfully sent scroll message, response:', response);
              sendResponse(response || { success: true });
            }
          }
        );
      });
    };

    // Helper to find tab by URL (flexible matching)
    const findTabByUrl = (targetUrl: string, callback: (tabId: number | null) => void) => {
      // Try exact match first
      chrome.tabs.query({ url: targetUrl }, (tabs) => {
        if (tabs.length > 0 && tabs[0]?.id) {
          console.log('[Docs Summarizer] Found tab by exact URL match:', tabs[0].id);
          callback(tabs[0].id);
          return;
        }
        
        // Fallback: query all tabs and match by URL (more flexible)
        chrome.tabs.query({}, (allTabs) => {
          // Parse the target URL to get base URL (without hash/query)
          try {
            const targetUrlObj = new URL(targetUrl);
            const targetBase = `${targetUrlObj.protocol}//${targetUrlObj.host}${targetUrlObj.pathname}`;
            
            for (const tab of allTabs) {
              if (tab.url && tab.id) {
                try {
                  const tabUrlObj = new URL(tab.url);
                  const tabBase = `${tabUrlObj.protocol}//${tabUrlObj.host}${tabUrlObj.pathname}`;
                  
                  // Match if base URLs are the same (ignoring query params and hash)
                  if (tabBase === targetBase) {
                    console.log('[Docs Summarizer] Found tab by base URL match:', tab.id, tab.url);
                    callback(tab.id);
                    return;
                  }
                } catch (e) {
                  // Skip invalid URLs
                  continue;
                }
              }
            }
          } catch (e) {
            console.warn('[Docs Summarizer] Error parsing URL for matching:', e);
          }
          
          // No match found
          console.warn('[Docs Summarizer] No tab found matching URL:', targetUrl);
          callback(null);
        });
      });
    };

    // Try using stored tabId first
    if (sourceTabId !== null) {
      trySendToTab(sourceTabId, (error) => {
        console.warn('[Docs Summarizer] Failed to use stored tabId, trying URL lookup:', error);
        
        // Fallback: try to find tab by URL
        if (detachedWindowState?.pageUrl) {
          findTabByUrl(detachedWindowState.pageUrl, (foundTabId) => {
            if (foundTabId !== null) {
              console.log('[Docs Summarizer] Found tab by URL, updating sourceTabId:', foundTabId);
              sourceTabId = foundTabId;
              if (detachedWindowState) {
                detachedWindowState.tabId = foundTabId;
                persistState(); // Persist updated tabId
              }
              
              trySendToTab(foundTabId, (fallbackError) => {
                sendResponse({ 
                  success: false, 
                  error: `Source tab not found: ${fallbackError}. Please refresh the main page and detach again.` 
                });
              });
            } else {
              sendResponse({ 
                success: false, 
                error: 'Source tab not found. Please refresh the main page and detach again.' 
              });
            }
          });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Source tab not found. Please refresh the main page and detach again.' 
          });
        }
      });
    } else {
      // No tabId at all - try URL lookup
      if (detachedWindowState?.pageUrl) {
        findTabByUrl(detachedWindowState.pageUrl, (foundTabId) => {
          if (foundTabId !== null) {
            console.log('[Docs Summarizer] Found tab by URL (no stored tabId):', foundTabId);
            sourceTabId = foundTabId;
            if (detachedWindowState) {
              detachedWindowState.tabId = foundTabId;
            }
            
            trySendToTab(foundTabId, (error) => {
              sendResponse({ 
                success: false, 
                error: `Source tab not found: ${error}. Please refresh the main page and detach again.` 
              });
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'Source tab not found. Please refresh the main page and detach again.' 
            });
          }
        });
      } else {
        sendResponse({ 
          success: false, 
          error: 'Source tab not found. Please refresh the main page and detach again.' 
        });
      }
    }
  }

  if (message.type === 'UPDATE_DETACHED_WINDOW_STATE') {
    detachedWindowState = message.state;
    // Always sync sourceTabId with state's tabId (not just when null)
    // This ensures they stay in sync even after service worker restarts
    if (detachedWindowState !== null && detachedWindowState.tabId !== null) {
      const previousTabId = sourceTabId;
      sourceTabId = detachedWindowState.tabId;
      if (previousTabId !== sourceTabId) {
        console.log('[Docs Summarizer] Synced sourceTabId from state:', sourceTabId);
      }
    } else if (detachedWindowState !== null && detachedWindowState.tabId === null && sourceTabId !== null) {
      // Preserve existing sourceTabId if state doesn't have one (shouldn't happen, but safety check)
      detachedWindowState.tabId = sourceTabId;
      console.log('[Docs Summarizer] Preserved sourceTabId in state:', sourceTabId);
    }
    persistState(); // Persist updated state
    sendResponse({ success: true });
    return true;
  }
});

// Clean up when detached window closes
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get(['detachedWindowId'], (result) => {
    if (result.detachedWindowId === windowId) {
      if (detachedWindowState !== null) {
        detachedWindowState = null;
      }
      sourceTabId = null;
      chrome.storage.local.remove(['detachedWindowId', 'detachedWindowState', 'sourceTabId']);
    }
  });
});


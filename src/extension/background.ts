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

interface OpenAIRequestPayload {
  input: string;
  instructions: string;
  modelSettings: {
    model: string;
    reasoningEffort: string;
    verbosity: string;
    maxOutputTokens: number;
  };
  mode: "summary" | "chat";
  history?: any[]; // Optional history for error logging
}

interface OpenAIResponse {
  text: string;
  responseTime: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  } | null;
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
  }
  if (result.sourceTabId !== undefined && typeof result.sourceTabId === 'number') {
    sourceTabId = result.sourceTabId;
  }
});

// Listen for extension icon click - inject content script only when user clicks
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    console.error('[Docs Summarizer] No tab ID available for injection');
    return;
  }

  // Inject content script only when user clicks extension icon
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['dist/extension/content-script.js']
  }).catch((error) => {
    console.error('[Docs Summarizer] Failed to inject content script:', error);
  });
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
    }
    
    // If still null, try synchronous storage lookup (handles race condition)
    if (sourceTabId === null) {
      // This is a synchronous check - if storage hasn't loaded yet, we'll try async below
      chrome.storage.local.get(['sourceTabId', 'detachedWindowState'], (result) => {
        if (result.sourceTabId !== undefined && typeof result.sourceTabId === 'number') {
          sourceTabId = result.sourceTabId;
          // Continue with the scroll request using the restored tabId
          handleScrollRequest(message.phrase, sendResponse);
        } else if (result.detachedWindowState && typeof result.detachedWindowState === 'object') {
          const state = result.detachedWindowState as DetachedWindowState;
          if (state.tabId) {
            sourceTabId = state.tabId;
            if (!detachedWindowState) {
              detachedWindowState = state;
            }
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
            // Error parsing URL, continue
          }
          
          // No match found
          callback(null);
        });
      });
    };

    // Try using stored tabId first
    if (sourceTabId !== null) {
      trySendToTab(sourceTabId, (error) => {
        // Fallback: try to find tab by URL
        if (detachedWindowState?.pageUrl) {
          findTabByUrl(detachedWindowState.pageUrl, (foundTabId) => {
            if (foundTabId !== null) {
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
      // Synced sourceTabId from state
    } else if (detachedWindowState !== null && detachedWindowState.tabId === null && sourceTabId !== null) {
      // Preserve existing sourceTabId if state doesn't have one (shouldn't happen, but safety check)
      detachedWindowState.tabId = sourceTabId;
    }
    persistState(); // Persist updated state
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CHECK_BOOKMARKS_PERMISSION') {
    chrome.permissions.contains({ permissions: ["bookmarks"] }, (result) => {
      sendResponse({ hasPermission: result === true });
    });
    return true;
  }

  if (message.type === 'REQUEST_BOOKMARKS_PERMISSION') {
    // Check current permission status first
    chrome.permissions.contains({ permissions: ["bookmarks"] }, (hasPermission) => {
      if (hasPermission) {
        sendResponse({ granted: true });
        return;
      }
      
      // Request the permission
      chrome.permissions.request({ permissions: ["bookmarks"] }, (granted) => {
        if (chrome.runtime.lastError) {
          console.error('[Docs Summarizer] Permission request error:', chrome.runtime.lastError);
          sendResponse({ 
            granted: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          // Verify it was actually granted
          chrome.permissions.contains({ permissions: ["bookmarks"] }, (nowHasPermission) => {
            sendResponse({ granted: nowHasPermission === true });
          });
        }
      });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_ALL_BOOKMARKS') {
    if (!chrome.bookmarks) {
      sendResponse({ error: 'Bookmarks API not available' });
      return true;
    }
    
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ bookmarks: tree });
      }
    });
    return true;
  }

  if (message.type === 'OPENAI_REQUEST') {
    // CRITICAL: Return true immediately to keep channel open for async response
    handleOpenAIRequest(message.payload as OpenAIRequestPayload, sendResponse);
    return true;
  }
});

// ========== OpenAI API Handler (runs in background/service worker) ==========
//
// SECURITY NOTES:
// - API key is ONLY accessed in this background script
// - API key is NEVER logged, sent in messages, or exposed to content scripts
// - Response/request objects are NEVER logged directly (they contain headers)
// - All logging uses sanitizeForLogging() to prevent accidental exposure
// - Error logging uses safeLogError() to prevent sensitive data leaks

// Pricing constants (must match constants.ts)
const GPT5_NANO_PRICING = {
  input: 0.05, // $0.05 per 1M input tokens
  output: 0.40, // $0.40 per 1M output tokens
};

/**
 * Sanitizes an object for safe logging by removing sensitive fields.
 * NEVER logs API keys, authorization headers, or other sensitive data.
 */
function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item));
  }

  const sanitized: any = {};
  const sensitiveKeys = [
    'apiKey',
    'api_key',
    'openaiApiKey',
    'authorization',
    'Authorization',
    'bearer',
    'Bearer',
    'token',
    'secret',
    'password',
    'headers', // Never log headers as they may contain Authorization
  ];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => 
        lowerKey.includes(sensitive.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeForLogging(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  }

  return sanitized;
}

/**
 * Safely logs an error without exposing sensitive data.
 * NEVER logs API keys, authorization headers, or request/response objects directly.
 */
function safeLogError(message: string, error: any): void {
  // Convert error to a safe object
  const errorObj: any = {
    message: error?.message || String(error),
    name: error?.name,
    stack: error?.stack,
  };

  // Sanitize before logging
  const sanitized = sanitizeForLogging(errorObj);
  console.error(`[Docs Summarizer] ${message}`, sanitized);
}

/**
 * Extracts token usage from OpenAI API response
 */
function extractTokenUsage(data: any): { inputTokens: number; outputTokens: number; totalTokens: number; cost: number } | null {
  if (!data?.usage) {
    return null;
  }

  const usage = data.usage;
  
  // Handle both naming conventions
  const inputTokens = Math.max(0, usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Math.max(0, usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

  // Guard against negative or invalid values
  if (totalTokens < 0 || (inputTokens === 0 && outputTokens === 0 && !usage.total_tokens)) {
    return null;
  }

  // If we don't have both input and output, we can't calculate cost accurately
  if (inputTokens === 0 && outputTokens === 0) {
    return null;
  }

  const cost = calculateTokenCost(inputTokens, outputTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
  };
}

/**
 * Calculates cost in dollars for gpt-5-nano based on token usage
 */
function calculateTokenCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GPT5_NANO_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * GPT5_NANO_PRICING.output;
  return inputCost + outputCost;
}

/**
 * Extracts text from OpenAI API response
 */
function extractTextFromResponse(data: any): string {
  // 1) Try convenience field if present
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputs = data.output;
  if (!Array.isArray(outputs)) return "";

  // 2) Look through all output items for an output_text content block
  for (const item of outputs) {
    if (!item || !Array.isArray(item.content)) continue;

    for (const piece of item.content) {
      if (!piece) continue;

      // Most common shape: { type: "output_text", text: "..." }
      if (
        (piece.type === "output_text" || piece.type === "output") &&
        typeof piece.text === "string" &&
        piece.text.trim()
      ) {
        return piece.text.trim();
      }
    }
  }

  return "";
}

/**
 * Handles OpenAI API requests in the background/service worker
 * This ensures the API key never exists in content script context
 */
async function handleOpenAIRequest(
  payload: OpenAIRequestPayload,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    console.log('[Docs Summarizer] Background script received OPENAI_REQUEST');
    
    // Get API key from storage (never exposed to content script)
    const storageResult = await new Promise<{ openaiApiKey?: string }>((resolve) => {
      chrome.storage.local.get(["openaiApiKey"], (result) => {
        resolve(result);
      });
    });

    const apiKey = storageResult.openaiApiKey;
    if (!apiKey) {
      console.error('[Docs Summarizer] API key missing in background script');
      sendResponse({ 
        error: "API key missing",
        errorType: "MISSING_API_KEY"
      });
      return;
    }

    // Track response time
    const startTime = performance.now();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`, // API key is NEVER logged
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: payload.modelSettings.model,
        instructions: payload.instructions,
        input: payload.input,
        max_output_tokens: payload.modelSettings.maxOutputTokens,
        reasoning: { effort: payload.modelSettings.reasoningEffort },
        text: {
          verbosity: payload.modelSettings.verbosity,
        },
      }),
    });

    const endTime = performance.now();
    const responseTime = (endTime - startTime) / 1000; // Convert to seconds

    const status = response.status;
    let data: any;

    try {
      data = await response.json();
    } catch (e) {
      // SAFETY: Never log the response object directly as it may contain headers
      safeLogError("Failed to parse OpenAI JSON", e);
      sendResponse({ 
        error: `OpenAI error (invalid JSON, status ${status})`,
        errorType: "PARSE_ERROR"
      });
      return;
    }

    // Log errors only (keep console spam to minimum)

    // HTTP-level error
    if (!response.ok) {
      const msg =
        data?.error?.message ??
        data?.error ??
        `HTTP ${status}`;
      sendResponse({ 
        error: `OpenAI error: ${msg}`,
        errorType: "HTTP_ERROR"
      });
      return;
    }

    // API-level error inside JSON
    if (data?.error) {
      const msg =
        data.error.message ??
        data.error.type ??
        JSON.stringify(data.error);
      sendResponse({ 
        error: `OpenAI error: ${msg}`,
        errorType: "API_ERROR"
      });
      return;
    }

    // Responses API status field (completed / incomplete / failed / cancelled)
    if (data?.status && data.status !== "completed") {
      // Try to extract any partial text that was generated before the filter triggered
      let partialText = "";
      try {
        partialText = extractTextFromResponse(data) || "";
      } catch (e) {
        // Ignore extraction errors
      }
      
      const tokenUsage = extractTokenUsage(data);
      let tokenInfo = "";
      
      if (data?.incomplete_details?.reason === "max_tokens" || data?.status === "incomplete") {
        if (tokenUsage) {
          tokenInfo = ` (Used ${tokenUsage.totalTokens.toLocaleString()} tokens, max was ${payload.modelSettings.maxOutputTokens?.toLocaleString() || payload.modelSettings.maxOutputTokens})`;
        } else if (data?.usage?.total_tokens) {
          const totalTokens = Math.max(0, data.usage.total_tokens);
          tokenInfo = ` (Used ${totalTokens.toLocaleString()} tokens, max was ${payload.modelSettings.maxOutputTokens?.toLocaleString() || payload.modelSettings.maxOutputTokens})`;
        } else {
          tokenInfo = ` (Max tokens: ${payload.modelSettings.maxOutputTokens?.toLocaleString() || payload.modelSettings.maxOutputTokens})`;
        }
      }
      
      // Content filter triggered - error already sent to user
      
      const details = data?.incomplete_details
        ? ` – details: ${JSON.stringify(data.incomplete_details)}`
        : "";
      
      // Include partial text in error message if available
      const partialTextInfo = partialText 
        ? `\n\n⚠️ Partial response before filter (${partialText.length} chars): "${partialText.slice(0, 200)}${partialText.length > 200 ? '...' : ''}"`
        : "";
      
      sendResponse({ 
        error: `OpenAI response not completed (status: ${data.status})${tokenInfo}${details}${partialTextInfo}`,
        errorType: "INCOMPLETE_RESPONSE"
      });
      return;
    }

    const summaryText = extractTextFromResponse(data);

    if (!summaryText || !summaryText.trim()) {
      sendResponse({ 
        error: "The model returned an empty response (no text blocks found). Try reducing the amount of page text or adjusting instructions.",
        errorType: "EMPTY_RESPONSE"
      });
      return;
    }

    // Extract token usage
    const tokenUsage = extractTokenUsage(data);

    sendResponse({
      success: true,
      text: summaryText,
      responseTime,
      tokenUsage,
    });
  } catch (error: any) {
    // SAFETY: Use safeLogError to prevent logging sensitive data
    safeLogError("Background OpenAI request error", error);
    sendResponse({ 
      error: error?.message || String(error),
      errorType: "UNKNOWN_ERROR"
    });
  }
}

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


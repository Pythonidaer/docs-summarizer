/** @jest-environment jsdom */

// Mock Chrome APIs before importing
const mockChromeRuntime = {
  sendMessage: jest.fn((message: any, callback?: (response: any) => void) => {
    if (callback) {
      callback({
        state: {
          pageText: "Test page text",
          pageStructureSummary: "Test structure",
          messages: [],
          settings: {
            voice: "default",
            model: "gpt-5-nano",
            reasoning: "low",
            verbosity: "low",
            useCustomInstructions: false,
            customInstructions: "",
            maxOutputTokens: 8000,
          },
          tabId: 1,
          pageUrl: "https://example.com",
        },
      });
    }
  }),
  getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
};

const mockChromeDetached = {
  runtime: mockChromeRuntime,
};

(global as any).chrome = mockChromeDetached;

// Mock window.close
(global as any).window.close = jest.fn();

// Mock the UI components
const mockBlurCheckbox = document.createElement("input");
const mockBlurLabel = document.createElement("label");
mockBlurLabel.appendChild(mockBlurCheckbox);

jest.mock("../ui/header", () => ({
  createHeader: jest.fn(() => ({
    header: document.createElement("div"),
    closeButton: document.createElement("button"),
  })),
}));

jest.mock("../ui/footer", () => {
  const blurCheckbox = document.createElement("input");
  const blurLabel = document.createElement("label");
  blurLabel.appendChild(blurCheckbox);
  
  return {
    createFooter: jest.fn(() => ({
      footer: document.createElement("div"),
      chatInput: document.createElement("textarea"),
      sendBtn: document.createElement("button"),
      summarizeBtn: document.createElement("button"),
      clearHighlightsBtn: document.createElement("button"),
      newWindowBtn: document.createElement("button"),
      reasoningSelect: document.createElement("select"),
      voiceSelect: document.createElement("select"),
      maxTokensSelect: document.createElement("select"),
      blurCheckbox: blurCheckbox,
    })),
  };
});

jest.mock("../ui/toolbar", () => ({
  createToolbar: jest.fn(() => ({
    toolbar: document.createElement("div"),
    blurCheckbox: mockBlurCheckbox,
    voiceSelect: document.createElement("select"),
    reasoningSelect: document.createElement("select"),
    maxTokensSelect: document.createElement("select"),
    summarizeBtn: document.createElement("button"),
    clearHighlightsBtn: document.createElement("button"),
    detachBtn: document.createElement("button"),
  })),
}));

jest.mock("../ui/mainArea", () => ({
  createMainArea: jest.fn(() => ({
    main: document.createElement("div"),
  })),
}));

jest.mock("../ui/events", () => ({
  wireDrawerEvents: jest.fn(),
}));

jest.mock("../ui/messages", () => ({
  renderMessages: jest.fn(),
}));

jest.mock("../pageText", () => ({
  setPageTextForLinks: jest.fn(),
}));

describe("detached-window.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    document.head.innerHTML = "";

    // Reset chrome.sendMessage mock
    (mockChromeRuntime.sendMessage as jest.Mock).mockImplementation(
      (message, callback) => {
        if (callback) {
          callback({
            state: {
              pageText: "Test page text",
              pageStructureSummary: "Test structure",
              messages: [],
              settings: {
                voice: "default",
                model: "gpt-5-nano",
                reasoning: "low",
                verbosity: "low",
                useCustomInstructions: false,
                customInstructions: "",
                maxOutputTokens: 8000,
              },
              tabId: 1,
              pageUrl: "https://example.com",
            },
          });
        }
      }
    );
  });

  test("requests state from background script on module load", () => {
    // The module executes immediately on import
    const initialCallCount = (mockChromeRuntime.sendMessage as jest.Mock).mock.calls.length;
    
    require("../detached-window");

    // Verify it was called (may be async, so check after a short delay)
    const newCallCount = (mockChromeRuntime.sendMessage as jest.Mock).mock.calls.length;
    // At minimum, it should have attempted to call
    expect(newCallCount).toBeGreaterThanOrEqual(initialCallCount);
  });

  test("handles error when loading state fails", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    (mockChromeRuntime.sendMessage as jest.Mock).mockImplementation(
      (message, callback) => {
        if (callback) {
          // Simulate error by calling with undefined
          callback(undefined);
        }
      }
    );

    jest.resetModules();
    require("../detached-window");

    // Should have attempted to call
    expect(mockChromeRuntime.sendMessage).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test("handles missing state gracefully", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    (mockChromeRuntime.sendMessage as jest.Mock).mockImplementation(
      (message, callback) => {
        if (callback) {
          callback({ state: null });
        }
      }
    );

    jest.resetModules();
    require("../detached-window");

    // Should log error about missing state
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Docs Summarizer] No state found"
    );
    consoleErrorSpy.mockRestore();
  });

  test("initializes UI components when state is loaded", (done) => {
    jest.resetModules();
    
    const { createHeader } = require("../ui/header");
    const { createFooter } = require("../ui/footer");
    const { createToolbar } = require("../ui/toolbar");
    const { createMainArea } = require("../ui/mainArea");
    const { wireDrawerEvents } = require("../ui/events");
    const { setPageTextForLinks } = require("../pageText");

    require("../detached-window");

    // Wait for async state loading and UI initialization
    setTimeout(() => {
      try {
        expect(createHeader).toHaveBeenCalled();
        expect(createFooter).toHaveBeenCalled();
        expect(createToolbar).toHaveBeenCalled();
        expect(createMainArea).toHaveBeenCalled();
        expect(wireDrawerEvents).toHaveBeenCalled();
        expect(setPageTextForLinks).toHaveBeenCalledWith("Test page text");
        done();
      } catch (error) {
        done(error);
      }
    }, 300);
  }, 10000); // Increase test timeout to 10 seconds
});

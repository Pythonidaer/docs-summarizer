/** @jest-environment jsdom */

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn((keys: string[], callback: (result: any) => void) => {
        callback({});
      }),
      set: jest.fn((items: any, callback?: () => void) => {
        if (callback) callback();
      }),
      remove: jest.fn((keys: string[], callback?: () => void) => {
        if (callback) callback();
      }),
    },
  },
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
    onMessage: {
      addListener: jest.fn(),
    },
  },
  windows: {
    create: jest.fn((options: any, callback?: (window: any) => void) => {
      const mockWindow = { id: 123 };
      if (callback) callback(mockWindow);
      return mockWindow;
    }),
    onRemoved: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    get: jest.fn((tabId: number, callback: (tab: any) => void) => {
      callback({ id: tabId, url: "https://example.com" });
    }),
    query: jest.fn((queryInfo: any, callback: (tabs: any[]) => void) => {
      callback([{ id: 1, url: "https://example.com" }]);
    }),
    sendMessage: jest.fn((tabId: number, message: any, callback?: (response: any) => void) => {
      if (callback) callback({ success: true });
    }),
  },
  scripting: {
    executeScript: jest.fn((options: any, callback?: () => void) => {
      if (callback) callback();
    }),
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
};

(global as any).chrome = mockChrome;

describe("background.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Reset storage mocks
    (mockChrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
      callback({});
    });
  });

  test("registers message and window listeners on module load", () => {
    // Import the module - it will execute and register listeners
    require("../background");
    
    // Verify listeners were registered
    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(mockChrome.windows.onRemoved.addListener).toHaveBeenCalled();
    expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
  });

  test("attempts to restore state from storage on startup", () => {
    const mockState = {
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
      },
      tabId: 1,
      pageUrl: "https://example.com",
    };

    (mockChrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
      callback({
        detachedWindowState: mockState,
        sourceTabId: 1,
      });
    });

    // Re-import to trigger storage restoration
    require("../background");

    // Verify storage was accessed
    expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
      ["detachedWindowState", "sourceTabId"],
      expect.any(Function)
    );
  });

  test("message listener handles OPEN_DETACHED_WINDOW", (done) => {
    require("../background");
    
    const calls = (mockChrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    if (calls.length === 0) {
      done();
      return;
    }
    
    const messageListener = calls[calls.length - 1][0];
    const mockState = {
      pageText: "Test",
      pageStructureSummary: "Summary",
      messages: [],
      settings: {
        voice: "default",
        model: "gpt-5-nano",
        reasoning: "low",
        verbosity: "low",
        useCustomInstructions: false,
        customInstructions: "",
      },
      tabId: null,
      pageUrl: null,
    };

    const sender = { tab: { id: 1, url: "https://example.com" } };
    const sendResponse = jest.fn((response) => {
      expect(response).toEqual({ success: true });
      expect(mockChrome.windows.create).toHaveBeenCalled();
      done();
    });

    messageListener(
      { type: "OPEN_DETACHED_WINDOW", state: mockState },
      sender,
      sendResponse
    );
  });

  test("message listener handles GET_DETACHED_WINDOW_STATE", () => {
    require("../background");
    
    const calls = (mockChrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    if (calls.length === 0) {
      return;
    }
    
    const messageListener = calls[calls.length - 1][0];
    const sendResponse = jest.fn();

    const result = messageListener(
      { type: "GET_DETACHED_WINDOW_STATE" },
      {},
      sendResponse
    );

    expect(result).toBe(true);
    expect(sendResponse).toHaveBeenCalled();
  });

  test("message listener handles UPDATE_DETACHED_WINDOW_STATE", () => {
    require("../background");
    
    const calls = (mockChrome.runtime.onMessage.addListener as jest.Mock).mock.calls;
    if (calls.length === 0) {
      return;
    }
    
    const messageListener = calls[calls.length - 1][0];
    const newState = {
      pageText: "Updated text",
      pageStructureSummary: "Updated summary",
      messages: [],
      settings: {
        voice: "teacher",
        model: "gpt-5-nano",
        reasoning: "medium",
        verbosity: "low",
        useCustomInstructions: false,
        customInstructions: "",
      },
      tabId: 1,
      pageUrl: "https://example.com",
    };

    const sendResponse = jest.fn();

    const result = messageListener(
      { type: "UPDATE_DETACHED_WINDOW_STATE", state: newState },
      {},
      sendResponse
    );

    expect(result).toBe(true);
    expect(mockChrome.storage.local.set).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});

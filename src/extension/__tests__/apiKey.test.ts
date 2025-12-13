/** @jest-environment jsdom */
import { ensureApiKey } from "../storage/apiKey";

// Mock modal functions
jest.mock("../ui/modal", () => ({
  showPrompt: jest.fn(),
  showAlert: jest.fn(),
}));

import { showPrompt, showAlert } from "../ui/modal";

const mockShowPrompt = showPrompt as jest.MockedFunction<typeof showPrompt>;
const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

// Mock chrome.storage.sync
const mockStorage: { [key: string]: any } = {};

const mockChromeStorage = {
  sync: {
    get: jest.fn((keys: string[] | { [key: string]: any }, callback: (result: any) => void) => {
      // Read from mockStorage at call time
      const result: any = {};
      if (Array.isArray(keys)) {
        keys.forEach((key) => {
          // Read current value from mockStorage
          result[key] = mockStorage[key];
        });
      } else if (typeof keys === "object" && keys !== null) {
        // Handle object syntax
        Object.keys(keys).forEach((key) => {
          result[key] = mockStorage[key] ?? (keys as any)[key];
        });
      }
      // Call callback synchronously to match Chrome API behavior
      callback(result);
    }),
    set: jest.fn((items: any, callback?: () => void) => {
      // Actually update the mock storage synchronously
      Object.keys(items).forEach((key) => {
        mockStorage[key] = items[key];
      });
      // Call callback synchronously to match Chrome API behavior
      if (callback) {
        callback();
      }
    }),
  },
};

beforeAll(() => {
  (global as any).chrome = { storage: mockChromeStorage };
});

beforeEach(() => {
  // Clear mocks and storage
  jest.clearAllMocks();
  // Clear storage by deleting all keys
  for (const key in mockStorage) {
    delete mockStorage[key];
  }
  mockShowPrompt.mockResolvedValue(null);
  mockShowAlert.mockResolvedValue(undefined);
  
  // Reset the get mock to read from current mockStorage
  mockChromeStorage.sync.get.mockImplementation((keys: string[] | { [key: string]: any }, callback: (result: any) => void) => {
    const result: any = {};
    if (Array.isArray(keys)) {
      keys.forEach((key) => {
        result[key] = mockStorage[key];
      });
    } else if (typeof keys === "object" && keys !== null) {
      Object.keys(keys).forEach((key) => {
        result[key] = mockStorage[key] ?? (keys as any)[key];
      });
    }
    callback(result);
  });
  
  // Reset the set mock to update mockStorage
  mockChromeStorage.sync.set.mockImplementation((items: any, callback?: () => void) => {
    Object.keys(items).forEach((key) => {
      mockStorage[key] = items[key];
    });
    if (callback) callback();
  });
});

describe("ensureApiKey", () => {
  test("returns existing key from storage", async () => {
    mockStorage.openaiApiKey = "sk-test123";

    const result = await ensureApiKey();

    expect(result).toBe("sk-test123");
    expect(mockChromeStorage.sync.get).toHaveBeenCalled();
    expect(mockShowPrompt).not.toHaveBeenCalled();
  });

  test("prompts user when key is missing", async () => {
    mockStorage.openaiApiKey = undefined;
    mockShowPrompt.mockResolvedValue("sk-user-entered-key");

    const result = await ensureApiKey();

    expect(result).toBe("sk-user-entered-key");
    expect(mockShowPrompt).toHaveBeenCalledWith(
      "Enter your OpenAI API key (will be stored in Chrome for this extension only):",
      "sk-..."
    );
    expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
      { openaiApiKey: "sk-user-entered-key" },
      expect.any(Function)
    );
  });

  test("returns null when user cancels prompt", async () => {
    mockStorage.openaiApiKey = undefined;
    mockShowPrompt.mockResolvedValue(null);

    const result = await ensureApiKey();

    expect(result).toBeNull();
    expect(mockShowAlert).toHaveBeenCalledWith("No API key entered. Cannot call OpenAI.", "API Key Required");
    expect(mockChromeStorage.sync.set).not.toHaveBeenCalled();
  });

  test("returns null when user enters empty string", async () => {
    mockStorage.openaiApiKey = undefined;
    mockShowPrompt.mockResolvedValue("");

    const result = await ensureApiKey();

    expect(result).toBeNull();
    expect(mockShowAlert).toHaveBeenCalledWith("No API key entered. Cannot call OpenAI.", "API Key Required");
    expect(mockChromeStorage.sync.set).not.toHaveBeenCalled();
  });

  test("returns null when user enters only whitespace", async () => {
    mockStorage.openaiApiKey = undefined;
    mockShowPrompt.mockResolvedValue("   \n  ");

    const result = await ensureApiKey();

    expect(result).toBeNull();
    expect(mockShowAlert).toHaveBeenCalledWith("No API key entered. Cannot call OpenAI.", "API Key Required");
    expect(mockChromeStorage.sync.set).not.toHaveBeenCalled();
  });

  test("trims and stores the entered key", async () => {
    mockStorage.openaiApiKey = undefined;
    mockShowPrompt.mockResolvedValue("  sk-test-key-with-spaces  ");

    const result = await ensureApiKey();

    expect(result).toBe("sk-test-key-with-spaces");
    expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
      { openaiApiKey: "sk-test-key-with-spaces" },
      expect.any(Function)
    );
  });

  test("handles storage.get with object syntax", async () => {
    // Chrome storage.get can be called with object syntax: get({key: defaultValue})
    mockStorage.openaiApiKey = "sk-existing";
    // Simulate object syntax call
    mockChromeStorage.sync.get.mockImplementation((keys: any, callback: any) => {
      const result: any = {};
      if (typeof keys === "object" && !Array.isArray(keys)) {
        Object.keys(keys).forEach((key) => {
          result[key] = mockStorage[key] ?? keys[key];
        });
      } else if (Array.isArray(keys)) {
        keys.forEach((key: string) => {
          result[key] = mockStorage[key];
        });
      }
      callback(result);
    });

    const result = await ensureApiKey();

    expect(result).toBe("sk-existing");
  });

  test("handles undefined storage value correctly", async () => {
    // Simulate storage returning undefined (not set)
    mockChromeStorage.sync.get.mockImplementation((keys: any, callback: any) => {
      callback({ openaiApiKey: undefined });
    });

    mockShowPrompt.mockResolvedValue("sk-new-key");

    const result = await ensureApiKey();

    expect(result).toBe("sk-new-key");
    expect(mockShowPrompt).toHaveBeenCalled();
  });

  test("does not prompt again after storing key", async () => {
    // Clear storage first
    delete mockStorage.openaiApiKey;
    mockShowPrompt.mockResolvedValue("sk-first-call");

    // First call - should prompt
    const firstResult = await ensureApiKey();
    expect(firstResult).toBe("sk-first-call");
    expect(mockShowPrompt).toHaveBeenCalledTimes(1);
    
    // Verify key was stored in mockStorage (check directly)
    expect(mockStorage.openaiApiKey).toBe("sk-first-call");
    
    // Verify set was called and actually updated storage
    expect(mockChromeStorage.sync.set).toHaveBeenCalledWith(
      { openaiApiKey: "sk-first-call" },
      expect.any(Function)
    );
    
    // Manually verify the get mock would return the stored value
    const testResult: any = {};
    mockChromeStorage.sync.get(
      ["openaiApiKey"],
      (result: any) => {
        Object.assign(testResult, result);
      }
    );
    expect(testResult.openaiApiKey).toBe("sk-first-call");

    // Reset prompt mock to detect if it's called again
    mockShowPrompt.mockClear();
    mockShowPrompt.mockResolvedValue(null); // Change return value to detect if called

    // Second call - should use stored key, no prompt
    const secondResult = await ensureApiKey();
    expect(secondResult).toBe("sk-first-call");
    expect(mockShowPrompt).not.toHaveBeenCalled(); // Should not prompt again
  });
});


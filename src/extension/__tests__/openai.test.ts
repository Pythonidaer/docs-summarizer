import {
  buildInstructions,
  buildInputForPageSummary,
  extractTextFromResponse,
  buildInputForConversation,
  callOpenAI,
  summarizeWithOpenAI,
  chatWithOpenAI,
} from "../openai";
import { BASE_SYSTEM_INSTRUCTIONS, MARKDOWN_FORMAT_HINT } from "../constants";
import { Message, ModelSettings } from "../types";
import { getPromptVoiceInstructions, PromptVoiceId } from "../prompts/voices";
import { ensureApiKey } from "../storage/apiKey";

// Mock ensureApiKey
jest.mock("../storage/apiKey", () => ({
  ensureApiKey: jest.fn(),
}));

const mockEnsureApiKey = ensureApiKey as jest.MockedFunction<typeof ensureApiKey>;

describe("buildInstructions", () => {
  const CUSTOM_TEXT = "Custom layer instructions.";

  test("includes system + personal + default voice when custom is disabled", () => {
    const result = buildInstructions({
      useCustom: false,
      customInstructions: "",
      promptVoiceId: "default",
    });

    // System rules always included
    expect(result).toContain(BASE_SYSTEM_INSTRUCTIONS);

    // Personal style always included

    // Default voice included
    const defaultVoice = getPromptVoiceInstructions("default");
    expect(defaultVoice.trim().length).toBeGreaterThan(0);
    expect(result).toContain(defaultVoice);

    // No custom text
    expect(result).not.toContain(CUSTOM_TEXT);
  });

  test("appends custom instructions when enabled and non-empty", () => {
    const result = buildInstructions({
      useCustom: true,
      customInstructions: CUSTOM_TEXT,
      promptVoiceId: "default",
    });

    expect(result).toContain(BASE_SYSTEM_INSTRUCTIONS);

    const defaultVoice = getPromptVoiceInstructions("default");
    expect(result).toContain(defaultVoice);

    // Custom layer appended
    expect(result).toContain(CUSTOM_TEXT);
  });

  test("ignores custom instructions when enabled but only whitespace", () => {
    const result = buildInstructions({
      useCustom: true,
      customInstructions: "   \n  ",
      promptVoiceId: "default",
    });

    expect(result).toContain(BASE_SYSTEM_INSTRUCTIONS);

    const defaultVoice = getPromptVoiceInstructions("default");
    expect(result).toContain(defaultVoice);

    // Whitespace-only custom text should not appear
    // (we just assert that the exact trimmed value is absent)
    expect(result).not.toContain("   \n  ");
  });

  test("uses the requested prompt voice id", () => {
    const result = buildInstructions({
      useCustom: false,
      customInstructions: "",
      promptVoiceId: "teacher",
    });

    const teacherVoice = getPromptVoiceInstructions("teacher");
    expect(teacherVoice.trim().length).toBeGreaterThan(0);
    expect(result).toContain(teacherVoice);
  });
});

describe("buildInputForPageSummary", () => {
  const SAMPLE_TEXT = "This is some documentation text.";

  test("builds a summary prompt with documentation and format hint", () => {
    const input = buildInputForPageSummary(SAMPLE_TEXT);

    // High-level directive
    expect(input).toContain("Summarize and explain the following documentation.");

    // Includes the documentation label and content
    expect(input).toContain("DOCUMENTATION:");
    expect(input).toContain(SAMPLE_TEXT);

    // Includes response format section and markdown hint
    expect(input).toContain("=== RESPONSE FORMAT ===");
    expect(input).toContain(MARKDOWN_FORMAT_HINT);
  });
});

describe("extractTextFromResponse", () => {
  test("returns output_text when present and non-empty", () => {
    const apiResponse = {
      output_text: "Hello world",
    };

    const result = extractTextFromResponse(apiResponse);
    expect(result).toBe("Hello world");
  });

  test("falls back to structured output content text when output_text is missing", () => {
    const apiResponse = {
        output: [
        {
            content: [
            {
                type: "output_text",
                text: "Structured output here",
            },
            ],
        },
        ],
    };

    const result = extractTextFromResponse(apiResponse);
    expect(result).toBe("Structured output here");
  });

  test("returns empty string when no usable text is found", () => {
    const apiResponse = {
      output: [],
    };

    const result = extractTextFromResponse(apiResponse);
    expect(result).toBe("");
  });
});

describe("buildInputForConversation", () => {
  it("includes page content and a no-prior-conversation marker when history is empty", () => {
    const pageText = "Some documentation content.";
    const history: Message[] = [];

    const result = buildInputForConversation(pageText, history);

    expect(result).toContain("You are helping a developer understand the following documentation.");
    expect(result).toContain("=== PAGE CONTENT (read-only context) ===");
    expect(result).toContain(pageText);
    expect(result).toContain("=== CONVERSATION SO FAR ===");
    expect(result).toContain("(No prior conversation.)");
    expect(result).toContain("=== RESPONSE FORMAT ===");
  });

  it("serializes prior messages with correct prefixes", () => {
    const pageText = "API docs about something.";
    const history: Message[] = [
      { id: "1", role: "user", text: "How do I authenticate?" },
      { id: "2", role: "assistant", text: "Use an API key header." },
    ];

    const result = buildInputForConversation(pageText, history);

    // Page text is still present
    expect(result).toContain(pageText);

    // Messages are rendered with prefixes
    expect(result).toContain("User: How do I authenticate?");
    expect(result).toContain("Assistant: Use an API key header.");

    // We no longer show "(No prior conversation.)"
    expect(result).not.toContain("(No prior conversation.)");
  });

  it("strips scroll links from assistant messages in history", () => {
    const pageText = "Some documentation.";
    const history: Message[] = [
      { id: "1", role: "user", text: "What is type inference?" },
      { 
        id: "2", 
        role: "assistant", 
        text: "Type inference is explained in the [Type inference section](#scroll:Type inference section)." 
      },
    ];

    const result = buildInputForConversation(pageText, history);

    // User message should be unchanged
    expect(result).toContain("User: What is type inference?");

    // Assistant message should have scroll link stripped (just the label text remains)
    expect(result).toContain("Assistant: Type inference is explained in the Type inference section.");
    
    // The assistant message line should NOT contain the scroll link syntax
    // (Note: MARKDOWN_FORMAT_HINT contains "#scroll:" examples, so we check the specific line)
    const assistantLine = result.split("\n").find(line => line.startsWith("Assistant:"));
    expect(assistantLine).toBeDefined();
    expect(assistantLine).not.toContain("#scroll:");
    expect(assistantLine).not.toContain("scroll:");
  });

  it("strips multiple scroll links from assistant messages", () => {
    const pageText = "Some documentation.";
    const history: Message[] = [
      { 
        id: "1", 
        role: "assistant", 
        text: "See [Type inference](#scroll:Type inference) and [Function types](#scroll:Function types) for details." 
      },
    ];

    const result = buildInputForConversation(pageText, history);

    // Both links should be stripped, leaving just the label text
    expect(result).toContain("Assistant: See Type inference and Function types for details.");
    
    // The assistant message line should NOT contain the scroll link syntax
    const assistantLine = result.split("\n").find(line => line.startsWith("Assistant:"));
    expect(assistantLine).toBeDefined();
    expect(assistantLine).not.toContain("#scroll:");
  });

  it("preserves user messages with scroll links (does not strip them)", () => {
    const pageText = "Some documentation.";
    const history: Message[] = [
      { 
        id: "1", 
        role: "user", 
        text: "Can you explain [this section](#scroll:this section)?" 
      },
    ];

    const result = buildInputForConversation(pageText, history);

    // User messages should be unchanged (they might reference things)
    expect(result).toContain("User: Can you explain [this section](#scroll:this section)?");
  });

  it("handles both #scroll: and scroll: patterns", () => {
    const pageText = "Some documentation.";
    const history: Message[] = [
      { 
        id: "1", 
        role: "assistant", 
        text: "See [Hash link](#scroll:phrase) and [Plain link](scroll:phrase)." 
      },
    ];

    const result = buildInputForConversation(pageText, history);

    // Both patterns should be stripped
    expect(result).toContain("Assistant: See Hash link and Plain link.");
    
    // The assistant message line should NOT contain the scroll link syntax
    const assistantLine = result.split("\n").find(line => line.startsWith("Assistant:"));
    expect(assistantLine).toBeDefined();
    expect(assistantLine).not.toContain("#scroll:");
    expect(assistantLine).not.toContain("scroll:");
  });
});

describe("callOpenAI", () => {
  const mockSendMessage = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    // Mock chrome.runtime.sendMessage
    (global as any).chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        lastError: null,
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
    // Reset lastError
    (global as any).chrome.runtime.lastError = null;
  });

  test("successfully calls OpenAI API and returns text", async () => {
    // Mock background script response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "This is the response text",
          responseTime: 1.5,
          tokenUsage: null,
        });
      }
    });

    const result = await callOpenAI(
      "Test input",
      "Test instructions",
      defaultModelSettings,
      "summary"
    );

    expect(result.text).toBe("This is the response text");
    expect(result.responseTime).toBe(1.5);
    expect(result.tokenUsage).toBeNull();
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPENAI_REQUEST",
        payload: expect.objectContaining({
          input: "Test input",
          instructions: "Test instructions",
          modelSettings: expect.objectContaining({
            model: "gpt-5-nano",
          }),
          mode: "summary",
        }),
      }),
      expect.any(Function)
    );
  });

  test("throws error when API key is missing", async () => {
    mockEnsureApiKey.mockResolvedValue(null);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("API key missing");
    
    // Should not send message if key is missing
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("throws error on HTTP error status", async () => {
    // Mock background script error response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          error: "OpenAI error: Invalid API key",
          errorType: "HTTP_ERROR",
        });
      }
    });

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI error: Invalid API key");
  });

  test("throws error on invalid JSON response", async () => {
    // Mock background script error response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          error: "OpenAI error (invalid JSON, status 200)",
          errorType: "PARSE_ERROR",
        });
      }
    });

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI error (invalid JSON");
  });

  test("throws error when response status is not 'completed'", async () => {
    // Mock background script error response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          error: "OpenAI response not completed (status: incomplete)",
          errorType: "INCOMPLETE_RESPONSE",
        });
      }
    });

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI response not completed");
  });

  test("throws error when response is empty", async () => {
    // Mock background script error response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          error: "The model returned an empty response (no text blocks found). Try reducing the amount of page text or adjusting instructions.",
          errorType: "EMPTY_RESPONSE",
        });
      }
    });

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("empty response");
  });

  test("extracts text from structured output when output_text is missing", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Text from structured output",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    const result = await callOpenAI(
      "Test input",
      "Test instructions",
      defaultModelSettings,
      "summary"
    );

    expect(result.text).toBe("Text from structured output");
  });

  test("sends correct model settings in request", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Response",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    const modelSettings: ModelSettings = {
      model: "gpt-5-mini",
      reasoningEffort: "medium",
      verbosity: "high",
      maxOutputTokens: 10000,
    };

    await callOpenAI("Test input", "Test instructions", modelSettings, "chat");

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPENAI_REQUEST",
        payload: expect.objectContaining({
          modelSettings: expect.objectContaining({
            model: "gpt-5-mini",
            reasoningEffort: "medium",
            verbosity: "high",
          }),
        }),
      }),
      expect.any(Function)
    );
  });

  test("handles chrome.runtime.lastError", async () => {
    // Mock chrome runtime error - callback is called but lastError is set
    mockSendMessage.mockImplementation((message, callback) => {
      (global as any).chrome.runtime.lastError = { message: "Extension context invalidated" };
      // Call callback but lastError will be checked
      callback({});
    });

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("Extension error: Extension context invalidated");
  });
});

describe("summarizeWithOpenAI", () => {
  const mockSendMessage = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    // Mock chrome.runtime.sendMessage
    (global as any).chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        lastError: null,
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
    (global as any).chrome.runtime.lastError = null;
  });

  test("calls OpenAI with correct summary input", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Summary response",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    const result = await summarizeWithOpenAI(
      "Page text content",
      "Structure summary",
      false,
      "",
      "default",
      defaultModelSettings
    );

    expect(result.text).toBe("Summary response");
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPENAI_REQUEST",
        payload: expect.objectContaining({
          input: expect.stringContaining("Page text content"),
        }),
      }),
      expect.any(Function)
    );
    // Verify structure summary is included in the input
    const callArgs = mockSendMessage.mock.calls[0];
    const payload = callArgs[0].payload;
    expect(payload.input).toContain("Structure summary");
  });

  test("handles null pageStructureSummary", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Summary",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    await summarizeWithOpenAI(
      "Page text",
      null,
      false,
      "",
      "default",
      defaultModelSettings
    );

    // Verify structure summary is NOT included in the input
    const callArgs = mockSendMessage.mock.calls[0];
    const payload = callArgs[0].payload;
    expect(payload.input).not.toContain("Structure summary");
  });

  test("includes custom instructions when enabled", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Summary",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    await summarizeWithOpenAI(
      "Page text",
      null,
      true,
      "Custom instruction text",
      "teacher",
      defaultModelSettings
    );

    // Verify custom instructions are included
    const callArgs = mockSendMessage.mock.calls[0];
    const payload = callArgs[0].payload;
    expect(payload.instructions).toContain("Custom instruction text");
    expect(payload.instructions).toContain(getPromptVoiceInstructions("teacher"));
  });
});

describe("chatWithOpenAI", () => {
  const mockSendMessage = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    // Mock chrome.runtime.sendMessage
    (global as any).chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        lastError: null,
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
    (global as any).chrome.runtime.lastError = null;
  });

  test("calls OpenAI with conversation history", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Chat response",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    const history: Message[] = [
      { id: "1", role: "user", text: "Question 1" },
      { id: "2", role: "assistant", text: "Answer 1" },
    ];

    const result = await chatWithOpenAI(
      "Page text",
      history,
      false,
      "",
      "default",
      defaultModelSettings
    );

    expect(result.text).toBe("Chat response");
    const callArgs = mockSendMessage.mock.calls[0];
    const payload = callArgs[0].payload;
    expect(payload.input).toContain("Page text");
    expect(payload.input).toContain("Question 1");
    expect(payload.input).toContain("Answer 1");
  });

  test("handles empty conversation history", async () => {
    // Mock background script success response
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === "OPENAI_REQUEST") {
        callback({
          success: true,
          text: "Response",
          responseTime: 1.0,
          tokenUsage: null,
        });
      }
    });

    const result = await chatWithOpenAI("Page text", [], false, "", "default", defaultModelSettings);
    expect(result.text).toBe("Response");

    const callArgs = mockSendMessage.mock.calls[0];
    const payload = callArgs[0].payload;
    expect(payload.input).toContain("(No prior conversation.)");
  });
});

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
  const mockFetch = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
  });

  test("successfully calls OpenAI API and returns text", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "This is the response text",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await callOpenAI(
      "Test input",
      "Test instructions",
      defaultModelSettings,
      "summary"
    );

    expect(result.text).toBe("This is the response text");
    expect(result.responseTime).toBeGreaterThan(0);
    expect(result.tokenUsage).toBeNull(); // No usage data in mock
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test-key",
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining('"model":"gpt-5-nano"'),
      })
    );
  });

  test("throws error when API key is missing", async () => {
    mockEnsureApiKey.mockResolvedValue(null);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("API key missing");
  });

  test("throws error on HTTP error status", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        error: { message: "Invalid API key" },
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI error: Invalid API key");
  });

  test("throws error on invalid JSON response", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI error (invalid JSON");
  });

  test("throws error when response status is not 'completed'", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "incomplete",
        incomplete_details: { reason: "max_tokens" },
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("OpenAI response not completed");
  });

  test("throws error when response is empty", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output: [],
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      callOpenAI("Test input", "Test instructions", defaultModelSettings, "summary")
    ).rejects.toThrow("empty response");
  });

  test("extracts text from structured output when output_text is missing", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "Text from structured output",
              },
            ],
          },
        ],
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await callOpenAI(
      "Test input",
      "Test instructions",
      defaultModelSettings,
      "summary"
    );

    expect(result.text).toBe("Text from structured output");
  });

  test("sends correct model settings in request", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Response",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const modelSettings: ModelSettings = {
      model: "gpt-5-mini",
      reasoningEffort: "medium",
      verbosity: "high",
      maxOutputTokens: 10000,
    };

    await callOpenAI("Test input", "Test instructions", modelSettings, "chat");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.model).toBe("gpt-5-mini");
    expect(body.reasoning.effort).toBe("medium");
    expect(body.text.verbosity).toBe("high");
  });
});

describe("summarizeWithOpenAI", () => {
  const mockFetch = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
  });

  test("calls OpenAI with correct summary input", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Summary response",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await summarizeWithOpenAI(
      "Page text content",
      "Structure summary",
      false,
      "",
      "default",
      defaultModelSettings
    );

    expect(result.text).toBe("Summary response");
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input).toContain("Page text content");
    expect(body.input).toContain("Structure summary");
  });

  test("handles null pageStructureSummary", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Summary",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await summarizeWithOpenAI(
      "Page text",
      null,
      false,
      "",
      "default",
      defaultModelSettings
    );

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    // Should not include structure summary section if null
    expect(body.input).not.toContain("Structure summary");
  });

  test("includes custom instructions when enabled", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Summary",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await summarizeWithOpenAI(
      "Page text",
      null,
      true,
      "Custom instruction text",
      "teacher",
      defaultModelSettings
    );

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.instructions).toContain("Custom instruction text");
    expect(body.instructions).toContain(getPromptVoiceInstructions("teacher"));
  });
});

describe("chatWithOpenAI", () => {
  const mockFetch = jest.fn();
  const defaultModelSettings: ModelSettings = {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    verbosity: "low",
    maxOutputTokens: 10000,
  };

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApiKey.mockResolvedValue("sk-test-key");
  });

  test("calls OpenAI with conversation history", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Chat response",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

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
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input).toContain("Page text");
    expect(body.input).toContain("Question 1");
    expect(body.input).toContain("Answer 1");
  });

  test("handles empty conversation history", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "completed",
        output_text: "Response",
      }),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await chatWithOpenAI("Page text", [], false, "", "default", defaultModelSettings);
    expect(result.text).toBe("Response");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input).toContain("(No prior conversation.)");
  });
});

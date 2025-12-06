import { buildInstructions, buildInputForPageSummary, extractTextFromResponse, buildInputForConversation } from "../openai";
import { BASE_SYSTEM_INSTRUCTIONS, MARKDOWN_FORMAT_HINT } from "../constants";
import { Message } from "../types";
import { getPromptVoiceInstructions, PromptVoiceId } from "../prompts/voices";

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
});

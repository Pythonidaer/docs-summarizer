import { getActiveInstructions, buildInputForPageSummary, extractTextFromResponse } from "../openai";
import { DEFAULT_INSTRUCTIONS, MARKDOWN_FORMAT_HINT } from "../constants";

describe("getActiveInstructions", () => {
  test("returns default instructions when useCustom is false", () => {
    const result = getActiveInstructions(false, "Some custom text");
    expect(result).toBe(DEFAULT_INSTRUCTIONS);
  });

  test("returns default instructions when custom text is empty/whitespace", () => {
    const result = getActiveInstructions(true, "   ");
    expect(result).toBe(DEFAULT_INSTRUCTIONS);
  });

  test("returns trimmed custom text when useCustom is true and non-empty", () => {
    const result = getActiveInstructions(true, "  Custom instructions here  ");
    expect(result).toBe("Custom instructions here");
  });
});

describe("buildInputForPageSummary", () => {
  const SAMPLE_TEXT = "This is some documentation text.";

  test("includes default guidance when useCustom is false", () => {
    const input = buildInputForPageSummary(SAMPLE_TEXT, false, "");
    expect(input).toContain("Summarize and explain the following documentation for a junior-level engineer.");
    expect(input).toContain("Start with a 2–3 sentence overview, then provide 3–5 bullet points of key ideas.");
    expect(input).toContain("DOCUMENTATION:");
    expect(input).toContain(SAMPLE_TEXT);
    expect(input).toContain("=== RESPONSE FORMAT ===");
    expect(input).toContain(MARKDOWN_FORMAT_HINT);
  });

  test("uses custom-instructions variant when useCustom is true", () => {
    const input = buildInputForPageSummary(SAMPLE_TEXT, true, "Custom text here");
    expect(input).toContain("Summarize the following documentation according to your active instructions.");
    // Should still contain documentation and format hint
    expect(input).toContain("DOCUMENTATION:");
    expect(input).toContain(SAMPLE_TEXT);
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

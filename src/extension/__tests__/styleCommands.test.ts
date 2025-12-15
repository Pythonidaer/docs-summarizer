// src/extension/__tests__/styleCommands.test.ts
import { parseStyleCommands, buildStyleInstructions } from "../styleCommands";

describe("parseStyleCommands", () => {
  it("returns original text and empty commands when no commands present", () => {
    const result = parseStyleCommands("What is React?");
    expect(result.text).toBe("What is React?");
    expect(result.styleCommands).toEqual([]);
  });

  it("parses paragraph commands", () => {
    const result = parseStyleCommands("Summarize this --3-paragraphs");
    expect(result.text).toBe("Summarize this");
    expect(result.styleCommands).toEqual([{ type: "paragraphs", value: 3 }]);
  });

  it("parses single paragraph command", () => {
    const result = parseStyleCommands("Explain --1-paragraph");
    expect(result.text).toBe("Explain");
    expect(result.styleCommands).toEqual([{ type: "paragraphs", value: 1 }]);
  });

  it("parses multiple paragraph commands (keeps first)", () => {
    const result = parseStyleCommands("Summarize --3-paragraphs --5-paragraphs");
    expect(result.text).toBe("Summarize");
    expect(result.styleCommands.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const result = parseStyleCommands("Explain --3-PARAGRAPHS");
    expect(result.text).toBe("Explain");
    expect(result.styleCommands).toContainEqual({ type: "paragraphs", value: 3 });
  });

  it("handles commands in the middle of text", () => {
    const result = parseStyleCommands("What is React --3-paragraphs and how does it work?");
    expect(result.text).toBe("What is React and how does it work?");
    expect(result.styleCommands).toEqual([{ type: "paragraphs", value: 3 }]);
  });

  it("cleans up extra whitespace", () => {
    const result = parseStyleCommands("Explain  --3-paragraphs  ");
    expect(result.text).toBe("Explain");
    expect(result.styleCommands.length).toBe(1);
  });
});

describe("buildStyleInstructions", () => {
  it("returns empty string for empty commands", () => {
    expect(buildStyleInstructions([])).toBe("");
  });

  it("builds paragraph instruction", () => {
    const result = buildStyleInstructions([{ type: "paragraphs", value: 3 }]);
    expect(result).toContain("exactly 3 paragraphs");
    expect(result).toContain("ONLY paragraph");
    expect(result).toContain("no headings");
    expect(result).toContain("no bullet lists");
    expect(result).toContain("Do not exceed or fall short");
    expect(result).toContain("THIS OVERRIDES ALL OTHER INSTRUCTIONS");
  });

  it("builds single paragraph instruction", () => {
    const result = buildStyleInstructions([{ type: "paragraphs", value: 1 }]);
    expect(result).toContain("exactly 1 paragraph");
    expect(result).toContain("ONLY paragraph");
    expect(result).toContain("THIS OVERRIDES ALL OTHER INSTRUCTIONS");
  });

  it("builds paragraph instruction with different values", () => {
    const result1 = buildStyleInstructions([{ type: "paragraphs", value: 5 }]);
    expect(result1).toContain("exactly 5 paragraphs");
    expect(result1).toContain("ONLY paragraph");
    expect(result1).toContain("THIS OVERRIDES ALL OTHER INSTRUCTIONS");
    
    const result2 = buildStyleInstructions([{ type: "paragraphs", value: 1 }]);
    expect(result2).toContain("exactly 1 paragraph");
    expect(result2).toContain("ONLY paragraph");
    expect(result2).toContain("THIS OVERRIDES ALL OTHER INSTRUCTIONS");
  });
});


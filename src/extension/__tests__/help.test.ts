// src/extension/__tests__/help.test.ts
import { parseHelpCommand } from "../help";

describe("parseHelpCommand", () => {
  it("returns null for non-help commands", () => {
    expect(parseHelpCommand("What is React?")).toBeNull();
    expect(parseHelpCommand("Summarize this page")).toBeNull();
    expect(parseHelpCommand("")).toBeNull();
    expect(parseHelpCommand("   ")).toBeNull();
  });

  it("recognizes --help command", () => {
    const result = parseHelpCommand("--help");
    expect(result).not.toBeNull();
    expect(result).toContain("Docs Summarizer Help");
    expect(result).toContain("Available Commands");
  });

  it("recognizes -h alias", () => {
    const result = parseHelpCommand("-h");
    expect(result).not.toBeNull();
    expect(result).toContain("Docs Summarizer Help");
  });

  it("recognizes --about command", () => {
    const result = parseHelpCommand("--about");
    expect(result).not.toBeNull();
    expect(result).toContain("About Docs Summarizer");
    expect(result).toContain("Features");
  });

  it("recognizes --errors command", () => {
    const result = parseHelpCommand("--errors");
    expect(result).not.toBeNull();
    expect(result).toContain("Error Explanations");
    expect(result).toContain("Content Filter");
  });

  it("recognizes --features command", () => {
    const result = parseHelpCommand("--features");
    expect(result).not.toBeNull();
    expect(result).toContain("Features");
  });

  it("recognizes --blur alias for features", () => {
    const result = parseHelpCommand("--blur");
    expect(result).not.toBeNull();
    expect(result).toContain("Features");
  });

  it("recognizes --reasoning command", () => {
    const result = parseHelpCommand("--reasoning");
    expect(result).not.toBeNull();
    expect(result).toContain("Reasoning Levels");
  });

  it("recognizes --voices command", () => {
    const result = parseHelpCommand("--voices");
    expect(result).not.toBeNull();
    expect(result).toContain("Prompt Voices");
  });

  it("recognizes individual voice commands", () => {
    const result = parseHelpCommand("--teacher");
    expect(result).not.toBeNull();
    expect(result).toContain("Patient Teacher");
  });

  it("recognizes voice commands with underscores", () => {
    const result = parseHelpCommand("--senior-engineer");
    expect(result).not.toBeNull();
    expect(result).toContain("Senior Engineer");
  });

  it("recognizes voice commands with underscores (alternative format)", () => {
    const result = parseHelpCommand("--senior_engineer");
    expect(result).not.toBeNull();
    expect(result).toContain("Senior Engineer");
  });

  it("recognizes --default voice command", () => {
    const result = parseHelpCommand("--default");
    expect(result).not.toBeNull();
    expect(result).toContain("Default");
  });

  it("recognizes --simplifier voice command", () => {
    const result = parseHelpCommand("--simplifier");
    expect(result).not.toBeNull();
    expect(result).toContain("Simple Language");
  });

  it("recognizes --in-depth voice command", () => {
    const result = parseHelpCommand("--in-depth");
    expect(result).not.toBeNull();
    expect(result).toContain("In-Depth Analyst");
  });

  it("recognizes --mla-essay voice command", () => {
    const result = parseHelpCommand("--mla-essay");
    expect(result).not.toBeNull();
    expect(result).toContain("MLA Essay");
  });

  it("recognizes --retrieval-coach voice command", () => {
    const result = parseHelpCommand("--retrieval-coach");
    expect(result).not.toBeNull();
    expect(result).toContain("Active Recall");
  });

  it("recognizes --visual-mapper voice command", () => {
    const result = parseHelpCommand("--visual-mapper");
    expect(result).not.toBeNull();
    expect(result).toContain("Visual Mapper");
  });

  it("recognizes --setup-guide voice command", () => {
    const result = parseHelpCommand("--setup-guide");
    expect(result).not.toBeNull();
    expect(result).toContain("Setup Guide");
  });

  it("is case-insensitive", () => {
    const result1 = parseHelpCommand("--HELP");
    const result2 = parseHelpCommand("--Help");
    const result3 = parseHelpCommand("--help");
    
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result3).not.toBeNull();
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it("handles unknown commands by showing main help menu", () => {
    const result = parseHelpCommand("--unknown-command");
    expect(result).not.toBeNull();
    expect(result).toContain("Docs Summarizer Help");
    expect(result).toContain("Available Commands");
  });

  it("handles commands with extra whitespace", () => {
    const result = parseHelpCommand("  --help  ");
    expect(result).not.toBeNull();
    expect(result).toContain("Docs Summarizer Help");
  });

  it("handles commands with additional text (only uses first word)", () => {
    const result = parseHelpCommand("--help more text here");
    expect(result).not.toBeNull();
    expect(result).toContain("Docs Summarizer Help");
  });
});


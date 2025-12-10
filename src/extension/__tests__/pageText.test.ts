/** @jest-environment jsdom */
import { setPageTextForLinks, getPageTextForLinks } from "../pageText";

describe("pageText", () => {
  beforeEach(() => {
    // Reset state between tests
    setPageTextForLinks("");
  });

  test("setPageTextForLinks stores text correctly", () => {
    setPageTextForLinks("Sample page text");
    expect(getPageTextForLinks()).toBe("Sample page text");
  });

  test("getPageTextForLinks returns empty string when never set", () => {
    expect(getPageTextForLinks()).toBe("");
  });

  test("setPageTextForLinks overwrites previous value", () => {
    setPageTextForLinks("First text");
    expect(getPageTextForLinks()).toBe("First text");

    setPageTextForLinks("Second text");
    expect(getPageTextForLinks()).toBe("Second text");
  });

  test("setPageTextForLinks handles empty string", () => {
    setPageTextForLinks("Some text");
    setPageTextForLinks("");
    expect(getPageTextForLinks()).toBe("");
  });

  test("setPageTextForLinks handles null/undefined by converting to empty string", () => {
    setPageTextForLinks(null as any);
    expect(getPageTextForLinks()).toBe("");

    setPageTextForLinks(undefined as any);
    expect(getPageTextForLinks()).toBe("");
  });

  test("setPageTextForLinks handles very long text", () => {
    const longText = "a".repeat(10000);
    setPageTextForLinks(longText);
    expect(getPageTextForLinks()).toBe(longText);
    expect(getPageTextForLinks().length).toBe(10000);
  });

  test("setPageTextForLinks preserves whitespace and special characters", () => {
    const textWithSpecialChars = "Text with\nnewlines\tand\ttabs and (parentheses) [brackets]";
    setPageTextForLinks(textWithSpecialChars);
    expect(getPageTextForLinks()).toBe(textWithSpecialChars);
  });
});


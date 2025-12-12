/** @jest-environment jsdom */

import { exportMessageAsMarkdown, exportMessageAsPDF } from "../export";
import type { Message } from "../types";

// Mock URL.createObjectURL and document methods
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

describe("exportMessageAsMarkdown", () => {
  let mockAnchor: HTMLAnchorElement;
  let appendChildSpy: jest.SpyInstance;
  let removeChildSpy: jest.SpyInstance;
  let clickSpy: jest.SpyInstance;
  let createElementSpy: jest.SpyInstance;

  beforeEach(() => {
    mockAnchor = document.createElement("a");
    clickSpy = jest.spyOn(mockAnchor, "click").mockImplementation(() => {});
    
    createElementSpy = jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return mockAnchor;
      }
      return document.createElement(tagName);
    });

    appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("exports assistant message as markdown file", () => {
    const msg: Message = {
      id: "test-1",
      role: "assistant",
      text: "This is a test summary.\n\nWith multiple paragraphs.",
      voiceId: "teacher",
      responseTime: 2.5,
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.0001,
      },
    };

    exportMessageAsMarkdown(msg);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();

    // Verify blob was created with correct content
    const blobCall = (global.URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(blobCall).toBeInstanceOf(Blob);
    expect(blobCall.type).toBe("text/markdown;charset=utf-8");
  });

  test("does not export user messages", () => {
    const msg: Message = {
      id: "test-2",
      role: "user",
      text: "User question",
    };

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    exportMessageAsMarkdown(msg);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Docs Summarizer] Can only export assistant messages"
    );
    expect(createElementSpy).not.toHaveBeenCalledWith("a");
  });

  test("generates filename with timestamp and voice", () => {
    const msg: Message = {
      id: "test-3",
      role: "assistant",
      text: "Test",
      voiceId: "senior_engineer",
    };

    exportMessageAsMarkdown(msg);

    expect(mockAnchor.download).toContain("docs-summary");
    expect(mockAnchor.download).toContain("senior-engineer");
    expect(mockAnchor.download).toMatch(/\.md$/);
  });
});

describe("exportMessageAsPDF", () => {
  let mockWindow: any;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock document.body methods
    jest.spyOn(document.body, "appendChild").mockImplementation(() => ({} as any));
    jest.spyOn(document.body, "removeChild").mockImplementation(() => ({} as any));

    mockWindow = {
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
      print: jest.fn(),
      close: jest.fn(),
      onload: null as any,
    };

    openSpy = jest.spyOn(window, "open").mockReturnValue(mockWindow as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("opens print window for assistant messages", () => {
    const msg: Message = {
      id: "test-1",
      role: "assistant",
      text: "This is a test summary.",
      voiceId: "teacher",
    };

    exportMessageAsPDF(msg);

    expect(openSpy).toHaveBeenCalledWith("", "_blank");
  });

  test("does not export user messages", () => {
    const msg: Message = {
      id: "test-2",
      role: "user",
      text: "User question",
    };

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    exportMessageAsPDF(msg);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Docs Summarizer] Can only export assistant messages"
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  test("handles window.open failure gracefully", () => {
    openSpy.mockReturnValue(null);

    const msg: Message = {
      id: "test-3",
      role: "assistant",
      text: "Test",
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    exportMessageAsPDF(msg);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Docs Summarizer] Could not open print window"
    );
  });
});


/** @jest-environment jsdom */
import { renderMessages } from "../ui/messages";
import type { Message } from "../types";
import { PROMPT_VOICES } from "../prompts/voices";

describe("renderMessages", () => {
  let main: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    main = document.createElement("div");
    document.body.appendChild(main);
  });

  test("shows placeholder when no messages", () => {
    renderMessages(main, []);
    
    expect(main.innerHTML).toContain("Summarize page");
    expect(main.innerHTML).toContain("get started");
  });

  test("renders user message on the right with blue background", () => {
    const messages: Message[] = [
      {
        id: "user-1",
        role: "user",
        text: "Test question",
      },
    ];

    renderMessages(main, messages);

    const rows = main.querySelectorAll("div");
    expect(rows.length).toBeGreaterThan(0);
    
    const userRow = Array.from(rows).find((row) => {
      const bubble = row.querySelector("div");
      return bubble && bubble.textContent === "Test question";
    });
    
    expect(userRow).toBeDefined();
    if (userRow) {
      const bubble = userRow.querySelector("div");
      expect(bubble?.style.background).toBe("rgb(37, 99, 235)"); // #2563eb
      expect(bubble?.textContent).toBe("Test question");
    }
  });

  test("renders assistant message on the left with dark background", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "Test response",
      },
    ];

    renderMessages(main, messages);

    const rows = main.querySelectorAll("div");
    const assistantRow = Array.from(rows).find((row) => {
      const bubble = row.querySelector("div");
      return bubble && bubble.textContent?.includes("Test response");
    });
    
    expect(assistantRow).toBeDefined();
    if (assistantRow) {
      const bubble = assistantRow.querySelector("div");
      expect(bubble?.style.background).toBe("rgb(29, 29, 29)"); // #1d1d1d
    }
  });

  test("includes prompt voice name in metadata when voiceId is provided", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "Test response",
        voiceId: "visual_mapper",
        responseTime: 1.5,
      },
    ];

    renderMessages(main, messages);

    const bubble = main.querySelector("div > div");
    expect(bubble).toBeDefined();
    
    // Check that the voice label appears in the metadata
    const voiceLabel = PROMPT_VOICES.find(v => v.id === "visual_mapper")?.label;
    expect(voiceLabel).toBe("Visual Mapper");
    
    // The voice should appear in the metadata, not in the title
    const html = main.innerHTML;
    expect(html).toContain("Visual Mapper");
    // Should not appear as a heading in the content
    expect(html).not.toContain("## Summary (Visual Mapper)");
  });

  test("includes prompt voice name in metadata for default voice", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "Test response",
        voiceId: "default",
        responseTime: 1.5,
      },
    ];

    renderMessages(main, messages);

    const html = main.innerHTML;
    const voiceLabel = PROMPT_VOICES.find(v => v.id === "default")?.label;
    expect(voiceLabel).toBe("Default");
    expect(html).toContain("Default");
    // Should not appear as a heading
    expect(html).not.toContain("## Summary (Default)");
  });

  test("handles missing voiceId gracefully", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "Test response",
        // No voiceId
      },
    ];

    renderMessages(main, messages);

    const bubble = main.querySelector("div > div");
    expect(bubble).toBeDefined();
    // Should still render without error
    expect(bubble?.textContent || bubble?.innerHTML).toContain("Test response");
  });
});


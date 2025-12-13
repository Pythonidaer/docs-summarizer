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
      expect(bubble?.style.background).toBe("rgb(74, 85, 104)"); // #4a5568 (muted grey/blue)
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

  test("renders loading indicator for assistant message with loading flag", () => {
    const messages: Message[] = [
      {
        id: "loading-1",
        role: "assistant",
        text: "",
        loading: true,
      },
    ];

    renderMessages(main, messages);

    const rows = main.querySelectorAll("div");
    expect(rows.length).toBeGreaterThan(0);
    
    const assistantRow = Array.from(rows).find((row) => {
      const bubble = row.querySelector("div");
      // Loading messages have transparent background
      return bubble && (bubble.style.background === "transparent" || bubble.style.background === "rgba(0, 0, 0, 0)");
    });
    
    expect(assistantRow).toBeDefined();
    if (assistantRow) {
      const bubble = assistantRow.querySelector("div");
      expect(bubble).toBeDefined();
      
      // Should have transparent background
      expect(bubble?.style.background === "transparent" || bubble?.style.background === "rgba(0, 0, 0, 0)").toBe(true);
      
      // Should contain loading indicator (three pulsing circles)
      const loadingIndicator = bubble?.querySelector(".docs-summarizer-loading");
      expect(loadingIndicator).toBeDefined();
      
      // Should have three circles
      const circles = loadingIndicator?.querySelectorAll(".docs-summarizer-loading-dot");
      expect(circles?.length).toBe(3);
    }
  });

  test("loading indicator appears on left side (assistant side)", () => {
    const messages: Message[] = [
      {
        id: "loading-1",
        role: "assistant",
        text: "",
        loading: true,
      },
    ];

    renderMessages(main, messages);

    const rows = main.querySelectorAll("div");
    const assistantRow = Array.from(rows).find((row) => {
      return row.style.justifyContent === "flex-start"; // Left-aligned
    });
    
    expect(assistantRow).toBeDefined();
  });

  test("loading indicator has correct styling", () => {
    const messages: Message[] = [
      {
        id: "loading-1",
        role: "assistant",
        text: "",
        loading: true,
      },
    ];

    renderMessages(main, messages);

    const loadingIndicator = main.querySelector(".docs-summarizer-loading");
    expect(loadingIndicator).toBeDefined();
    
    // Check that it has display flex
    expect((loadingIndicator as HTMLElement)?.style.display).toBe("flex");
    
    // Check circles have animation
    const circles = loadingIndicator?.querySelectorAll(".docs-summarizer-loading-dot");
    circles?.forEach((circle, index) => {
      const circleEl = circle as HTMLElement;
      expect(circleEl.style.animation).toContain("pulse");
      // Each circle should have a delay for sequential animation
      if (index > 0) {
        expect(circleEl.style.animationDelay).toBeTruthy();
      }
    });
  });

  test("does not show loading indicator for non-loading messages", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        text: "Normal response",
        loading: false, // Explicitly not loading
      },
    ];

    renderMessages(main, messages);

    const loadingIndicator = main.querySelector(".docs-summarizer-loading");
    expect(loadingIndicator).toBeNull();
    
    // Should show normal text instead
    expect(main.textContent).toContain("Normal response");
  });

  test("loading indicator does not show metadata", () => {
    const messages: Message[] = [
      {
        id: "loading-1",
        role: "assistant",
        text: "",
        loading: true,
        responseTime: 1.5, // Even if metadata exists, shouldn't show for loading
      },
    ];

    renderMessages(main, messages);

    // Should not have metadata container
    const metadataContainer = main.querySelector('[style*="position: absolute"]');
    expect(metadataContainer).toBeNull();
  });
});


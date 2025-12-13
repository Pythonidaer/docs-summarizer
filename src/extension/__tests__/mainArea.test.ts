/** @jest-environment jsdom */

import { createMainArea } from "../ui/mainArea";
import type { Message } from "../types";

describe("createMainArea", () => {
  test("creates main area element", () => {
    const { main } = createMainArea([]);

    expect(main).toBeInstanceOf(HTMLDivElement);
    expect(main.id).toBe("docs-summarizer-main");
  });

  test("main area has correct styling", () => {
    const { main } = createMainArea([]);

    expect(main.style.flex).toBe("1 1 auto");
    expect(main.style.overflowY).toBe("auto");
    expect(main.style.marginBottom).toBe("8px");
    expect(main.style.padding).toBe("0px 8px");
  });

  test("renders initial messages", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        text: "Hello",
      },
      {
        id: "2",
        role: "assistant",
        text: "Hi there!",
      },
    ];

    const { main } = createMainArea(messages);

    // Should have rendered message bubbles
    expect(main.children.length).toBeGreaterThan(0);
  });

  test("renders empty state when no messages", () => {
    const { main } = createMainArea([]);

    // Should show placeholder text
    const placeholder = main.querySelector("div");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain("Summarize");
    expect(placeholder?.textContent).toContain("--help");
  });
});


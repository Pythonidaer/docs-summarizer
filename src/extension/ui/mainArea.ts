// src/extension/ui/mainArea.ts
import { renderMessages } from "./messages";
import type { Message } from "../types";

export interface MainAreaElements {
  main: HTMLDivElement;
}

/**
 * Creates the scrollable main area and renders the initial messages.
 */
export function createMainArea(initialMessages: Message[]): MainAreaElements {
  const main = document.createElement("div");
  main.id = "docs-summarizer-main";

  Object.assign(main.style, {
    flex: "1 1 auto",
    overflowY: "auto",
    marginBottom: "8px",
    padding: "0 8px",
  } as CSSStyleDeclaration);

  renderMessages(main, initialMessages);

  return { main };
}

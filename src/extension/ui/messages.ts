import type { Message } from "../types";
import { renderMarkdownInto } from "../markdown";

export function renderMessages(main: HTMLElement, msgs: Message[]): void {
    main.innerHTML = "";

    if (msgs.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.textContent = "Click \"Summarize page\" or send a question to get started.";
        Object.assign(placeholder.style, {
            opacity: "0.7",
            fontSize: "13px"
        } as CSSStyleDeclaration);
        main.appendChild(placeholder);
        return;
    }

    for (const msg of msgs) {
        const row = document.createElement("div");
        Object.assign(row.style, {
            marginBottom: "8px",
            display: "flex",
            width: "100%",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
        } as CSSStyleDeclaration);

        const bubble = document.createElement("div");
        Object.assign(bubble.style, {
            maxWidth: "80%",
            padding: "8px",
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
            lineHeight: "1.4",
            background: msg.role === "user" ? "#2563eb" : "#1d1d1d",
            color: "#f5f5f5",
            border: msg.role === "user"
                ? "1px solid rgba(255,255,255,0.15)"
                : "1px solid rgba(255,255,255,0.06)",
            fontSize: "13px"
        } as CSSStyleDeclaration);

        if (msg.role === "assistant") {
            // Render assistant messages with simple markdown formatting
            renderMarkdownInto(bubble, msg.text);
        } else {
            // User messages stay as plain text
            bubble.textContent = msg.text;
        }

        row.appendChild(bubble);
        main.appendChild(row);
    }

    main.scrollTop = main.scrollHeight;
}
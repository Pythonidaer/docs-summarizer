// Tiny POC: inject a button that logs when clicked.
// No OpenAI, no TDD here yet -- just wiring the extension.
import { logInfo } from "./utils/log";
import type { Message } from "./types";
import {
  DRAWER_ROOT_ID,
  DRAWER_PANEL_ID,
  DRAWER_HANDLE_ID,
  DRAWER_WIDTH_PX,
  DEFAULT_INSTRUCTIONS,
} from "./constants";
import { setPageTextForLinks } from "./pageText";
import { renderMarkdownInto } from "./markdown";
import { clearAllHighlights } from "./highlight";
import { summarizeWithOpenAI, chatWithOpenAI } from "./openai";


logInfo("content script loaded (esbuild bundle)");
// Local copy for the POC - mirrors the tested extractPageText logic.
function extractPageTextFromDoc(doc: Document): string {
    const body = doc.body;
    if (!body) return "";

    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style").forEach((el) => el.remove());

    const raw = 
        // innerText in real browsers
        (clone as any).innerText ??
        // fallback for jsdom or older environments
        clone.textContent ??
        "";

    return raw.replace(/\s+/g, " ").trim();
}

let useCustomInstructions = false;
let customInstructions = '';


// ------------ UI wiring: Drawer v2.1 --------------

let messages: Message[] = [];

function renderMessages(main: HTMLElement, msgs: Message[]): void {
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

function setDrawerOpen(
    root: HTMLElement,
    drawer: HTMLElement,
    handle: HTMLElement,
    isOpen: boolean
) {
    // Slide drawer in/out
    drawer.style.transform = isOpen ? "translateX(0)" : "translateX(100%)";

    // Move handle so it stays attached to the drawer edge and visible
    // Closed: handle hugs the right edge of the viewport
    // open: handle sits DRAWER_WIDTH_PX into the viewport, at the drawer's inner edge
    handle.style.right = isOpen ? `${DRAWER_WIDTH_PX}px` : "0";

    // Update arrow direction
    // From the right edge: "<" sugests open, ">" suggests closed
    handle.textContent = isOpen ? ">" : "<";

    // Optional: a class on root if we want later styling hooks
    if (isOpen) {
        root.classList.add("docs-summarizer--open");
    } else {
        root.classList.remove("docs-summarizer--open");
    }
}

function createDrawerUI() {
    // Avoid creating multiple drawers if script runs twice
    if (document.getElementById(DRAWER_ROOT_ID)) return;

    const pageText = extractPageTextFromDoc(document);
    setPageTextForLinks(pageText);

    const root = document.createElement("div");
    root.id = DRAWER_ROOT_ID;

    // Base root styles (just a transparent container)
    Object.assign(root.style, {
        position: "fixed",
        top: "0",
        right: "0",
        height: "100%",
        width: "0", // let drawer define its width
        zIndex: "999999",
        pointerEvents: "none", // children will override
    } as CSSStyleDeclaration);

    // Handle: small vertical tab on the right edge
    const handle = document.createElement("div");
    handle.id = DRAWER_HANDLE_ID;
    handle.textContent = "<"; // starting closed-from-right visua

    Object.assign(handle.style, {
        position: "fixed",
        top: "50%",
        right: "0",
        transform: "translateY(-50%)",
        width: "24px",
        height: "80px",
        background: "#1a1a1a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "8px 0 0 8px",
        boxShadow: "0 0 6px rgba(0,0,0,0.4)",
        cursor: "pointer",
        pointerEvents: "auto",
        fontSize: "18px",
        userSelect: "none",
        transition: "right 0.2s ease-out, transform 0.2s ease-out"
    } as CSSStyleDeclaration);


    // Drawer panel: slides in from right
    const drawer = document.createElement("div");
    drawer.id = DRAWER_PANEL_ID;
    
    Object.assign(drawer.style, {
        position: "fixed",
        top: "0",
        right: "0",
        height: "100%",
        width: `${DRAWER_WIDTH_PX}px`,
        maxWidth: "80vw",
        background: "#121212",
        color: "#f5f5f5",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        boxSizing: "border-box",
        transform: "translateX(100%)", // start hidden off-screen
        transition: "transform 0.2s ease-out",
        pointerEvents: "auto",
        fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        fontSize: "14px"
    } as CSSStyleDeclaration);

    const content = document.createElement("div");
    Object.assign(content.style, {
        height: "100%",
        width: "100%",         
        maxWidth: "100%",      
        margin: "0",           
        display: "flex",
        flexDirection: "column"
    } as CSSStyleDeclaration);

    const style = document.createElement("style");
    style.textContent = `
        #docs-summarizer-main h1 {
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: 700;
            font-size: 18px;
            color: #f9fafb;
        }

        #docs-summarizer-main h2 {
            margin-top: 18px;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 16px;
            color: #f9fafb;
        }

        #docs-summarizer-main h3 {
            margin-top: 16px;
            margin-bottom: 6px;
            font-weight: 600;
            font-size: 14px;
            color: #f9fafb;
        }

        #docs-summarizer-main p {
            margin-top: 10px;
            margin-bottom: 10px;
            line-height: 1.5;
            color: #e5e7eb;
        }

        #docs-summarizer-main ul,
        #docs-summarizer-main ol {
            margin: 10px 0;
            padding-left: 20px;
        }

        #docs-summarizer-main li {
            margin-bottom: 4px;
        }

        #docs-summarizer-main pre {
            margin: 12px 0;
            padding: 10px;
            background: #000;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid rgba(255,255,255,0.15);
            color: #f9fafb;
        }

        #docs-summarizer-main code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 13px;
            line-height: 1.45;
        }

        .docs-summarizer-page-highlight {
            outline: 2px solid #f97316 !important;
            background-color: rgba(249, 115, 22, 0.12) !important;
            transition: background-color 0.2s ease-out, outline-color 0.2s ease-out;
        }
    `;

    // Temporary header content to visually confirm drawer
    const header = document.createElement("div");
    Object.assign(header.style, {
        fontWeight: "600",
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    } as CSSStyleDeclaration);
    header.textContent = "Docs Summarizer";

    // Simple close button (optional for later)
    const closeButton = document.createElement("button");
    closeButton.textContent = "x";
    Object.assign(closeButton.style, {
        marginLeft: "8px",
        border: "none",
        background: "transparent",
        color: "#f5f5f5",
        fontSize: "16px",
        cursor: "pointer"
    } as CSSStyleDeclaration);

    // Wrap title + close button
    const headerLeft = document.createElement("div");
    headerLeft.textContent = "Docs Summarizer";
    header.replaceChildren(headerLeft, closeButton);

    // v3.2: custom instructions textarea (hidden by default)
    const instructionsContainer = document.createElement("div");
    Object.assign(instructionsContainer.style, {
        flex: "0 0 auto",
        display: "none", // toggled on when checkbox is checked
        marginBottom: "8px"
    } as CSSStyleDeclaration);

    const instructionsTextarea = document.createElement("textarea") as HTMLTextAreaElement;
    Object.assign(instructionsTextarea.style, {
        width: "100%",
        minHeight: "60px",
        maxHeight: "140px",
        resize: "vertical",
        padding: "6px 8px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.25)",
        background: "#050505",
        color: "#f5f5f5",
        fontSize: "12px",
        fontFamily: "inherit",
        boxSizing: "border-box"
    } as CSSStyleDeclaration);

    instructionsTextarea.placeholder = "Enter custom instructions for how the assistant should behave.\n(Leave unchecked to use the default ADHD-friendly instructions.)";

    instructionsContainer.appendChild(instructionsTextarea);

    instructionsTextarea.addEventListener("input", () => {
        if (useCustomInstructions) {
            customInstructions = instructionsTextarea.value;
        }
    });

    // ----- Main content area (will be used for messages in v2.3) -----
    const main = document.createElement("div");
    main.id = "docs-summarizer-main";
    Object.assign(main.style, {
        flex: "1 1 auto",
        overflowY: "auto",
        marginBottom: "8px",
        padding: "0 8px"  
    } as CSSStyleDeclaration);

    // Initial render (no messages yet)
    renderMessages(main, messages);

    // ----- Top toolbar (Summarize + future options) -----
    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
        flex: "0 0 auto",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px"
    } as CSSStyleDeclaration);

    const toolbarLeft = document.createElement("div");
    Object.assign(toolbarLeft.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    } as CSSStyleDeclaration);

    const toolbarRight = document.createElement("div");
    Object.assign(toolbarRight.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    } as CSSStyleDeclaration);

    // v3.2: custom instructions toggle
    const instructionsLabel = document.createElement("label");
    Object.assign(instructionsLabel.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        cursor: "pointer",
        opacity: "0.9"
    } as CSSStyleDeclaration);

    const instructionsCheckbox = document.createElement("input");
    instructionsCheckbox.type = "checkbox";
    instructionsCheckbox.style.margin = "0";

        instructionsCheckbox.addEventListener("change", () => {
        useCustomInstructions = instructionsCheckbox.checked;
            // Bad implementation of Jump to inference prompt -- why?
        if (useCustomInstructions) {
            // If textarea is empty when enabling, seed it with the default so user can tweak
            if (!instructionsTextarea.value.trim()) {
                instructionsTextarea.value =
                    DEFAULT_INSTRUCTIONS +
                    "\n\n" +
                    "// You may edit these instructions.\n" +
                    "// Reminder: When referencing sections on the page, use smooth-scroll links like:\n" +
                    "// [Jump to type inference](#scroll:Type inference)\n";
            }
            customInstructions = instructionsTextarea.value;
            instructionsContainer.style.display = "block";
        } else {
            instructionsContainer.style.display = "none";
            customInstructions = "";
        }
    });

    const instructionsLabelText = document.createElement("span");
    instructionsLabelText.textContent = "Use custom instructions";

    instructionsLabel.appendChild(instructionsCheckbox);
    instructionsLabel.appendChild(instructionsLabelText);

    toolbarLeft.appendChild(instructionsLabel);

    const summarizeBtn = document.createElement("button");
    summarizeBtn.id = "docs-summarizer-summarize-btn";
    summarizeBtn.textContent = "Summarize page";

    Object.assign(summarizeBtn.style, {
        padding: "6px 10px",
        fontSize: "13px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.25)",
        background: "#10b981",
        color: "#ffffff",
        cursor: "pointer"
    } as CSSStyleDeclaration);

    // later we can add toggles here (custom instructions, blur, etc.)
    toolbarRight.appendChild(summarizeBtn);

    const clearHighlightsBtn = document.createElement("button");
    clearHighlightsBtn.textContent = "Clear highlights";
    Object.assign(clearHighlightsBtn.style, {
        padding: "6px 10px",
        fontSize: "13px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.25)",
        background: "#374151",
        color: "#ffffff",
        cursor: "pointer"
    } as CSSStyleDeclaration);

    clearHighlightsBtn.addEventListener("click", () => {
        clearAllHighlights();
    });

    toolbarRight.appendChild(clearHighlightsBtn);

    toolbar.appendChild(toolbarLeft);
    toolbar.appendChild(toolbarRight);

    // ----- Footer: chat input only -----
    const footer = document.createElement("div");
    Object.assign(footer.style, {
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
    } as CSSStyleDeclaration);

    // Row 2: Chat input + Send button
    const chatRow = document.createElement("div");
    Object.assign(chatRow.style, {
        display: "flex",
        gap: "6px"
    } as CSSStyleDeclaration);

    const chatInput = document.createElement("textarea") as HTMLTextAreaElement;
    Object.assign(chatInput.style, {
        flex: "1 1 auto",
        minHeight: "40px",
        maxHeight: "120px",
        resize: "vertical",
        padding: "6px 8px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "#050505",
        color: "#f5f5f5",
        fontSize: "13px",
        fontFamily: "inherit",
        boxSizing: "border-box"
    } as CSSStyleDeclaration);
    chatInput.placeholder = "Ask a question about this page…";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "Send";
    Object.assign(sendBtn.style, {
        padding: "6px 10px",
        fontSize: "13px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "#1f6feb",
        color: "#ffffff",
        cursor: "pointer",
        flex: "0 0 auto"
    } as CSSStyleDeclaration);

    chatRow.appendChild(chatInput);
    chatRow.appendChild(sendBtn);
    footer.appendChild(chatRow);

    // Assemble drawer
    drawer.appendChild(style);
    content.appendChild(header);
    content.appendChild(toolbar);
    content.appendChild(instructionsContainer);
    content.appendChild(main);
    content.appendChild(footer);

    drawer.appendChild(content);
    root.appendChild(handle);
    root.appendChild(drawer);
    document.body.appendChild(root);

    let isOpen = false;

    const handleSend = async () => {
        const userText = chatInput.value.trim();
        if (!userText) return;

        // Add user message to history
        messages.push({
            id: `user-${Date.now()}`,
            role: "user",
            text: userText
        });
        renderMessages(main, messages);

        chatInput.value = "";

        try {
            sendBtn.disabled = true;
            const previousLabel = sendBtn.textContent;
            sendBtn.textContent = "Sending…";

            const reply = await chatWithOpenAI(
                pageText,
                messages,
                useCustomInstructions,
                customInstructions
            );
            messages.push({
                id: `assistant-${Date.now()}`,
                role: "assistant",
                text: reply
            });
            renderMessages(main, messages);

            sendBtn.disabled = false;
            sendBtn.textContent = previousLabel;
        } catch (err: any) {
            console.error("[Docs Summarizer] Chat error:", err);
            alert(`Docs Summarizer chat error: ${err?.message ?? String(err)}`);
            sendBtn.disabled = false;
            sendBtn.textContent = "Send";
        }
    };

    sendBtn.addEventListener("click", () => {
        void handleSend();
    });

    chatInput.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    });

    const toggle = () => {
        isOpen = !isOpen;
        setDrawerOpen(root, drawer, handle, isOpen);
    };

    // Handle toggles drawer
    handle.addEventListener("click", toggle);

    // Close button also closes drawer
    closeButton.addEventListener("click", () => {
        if (!isOpen) return;
        isOpen = false;
        setDrawerOpen(root, drawer, handle, isOpen);
    });

    summarizeBtn.addEventListener("click", async () => {
        try {
            if (!pageText) {
                alert("Docs Summarizer: No text found on this page.");
                return;
            }

            summarizeBtn.disabled = true;
            const previousLabel = summarizeBtn.textContent;
            summarizeBtn.textContent = "Summarizing…";

            const summary = await summarizeWithOpenAI(
                pageText,
                useCustomInstructions,
                customInstructions
            );
            // Add a new assistant message and re-render
            messages.push({
                id: `assistant-${Date.now()}`,
                role: "assistant",
                text: summary
            });
            renderMessages(main, messages);

            summarizeBtn.textContent = previousLabel;
            summarizeBtn.disabled = false;
        } catch (err: any) {
            console.error("[Docs Summarizer] Error:", err);
            alert(`Docs Summarizer error: ${err?.message ?? String(err)}`);
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = "Summarize page";
        }
    });

    // Start closed
    setDrawerOpen(root, drawer, handle, false);
}

// Run when content script loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createDrawerUI);
} else {
    createDrawerUI();
}
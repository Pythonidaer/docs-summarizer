import { scrollToPageMatch } from "./highlight";
import { getPageTextForLinks } from "./pageText";
import { MARKDOWN_FORMAT_HINT } from "./constants";


function renderInlineMarkdown(container: HTMLElement, text: string): void {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const pageTextLower = (getPageTextForLinks() || "").toLowerCase();

    while ((match = linkRegex.exec(text)) !== null) {
        const full = match[0];
        const rawLabel = match[1] ?? "";
        const href = match[2] ?? "";
        const index = match.index;

        // Text before the link
        if (index > lastIndex) {
            const before = text.slice(lastIndex, index);
            if (before) {
                container.appendChild(document.createTextNode(before));
            }
        }

        // 1) Clean up label, e.g. "Title [scroll:Something]" -> "Title"
        const label = rawLabel.replace(/\s*\[scroll:[^\]]*\]\s*$/i, "").trim() || rawLabel;

        const HASH_PREFIX = "#scroll:";
        const PLAIN_PREFIX = "scroll:";

        let scrollTerm: string | null = null;

        // 2) Detect our internal scroll scheme only when it’s the *start* of the href
        if (href.startsWith(HASH_PREFIX)) {
            scrollTerm = href.slice(HASH_PREFIX.length);
        } else if (href.startsWith(PLAIN_PREFIX)) {
            scrollTerm = href.slice(PLAIN_PREFIX.length);
        }

        if (scrollTerm !== null) {
            // Decode and normalize
            try {
                scrollTerm = decodeURIComponent(scrollTerm).trim();
            } catch {
                scrollTerm = scrollTerm.trim();
            }

            // If no term, or the phrase does NOT appear in the page text, treat as plain text.
            if (!scrollTerm || !pageTextLower.includes(scrollTerm.toLowerCase())) {
                // Just render the cleaned label as text (no link, no URL)
                container.appendChild(document.createTextNode(label));
            } else {
                // Valid internal scroll link
                const a = document.createElement("a");
                a.textContent = label;

                // Style: internal scroll links
                a.style.cursor = "pointer";
                a.style.color = "#f97316"; // orange for internal scroll links
                a.style.textDecoration = "underline"; // REMOVE this line if you don't want underlines

                const termForClick = scrollTerm;
                a.addEventListener("click", (event) => {
                    event.preventDefault();
                    console.log("[Docs Summarizer] Scroll link clicked", {
                        label,
                        href,
                        term: termForClick
                    });
                    scrollToPageMatch(termForClick);
                });

                console.log("[Docs Summarizer] Render scroll link", {
                    label,
                    href,
                    term: scrollTerm
                });

                container.appendChild(a);
            }
        } else {
            // 3) Not a #scroll link → decide if this is a real URL
            const isProbablyUrl =
                href.startsWith("http://") ||
                href.startsWith("https://") ||
                href.startsWith("/") ||
                // Normal in-page anchors (#section), but NOT our private "#scroll:"
                (href.startsWith("#") && !href.toLowerCase().startsWith("#scroll:"));

            if (isProbablyUrl) {
                const a = document.createElement("a");
                a.textContent = label;
                a.href = href;
                a.target = "_blank";
                a.rel = "noopener noreferrer";

                // Style: external/normal URLs
                a.style.cursor = "pointer";
                a.style.color = "#93c5fd"; // light blue
                a.style.textDecoration = "underline"; // REMOVE this line if you don't want underlines

                console.log("[Docs Summarizer] Render external link", {
                    label,
                    href
                });

                container.appendChild(a);
            } else {
                // 4) Neither scroll nor sensible URL → just show the label as plain text
                console.log("[Docs Summarizer] Rendering plain text (no link)", {
                    label,
                    href
                });
                container.appendChild(document.createTextNode(label));
            }
        }

        lastIndex = index + full.length;
    }

    // Remaining text after last link
    if (lastIndex < text.length) {
        const tail = text.slice(lastIndex);
        if (tail) {
            container.appendChild(document.createTextNode(tail));
        }
    }
}

export function renderMarkdownInto(container: HTMLElement, text: string): void {
    const lines = text.split(/\r?\n/);

    let currentList: HTMLOListElement | HTMLUListElement | null = null;
    let currentCodeLines: string[] | null = null;

    const flushList = () => {
        if (currentList) {
            container.appendChild(currentList);
            currentList = null;
        }
    };

    const flushCode = () => {
        if (currentCodeLines) {
            const pre = document.createElement("pre");
            const code = document.createElement("code");
 
            // Container styles
            pre.style.margin = "6px 0";
            pre.style.padding = "8px 10px";
            pre.style.borderRadius = "6px";
            pre.style.background = "#050816"; // slightly lighter than drawer background
            pre.style.border = "1px solid rgba(255,255,255,0.14)";
            pre.style.fontSize = "12px";
            pre.style.color = "#f9fafb";      // force light text
            pre.style.overflowX = "auto";

            // Code text styles
            code.style.fontFamily =
                "SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
            code.style.whiteSpace = "pre";

            code.textContent = currentCodeLines.join("\n");
            pre.appendChild(code);
            container.appendChild(pre);
            currentCodeLines = null;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, ""); // trim right

        // Code block fences ``` toggle code mode
        if (line.trim().startsWith("```")) {
            if (currentCodeLines) {
                // closing fence
                flushCode();
            } else {
                // opening fence
                flushList();
                currentCodeLines = [];
            }
            continue;
        }

        if (currentCodeLines) {
            currentCodeLines.push(rawLine);
            continue;
        }

        // Blank line → paragraph / list separator
        if (!line.trim()) {
            flushList();
            continue;
        }

        // Headings: #, ##, ###, ####, ##### or ######
        const headingMatch = line.trimStart().match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushList();

            const [, hashes, contentRaw] = headingMatch;
            const hashesSafe = hashes || "";
            const content = contentRaw || "";

            // Map markdown levels 1–6 into visual levels 1–3
            const rawLevel = hashesSafe.length;
            const level = rawLevel === 1 ? 1 : rawLevel === 2 ? 2 : 3;

            const tag =
                level === 1 ? "h1" :
                level === 2 ? "h2" : "h3";

            const h = document.createElement(tag);
            h.textContent = content;

            h.style.fontWeight = "600";
            h.style.marginTop = level === 1 ? "20px" : "16px";
            h.style.marginBottom = "8px";
            h.style.fontSize =
                level === 1 ? "15px" :
                level === 2 ? "14px" : "14px";

            container.appendChild(h);
            continue;
        }


        // Unordered list: - item or * item
        const ulMatch = line.match(/^[-*]\s+(.*)$/);
        if (ulMatch) {
            const [, itemTextRaw] = ulMatch;
            const itemText = itemTextRaw || "";

            if (!currentList || currentList.tagName !== "UL") {
                flushList();
                currentList = document.createElement("ul");
                currentList.style.margin = "4px 0 4px 16px";
                currentList.style.paddingLeft = "16px";
            }

            const li = document.createElement("li");
            li.style.marginBottom = "2px";
            renderInlineMarkdown(li, itemText);
            currentList.appendChild(li);
            continue;
        }

        // Ordered list: 1. item or 1) item
        const olMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
        if (olMatch) {
            const [, , itemTextRaw] = olMatch;
            const itemText = itemTextRaw || "";

            if (!currentList || currentList.tagName !== "OL") {
                flushList();
                currentList = document.createElement("ol");
                currentList.style.margin = "4px 0 4px 16px";
                currentList.style.paddingLeft = "16px";
            }

            const li = document.createElement("li");
            li.style.marginBottom = "2px";
            renderInlineMarkdown(li, itemText);
            currentList.appendChild(li);
            continue;
        }

        // Fallback: paragraph
        flushList();
        const p = document.createElement("p");
        p.style.margin = "4px 0";
        p.style.fontSize = "13px";
        p.style.lineHeight = "1.5";
        renderInlineMarkdown(p, line);
        container.appendChild(p);
    }

    // Flush any remaining open structures
    flushCode();
    flushList();
}
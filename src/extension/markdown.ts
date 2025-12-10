import { scrollToPageMatch } from "./highlight";
import { getPageTextForLinks } from "./pageText";

// --- Inline markdown: links + scroll anchors ---------------------------------

function renderInlineMarkdown(container: HTMLElement, text: string): void {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

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

    // Clean label, e.g. "Title [scroll:Something]" → "Title"
    const label =
      rawLabel.replace(/\s*\[scroll:[^\]]*\]\s*$/i, "").trim() || rawLabel;

    const HASH_PREFIX = "#scroll:";
    const PLAIN_PREFIX = "scroll:";

    let scrollTerm: string | null = null;

    // Detect our internal scroll scheme only when it’s the *start* of the href
    if (href.startsWith(HASH_PREFIX)) {
      scrollTerm = href.slice(HASH_PREFIX.length);
    } else if (href.startsWith(PLAIN_PREFIX)) {
      scrollTerm = href.slice(PLAIN_PREFIX.length);
    }

    if (scrollTerm !== null) {
      // Internal scroll link
      try {
        scrollTerm = decodeURIComponent(scrollTerm).trim();
      } catch {
        scrollTerm = scrollTerm.trim();
      }

      if (!scrollTerm) {
        // Empty term → just render plain text
        container.appendChild(document.createTextNode(label));
      } else {
        // Validate that the phrase exists in the page text before rendering as a link
        const pageTextForValidation = getPageTextForLinks();
        if (!pageTextForValidation) {
          // No page text available - render as plain text
          console.warn(
            "[Docs Summarizer] Scroll link phrase validation skipped (no page text):",
            scrollTerm
          );
          container.appendChild(document.createTextNode(label));
        } else {
          // Normalize whitespace for comparison (collapse multiple spaces/newlines to single space)
          const normalizedPageText = pageTextForValidation
            .replace(/\s+/g, " ")
            .toLowerCase()
            .trim();
          const normalizedTerm = scrollTerm.replace(/\s+/g, " ").toLowerCase().trim();

          // Check if the exact phrase exists in the page text
          // Also try matching with even more lenient whitespace (for code blocks)
          const ultraNormalizedPageText = normalizedPageText.replace(/\s/g, "");
          const ultraNormalizedTerm = normalizedTerm.replace(/\s/g, "");

          const exactMatch = normalizedPageText.includes(normalizedTerm);
          const lenientMatch = ultraNormalizedPageText.includes(ultraNormalizedTerm);

          if (!exactMatch && !lenientMatch) {
            // Phrase doesn't exist - render as plain text instead of a link
            console.warn(
              "[Docs Summarizer] Scroll link phrase not found in page text, rendering as plain text:",
              scrollTerm
            );
            container.appendChild(document.createTextNode(label));
          } else {
            // Phrase exists - render as clickable link
            const a = document.createElement("a");
            a.textContent = label;
            a.style.cursor = "pointer";
            a.style.color = "#f97316"; // internal scroll links
            a.style.textDecoration = "underline";

            const termForClick = scrollTerm;
        a.addEventListener("click", (event) => {
          event.preventDefault();
          console.log("[Docs Summarizer] Scroll link clicked", {
            label,
            href,
            term: termForClick,
          });
          
          // Check if we're in a detached window (no document.body or different origin)
          const isDetachedWindow = 
            typeof chrome !== "undefined" && 
            chrome.runtime &&
            (window.location.protocol === "chrome-extension:" || 
             !document.body || 
             window.location.href.includes("detached-window.html"));
          
          if (isDetachedWindow) {
            // Send message to background script to forward to content script
            chrome.runtime.sendMessage(
              {
                type: "SCROLL_TO_PHRASE",
                phrase: termForClick,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[Docs Summarizer] Error sending scroll request:",
                    chrome.runtime.lastError
                  );
                }
              }
            );
          } else {
            // Normal content script - scroll directly
            scrollToPageMatch(termForClick);
          }
        });

            console.log("[Docs Summarizer] Render scroll link", {
              label,
              href,
              term: scrollTerm,
            });

            container.appendChild(a);
          }
        }
      }
    } else {
      // External / normal URL?
      const isProbablyUrl =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("/") ||
        (href.startsWith("#") && !href.toLowerCase().startsWith("#scroll:"));

      if (isProbablyUrl) {
        const a = document.createElement("a");
        a.textContent = label;
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.cursor = "pointer";
        a.style.color = "#93c5fd"; // external links
        a.style.textDecoration = "underline";

        console.log("[Docs Summarizer] Render external link", { label, href });

        container.appendChild(a);
      } else {
        console.log("[Docs Summarizer] Rendering plain text (no link)", {
          label,
          href,
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


// --- Block-level markdown: headings, lists, code, hr, paragraphs -------------

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
      pre.style.background = "#050816";
      pre.style.border = "1px solid rgba(255,255,255,0.14)";
      pre.style.fontSize = "12px";
      pre.style.color = "#f9fafb";
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

for (let i = 0; i < lines.length; i++) {
  const rawLine = lines[i];
  const nextLine =
    i + 1 < lines.length ? lines[i + 1]!.replace(/\s+$/, "") : null;
  const line = rawLine!.replace(/\s+$/, ""); // trim right

  // Fenced code blocks ```...```
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
    currentCodeLines.push(rawLine ?? "");
    continue;
  }

  // Horizontal rule: --- or ---- on its own line
  if (/^-{3,}$/.test(line.trim())) {
    flushList();
    const hr = document.createElement("hr");
    hr.style.border = "none";
    hr.style.borderTop = "1px solid rgba(255,255,255,0.18)";
    hr.style.margin = "12px 0";
    container.appendChild(hr);
    continue;
  }

  // Blank line → paragraph / list separator
  if (!line.trim()) {
    flushList();
    continue;
  }

  // Headings: #, ##, ###, etc.
  const headingMatch = line.trimStart().match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    flushList();

    const [, hashes, contentRaw] = headingMatch;
    const hashesSafe = hashes || "";
    const content = contentRaw || "";

    const rawLevel = hashesSafe.length;
    const level = rawLevel === 1 ? 1 : rawLevel === 2 ? 2 : 3;

    const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

    const h = document.createElement(tag);
    h.textContent = content;

    h.style.fontWeight = "600";
    h.style.marginTop = level === 1 ? "20px" : "16px";
    h.style.marginBottom = "8px";
    h.style.fontSize = level === 1 ? "15px" : "14px";

    container.appendChild(h);
    continue;
  }

  // Unordered list: - item or * item (optionally indented by up to 3 spaces)
  const ulMatch = line.match(/^\s{0,3}[-*]\s+(.*)$/);
  if (ulMatch) {
    const [, itemTextRaw] = ulMatch;
    const itemText = (itemTextRaw || "").trim();

    // Look ahead at the next line
    const nextStartsOrdered =
      nextLine !== null && /^\s{0,3}\d+[\.\)]\s+/.test(nextLine);
    const nextStartsUnordered =
      nextLine !== null && /^\s{0,3}[-*]\s+/.test(nextLine);

    // Special case: bullet ending with ":" followed by a list.
    // Treat this as a small heading instead of a bullet, to avoid:
    //   - Theoretical subfields:
    //   - Theory of computation
    //   - Information and coding theory
    if (itemText.endsWith(":") && (nextStartsOrdered || nextStartsUnordered)) {
      flushList();

      const h = document.createElement("h3");
      h.style.fontWeight = "600";
      h.style.marginTop = "12px";
      h.style.marginBottom = "4px";
      h.style.fontSize = "13px";

      const headingText = itemText.replace(/:\s*$/, "");
      renderInlineMarkdown(h, headingText);
      container.appendChild(h);
      continue;
    }

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

  // Ordered list: 1. item or 1) item (optionally indented by up to 3 spaces)
  const olMatch = line.match(/^\s{0,3}(\d+)[\.\)]\s+(.*)$/);
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

  // Fallback: paragraph or pseudo-heading before a list
  flushList();

  const trimmed = line.trim();

  const nextStartsList =
    nextLine !== null &&
    (/^\s{0,3}[-*]\s+/.test(nextLine) ||
      /^\s{0,3}\d+[\.\)]\s+/.test(nextLine));

  const looksLikeSectionTitle =
    trimmed.length > 0 &&
    trimmed.length <= 80 &&
    !/[.?!]$/.test(trimmed);

  if (nextStartsList && looksLikeSectionTitle) {
    const h = document.createElement("h3");
    h.style.fontWeight = "600";
    h.style.marginTop = "12px";
    h.style.marginBottom = "4px";
    h.style.fontSize = "13px";
    renderInlineMarkdown(h, trimmed);
    container.appendChild(h);
  } else {
    const p = document.createElement("p");
    p.style.margin = "4px 0";
    p.style.fontSize = "13px";
    p.style.lineHeight = "1.5";
    renderInlineMarkdown(p, line);
    container.appendChild(p);
  }
}


  // Flush any remaining open structures
  flushCode();
  flushList();
}

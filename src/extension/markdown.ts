import { scrollToPageMatch } from "./highlight";
import { showAlert } from "./ui/modal";
import { getPageTextForLinks } from "./pageText";

// --- Inline markdown: links + scroll anchors + bold text ---------------------

interface InlineMarkdownMatch {
  type: "link" | "bold";
  start: number;
  end: number;
  content: string;
  linkLabel?: string;
  linkHref?: string;
}

function renderInlineMarkdown(container: HTMLElement, text: string): void {
  const matches: InlineMarkdownMatch[] = [];

  // Find all links: [label](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    matches.push({
      type: "link",
      start: linkMatch.index,
      end: linkMatch.index + linkMatch[0].length,
      content: linkMatch[0],
      linkLabel: linkMatch[1] ?? "",
      linkHref: linkMatch[2] ?? "",
    });
  }

  // Find all bold text: **text** (but not inside links)
  // Use a new regex instance to avoid state issues with global flag
  const boldRegex = /\*\*([^*]+?)\*\*/g;
  let boldMatch: RegExpExecArray | null;
  // Reset regex lastIndex to ensure we start from the beginning
  boldRegex.lastIndex = 0;
  while ((boldMatch = boldRegex.exec(text)) !== null) {
    const boldStart = boldMatch.index;
    const boldEnd = boldStart + (boldMatch[0]?.length ?? 0);
    
    // Check if this bold text is inside a link
    const isInsideLink = matches.some(
      m => m.type === "link" && boldStart >= m.start && boldEnd <= m.end
    );
    
    if (!isInsideLink && boldMatch[1]) {
      matches.push({
        type: "bold",
        start: boldStart,
        end: boldEnd,
        content: boldMatch[1],
      });
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (prefer links over bold if they overlap)
  const filteredMatches: InlineMarkdownMatch[] = [];
  for (const match of matches) {
    const overlaps = filteredMatches.some(
      existing => 
        (match.start < existing.end && match.end > existing.start)
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }

  // Render matches in order
  let lastIndex = 0;
  for (const match of filteredMatches) {
    // Text before the match
    if (match.start > lastIndex) {
      const before = text.slice(lastIndex, match.start);
      if (before) {
        container.appendChild(document.createTextNode(before));
      }
    }

    // Render the match
    if (match.type === "bold") {
      const strong = document.createElement("strong");
      strong.textContent = match.content;
      strong.style.fontWeight = "600";
      container.appendChild(strong);
      lastIndex = match.end;
    } else if (match.type === "link") {
      // Handle link rendering (existing logic)
      const rawLabel = match.linkLabel ?? "";
      const href = match.linkHref ?? "";

    // Clean label, e.g. "Title [scroll:Something]" → "Title"
    // Also remove duplicate text patterns that might occur from model errors
    let label =
      rawLabel.replace(/\s*\[scroll:[^\]]*\]\s*$/i, "").trim() || rawLabel;
    
    // Remove duplicate phrases (e.g., "to Be an Artist to Be an Artist" → "to Be an Artist")
    // Also handles cases like "Hook in React 19 Hook in React 19)" → "Hook in React 19"
    // This handles cases where the model accidentally duplicates part of the phrase
    const words = label.split(/\s+/);
    if (words.length > 2) {
      // Normalize words by removing trailing punctuation for comparison (but keep original for display)
      const normalizedWords = words.map(w => w.replace(/[)\]"'`]+$/, "").toLowerCase());
      
      // Check for duplicate sequences of 2-5 words (more flexible than just 3)
      // Start with longer sequences first to catch bigger duplicates
      for (let seqLength = 5; seqLength >= 2; seqLength--) {
        for (let i = 0; i <= normalizedWords.length - seqLength; i++) {
          const sequence = normalizedWords.slice(i, i + seqLength).join(" ");
          // Look for this sequence appearing again later
          for (let j = i + seqLength; j <= normalizedWords.length - seqLength; j++) {
            const laterSequence = normalizedWords.slice(j, j + seqLength).join(" ");
            if (sequence === laterSequence) {
              // Found duplicate - remove the later occurrence (both normalized and original)
              normalizedWords.splice(j, seqLength);
              words.splice(j, seqLength);
              // Continue checking from the same position since we removed items
              j--;
            }
          }
        }
      }
      label = words.join(" ").trim();
    }
    
    // Clean up trailing punctuation that might be duplicated (e.g., "SS))" → "SS)")
    // Remove duplicate closing parentheses, brackets, or quotes at the end
    label = label.replace(/([)\]"'`])\1+$/, "$1");
    
    // Additional cleanup: remove orphaned trailing punctuation that might be left after duplicate removal
    // e.g., "Hook in React 19)" → "Hook in React 19" (if the ) was part of a duplicate)
    // This is a heuristic: if we have a single trailing punctuation after a space, it might be leftover
    label = label.replace(/\s+([)\]"'`])$/, "");

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
          // This handles &nbsp; entities and irregular spacing
          const normalizedPageText = pageTextForValidation
            .replace(/\s+/g, " ")
            .toLowerCase()
            .trim();
          const normalizedTerm = scrollTerm.replace(/\s+/g, " ").toLowerCase().trim();

          // Check if the exact phrase exists in the page text
          // Also try matching with even more lenient whitespace (for code blocks)
          const ultraNormalizedPageText = normalizedPageText.replace(/\s/g, "");
          const ultraNormalizedTerm = normalizedTerm.replace(/\s/g, "");

          // Also try matching with punctuation variations (e.g., "Night of the Long Knives" vs "Night of the Long Knives.")
          const termWithoutTrailingPunct = normalizedTerm.replace(/[.,;:!?)\]]+$/, "");
          const pageTextWithoutTrailingPunct = normalizedPageText.replace(/[.,;:!?)\]]+/g, "");

          const exactMatch = normalizedPageText.includes(normalizedTerm);
          const lenientMatch = ultraNormalizedPageText.includes(ultraNormalizedTerm);
          const punctLenientMatch = termWithoutTrailingPunct && 
            (pageTextWithoutTrailingPunct.includes(termWithoutTrailingPunct) ||
             normalizedPageText.includes(termWithoutTrailingPunct));

          if (!exactMatch && !lenientMatch && !punctLenientMatch) {
            // Phrase doesn't exist - render as plain text instead of a link
            console.warn(
              "[Docs Summarizer] Scroll link phrase not found in page text, rendering as plain text:",
              scrollTerm,
              "Tried:", normalizedTerm, "|", ultraNormalizedTerm, "|", termWithoutTrailingPunct
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
              async (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[Docs Summarizer] Error sending scroll request:",
                    chrome.runtime.lastError
                  );
                  await showAlert(
                    `Could not scroll to phrase: ${chrome.runtime.lastError.message}\n\n` +
                    "The main page may have been refreshed or closed.",
                    "Scroll Error"
                  );
                } else if (response && !response.success) {
                  // Handle error response from background script
                  console.error("[Docs Summarizer] Scroll failed:", response.error);
                  const errorMsg = response.error || "Unknown error";
                  // Check if it's a "connection lost" error that might auto-recover
                  if (errorMsg.includes("Connection lost") && errorMsg.includes("try clicking the link again")) {
                    await showAlert(
                      `Could not scroll to phrase: ${errorMsg}`,
                      "Scroll Error"
                    );
                  } else {
                    await showAlert(
                      `Could not scroll to phrase: ${errorMsg}\n\n` +
                      "The main page may have been refreshed or closed.",
                      "Scroll Error"
                    );
                  }
                }
              }
            );
          } else {
            // Normal content script - scroll directly
            void scrollToPageMatch(termForClick);
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
    lastIndex = match.end;
    }
  }

  // Remaining text after last match
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
    h.style.marginTop = level === 1 ? "24px" : level === 2 ? "20px" : "16px";
    h.style.marginBottom = level === 1 ? "12px" : level === 2 ? "10px" : "8px";
    h.style.fontSize = level === 1 ? "18px" : level === 2 ? "16px" : "14px";

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

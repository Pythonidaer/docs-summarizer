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
      let before = text.slice(lastIndex, match.start);
      
      // IMPROVED: Remove duplicate text that matches the link label (with better normalization)
      // This prevents redundant text like "phrase. [phrase.)](#scroll:...)" → just "[phrase.)](#scroll:...)"
      if (match.type === "link" && before.trim()) {
        const rawLabel = match.linkLabel ?? "";
        
        // More aggressive normalization: remove all trailing punctuation for comparison
        // This catches cases like "phrase. " matching "phrase.)"
        const normalizeForComparison = (str: string): string => {
          return str
            .trim()
            .toLowerCase()
            // Remove all trailing punctuation marks (periods, commas, closing parens, etc.)
            .replace(/[.,;:!?)\]\}]+$/, "")
            // Normalize whitespace
            .replace(/\s+/g, " ")
            .trim();
        };
        
        const normalizedBefore = normalizeForComparison(before);
        const normalizedLabel = normalizeForComparison(rawLabel);
        
        // Check if the normalized text before matches the normalized label
        // Also check if the before text is a prefix of the label (handles partial matches)
        if (normalizedBefore === normalizedLabel || 
            (normalizedLabel.startsWith(normalizedBefore) && normalizedBefore.length > 10)) {
          before = ""; // Don't render the duplicate text
        }
      }
      
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
    // And "a month a month)" → "a month"
    // This handles cases where the model accidentally duplicates part of the phrase
    const words = label.split(/\s+/);
    if (words.length > 2) {
      // Normalize words by removing leading and trailing punctuation for comparison
      // This helps match "month" with "month)" and "cells." with "cells.)"
      // IMPORTANT: Also normalize periods and other sentence-ending punctuation
      const normalizedWords = words.map(w => 
        w.replace(/^[(\['"`]+/, "")
         .replace(/[)\]"'`.,;:!?]+$/, "") // Added periods and other sentence-ending punctuation
         .toLowerCase()
         .trim()
      );
      
      // Check for duplicate sequences of 2-5 words (more flexible than just 3)
      // Start with longer sequences first to catch bigger duplicates
      // Use a set to track which indices have been removed to avoid double-processing
      const removedIndices = new Set<number>();
      
      for (let seqLength = 5; seqLength >= 2; seqLength--) {
        for (let i = 0; i <= normalizedWords.length - seqLength; i++) {
          // Skip if any word in this sequence was already removed
          if (Array.from({ length: seqLength }, (_, k) => i + k).some(idx => removedIndices.has(idx))) {
            continue;
          }
          
          const sequence = normalizedWords.slice(i, i + seqLength).join(" ").trim();
          if (!sequence) continue; // Skip empty sequences
          
          // Look for this sequence appearing again later
          for (let j = i + seqLength; j <= normalizedWords.length - seqLength; j++) {
            // Skip if any word in this sequence was already removed
            if (Array.from({ length: seqLength }, (_, k) => j + k).some(idx => removedIndices.has(idx))) {
              continue;
            }
            
            const laterSequence = normalizedWords.slice(j, j + seqLength).join(" ").trim();
            if (!laterSequence) continue; // Skip empty sequences
            
            if (sequence === laterSequence) {
              // Found duplicate - mark the later occurrence for removal
              for (let k = 0; k < seqLength; k++) {
                removedIndices.add(j + k);
              }
              // Break inner loop to avoid processing this sequence again
              break;
            }
          }
        }
      }
      
      // Rebuild label from words that weren't removed
      const cleanedWords = words.filter((_, idx) => !removedIndices.has(idx));
      label = cleanedWords.join(" ").trim();
    }
    
    // IMPROVED: More comprehensive trailing punctuation cleanup
    // Handle cases like "(UI)..)" -> "(UI)." or "(UI))" -> "(UI)"
    // First, normalize multiple trailing periods and closing parens together
    // Pattern: one or more periods, optional space, one or more closing parens
    label = label.replace(/\.+\s*\)+$/, ".");
    
    // Then handle duplicate closing punctuation at the end
    label = label.replace(/([)\]"'`.,;:!?])\1+$/, "$1");
    
    // Remove orphaned trailing punctuation after spaces
    label = label.replace(/\s+([)\]"'`.,;:!?])+$/, "");
    
    // Handle the specific pattern of periods followed by closing parens more carefully
    // Match patterns like ". )", "..)", ".)", etc. and normalize to just "."
    label = label.replace(/\.+\s*\)+$/, ".");

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
            // Phrase not found - render as plain text
            container.appendChild(document.createTextNode(label));
          } else {
            // Phrase exists - render as clickable link
            const a = document.createElement("a");
            
            // IMPROVED: Consolidated and more robust label cleaning
            // Create a single, comprehensive cleaning function
            let cleanLabel = label.trim();
            
            // Step 1: Strip leading punctuation and whitespace
            cleanLabel = cleanLabel.replace(/^[.,;:!?\s]+/, "").trim();
            
            // Step 2: Handle trailing periods and closing parens together
            // Pattern: one or more periods, optional space, one or more closing parens
            // Replace with just a single period if there were periods, otherwise remove
            cleanLabel = cleanLabel.replace(/\.+\s*\)+$/, ".");
            
            // Step 3: Handle punctuation before excess closing parens
            cleanLabel = cleanLabel.replace(/[,;:!?]\s*\)+$/, (match) => {
              // Keep the punctuation mark but remove excess closing parens
              return match[0] ?? "";
            });
            
            // Step 4: Balance parentheses - remove excess closing parens
            while (cleanLabel.endsWith(")")) {
              const openParenCount = (cleanLabel.match(/\(/g) || []).length;
              const closeParenCount = (cleanLabel.match(/\)/g) || []).length;
              if (closeParenCount <= openParenCount) break;
              cleanLabel = cleanLabel.slice(0, -1).trim();
            }
            
            // Step 5: Balance brackets
            while (cleanLabel.endsWith("]")) {
              const openBracketCount = (cleanLabel.match(/\[/g) || []).length;
              const closeBracketCount = (cleanLabel.match(/\]/g) || []).length;
              if (closeBracketCount <= openBracketCount) break;
              cleanLabel = cleanLabel.slice(0, -1).trim();
            }
            
            // Step 6: Handle duplicate trailing punctuation
            cleanLabel = cleanLabel.replace(/([)\]"'`.,;:!?])\1+$/, "$1");
            
            // Step 7: Remove orphaned punctuation after spaces
            cleanLabel = cleanLabel.replace(/\s+([)\]"'`.,;:!?])+$/, "");
            
            // Step 8: Conditional trailing punctuation removal
            // Preserve periods after balanced parentheses like "(UI)." if that matches page text
            // Otherwise, strip trailing punctuation more aggressively
            if (cleanLabel.match(/\([^)]+\)\.$/)) {
              // Ends with balanced parens + period - keep it, only strip other punctuation
              cleanLabel = cleanLabel.replace(/[,;:!?]+$/, "").trim();
            } else {
              // Strip all trailing punctuation except if it's part of balanced parens
              // Be more careful: only strip if there's clearly excess punctuation
              // Don't strip if it would break balanced parentheses
              const beforePunct = cleanLabel.replace(/[.,;:!?]+$/, "");
              const openBefore = (beforePunct.match(/\(/g) || []).length;
              const closeBefore = (beforePunct.match(/\)/g) || []).length;
              if (openBefore === closeBefore) {
                // Safe to strip - parens are balanced
                cleanLabel = cleanLabel.replace(/[.,;:!?]+$/, "").trim();
              }
            }
            
            // Step 9: Final safety - remove any remaining single trailing letters
            cleanLabel = cleanLabel.replace(/\s+[A-Za-z]\s*$/, "").trim();
            
            // Step 10: Final paren balance check
            while (cleanLabel.endsWith(")")) {
              const openParenCount = (cleanLabel.match(/\(/g) || []).length;
              const closeParenCount = (cleanLabel.match(/\)/g) || []).length;
              if (closeParenCount <= openParenCount) break;
              cleanLabel = cleanLabel.slice(0, -1).trim();
            }
            
            // Step 11: Final punctuation cleanup (preserve balanced parens + period pattern)
            if (cleanLabel.match(/\([^)]+\)\.$/)) {
              cleanLabel = cleanLabel.replace(/[,;:!?]+$/, "").trim();
            } else {
              cleanLabel = cleanLabel.replace(/[.,;:!?]+$/, "").trim();
            }
            
            a.textContent = cleanLabel;
            a.style.cursor = "pointer";
            a.style.color = "#f97316"; // internal scroll links
            a.style.textDecoration = "underline";

            // Strip trailing punctuation from the phrase to avoid range boundary issues
            // This handles cases where punctuation is in a separate text node
            // We'll match the core phrase and let the range extend naturally
            // Use the same deterministic loop-based stripping as the label
            let termForClick = scrollTerm.trim();
            let previousTerm = "";
            // Keep stripping until no more trailing punctuation is found
            while (termForClick !== previousTerm) {
              previousTerm = termForClick;
              termForClick = termForClick.replace(/[.,;:!?)\]]+$/, "").trim();
            }
            
        a.addEventListener("click", (event) => {
          event.preventDefault();
          
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

        container.appendChild(a);
      } else {
        container.appendChild(document.createTextNode(label));
      }
    }
    lastIndex = match.end;
    }
  }

  // IMPROVED: Clean up any trailing punctuation or duplicate text that might be left after the last link
  // This handles cases where there's text like ". " or ".)" after a link, or duplicate phrases
  if (lastIndex < text.length) {
    let tail = text.slice(lastIndex);
    
    // Check if the previous match was a link with a scroll target
    const lastMatch = filteredMatches[filteredMatches.length - 1];
    if (lastMatch && lastMatch.type === "link" && tail.trim()) {
      // Check if the tail contains duplicate text from the link's scroll target
      const href = lastMatch.linkHref ?? "";
      const HASH_PREFIX = "#scroll:";
      const PLAIN_PREFIX = "scroll:";
      let scrollTerm: string | null = null;
      
      if (href.startsWith(HASH_PREFIX)) {
        scrollTerm = href.slice(HASH_PREFIX.length);
      } else if (href.startsWith(PLAIN_PREFIX)) {
        scrollTerm = href.slice(PLAIN_PREFIX.length);
      }
      
      if (scrollTerm) {
        try {
          scrollTerm = decodeURIComponent(scrollTerm).trim();
        } catch {
          scrollTerm = scrollTerm.trim();
        }
        
        // Normalize for comparison
        const normalizeForComparison = (str: string): string => {
          return str
            .trim()
            .toLowerCase()
            // Remove all trailing punctuation marks
            .replace(/[.,;:!?)\]\}]+$/, "")
            // Normalize whitespace
            .replace(/\s+/g, " ")
            .trim();
        };
        
        const normalizedTail = normalizeForComparison(tail);
        const normalizedScrollTerm = normalizeForComparison(scrollTerm);
        
        // Check if the tail is a duplicate or continuation of the scroll term
        // This handles cases like "[phrase](#scroll:phrase) and phrase" or "[phrase](#scroll:phrase) phrase)"
        if (normalizedTail === normalizedScrollTerm || 
            normalizedScrollTerm.endsWith(normalizedTail) ||
            normalizedTail.startsWith(normalizedScrollTerm)) {
          // Tail is a duplicate of the scroll term - remove it
          tail = "";
        } else {
          // Check if tail starts with "and " or "or " followed by part of the scroll term
          // This handles cases like "[phrase](#scroll:phrase) and duplicate phrase"
          const tailWithConnector = normalizedTail.replace(/^(and|or)\s+/, "");
          if (tailWithConnector !== normalizedTail) {
            // Tail starts with "and " or "or "
            if (normalizedScrollTerm.endsWith(tailWithConnector) || 
                tailWithConnector === normalizedScrollTerm ||
                tailWithConnector.startsWith(normalizedScrollTerm)) {
              // The text after "and"/"or" duplicates the scroll term - remove it
              tail = "";
            }
          }
        }
      }
    }
    
    // If the tail is just punctuation or whitespace after a link, we might want to be more careful
    // But generally, we should render what's there unless it's clearly orphaned
    
    // Remove leading whitespace if it's just whitespace
    if (tail.trim() === "") {
      tail = ""; // Don't render pure whitespace
    } else {
      // Check if the tail starts with punctuation that might be orphaned
      // If it's just a single period or punctuation mark, it might be leftover
      const trimmedTail = tail.trim();
      if (trimmedTail.match(/^[.,;:!?)\]]+$/)) {
        // It's just punctuation - this might be orphaned from the link
        // Only remove if the previous match was a link
        if (lastMatch && lastMatch.type === "link") {
          // Check if this punctuation might be part of a sentence continuation
          // If it's just a period, keep it (might be sentence ending)
          // If it's multiple punctuation marks, it's likely orphaned
          if (trimmedTail.length > 1 || trimmedTail !== ".") {
            tail = ""; // Remove orphaned punctuation
          }
        }
      }
    }
    
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

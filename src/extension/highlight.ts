import { DRAWER_ROOT_ID } from "./constants";
import { getPageTextForLinks } from "./pageText";
import { showAlert } from "./ui/modal";

let activeHighlights: HTMLElement[] = [];

// === HIGHLIGHT STATE & HELPERS =====================================

// Inline phrase spans (exact phrase highlight inside a paragraph)
let inlineHighlights: HTMLElement[] = [];

// Block-level highlights (whole paragraph / heading, for phrases that span links)
let blockHighlights: HTMLElement[] = [];


export function findPageMatchElement(term: string): HTMLElement | null {
    const query = term.trim();
    if (!query) return null;

    // Normalize the search term: lowercase and collapse whitespace (including &nbsp;)
    // This matches the normalization used in scrollToPageMatch
    const targetLower = query.toLowerCase().replace(/\s+/g, " ").trim();
    const extensionRoot = document.getElementById(DRAWER_ROOT_ID);
    const BASE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,code,pre,figcaption,blockquote,dd,dt";

    // Normalize element text the same way: collapse all whitespace (including &nbsp;)
    // innerText already converts &nbsp; to spaces, but we normalize multiple spaces
    const getText = (el: HTMLElement): string => {
        const raw = (el.innerText || el.textContent || "").toLowerCase();
        // Normalize whitespace: collapse multiple spaces/newlines/tabs to single space
        // This handles &nbsp; (which innerText converts to space) and multiple spaces
        return raw.replace(/\s+/g, " ").trim();
    };

    /**
     * Checks if an element is actually scrollable/visible.
     * Returns true if the element can be scrolled into view, false otherwise.
     */
    const isElementScrollable = (el: HTMLElement): boolean => {
        // Check if element itself is hidden (pickBestMatch already checks this, but double-check)
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
            return false;
        }

        // Check parent chain for hidden containers
        // This catches cases where the element itself is visible but its parent nav/TOC is hidden
        let current: HTMLElement | null = el.parentElement;
        while (current && current !== document.body && current !== document.documentElement) {
            const parentStyle = window.getComputedStyle(current);
            // Check if parent is hidden
            if (parentStyle.display === "none" || parentStyle.visibility === "hidden") {
                return false;
            }
            // Check for collapsed containers (common pattern: height: 0px or maxHeight: 0px with overflow hidden)
            if (parentStyle.maxHeight === "0px" || 
                (parentStyle.height === "0px" && parentStyle.overflow !== "visible" && parentStyle.overflow !== "auto")) {
                return false;
            }
            current = current.parentElement;
        }

        // Check if element has a valid bounding box (must have at least one dimension > 0)
        // Note: In jsdom, getBoundingClientRect may return 0,0,0,0 even for visible elements,
        // so we also check if the element has content as a fallback
        const rect = el.getBoundingClientRect();
        const hasSize = rect.width > 0 || rect.height > 0;
        const hasContent = el.textContent && el.textContent.trim().length > 0;
        
        // If element has no size AND no content, it's likely not scrollable
        if (!hasSize && !hasContent) {
            return false;
        }

        // If element passes all checks, it should be scrollable
        return true;
    };

    const pickBestMatch = (nodes: HTMLElement[], allowNav: boolean): HTMLElement | null => {
        const primary: HTMLElement[] = [];
        const secondary: HTMLElement[] = [];

        for (const el of nodes) {
            // Never match inside our own drawer
            if (extensionRoot && extensionRoot.contains(el)) continue;

            // Skip hidden stuff
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") continue;

            const text = getText(el);
            // Now both text and targetLower are normalized, so includes() should work
            if (!text.includes(targetLower)) continue;

            const navLike = el.closest(
                "nav,[role='navigation'],.vector-toc,#toc,header,footer,aside,[class*='toc']"
            );
            if (!allowNav && navLike) continue;

            const inMainLikeContainer = !!el.closest(
                "main,article,[role='main'],.content,[class*='content'],.markdown-body"
            );

            if (inMainLikeContainer) {
                primary.push(el);
            } else {
                secondary.push(el);
            }
        }

        const pickShortest = (arr: HTMLElement[]): HTMLElement | null => {
            if (!arr.length) return null;
            return arr.reduce((best, el) => {
                const bestLen = getText(best).length;
                const thisLen = getText(el).length;
                return thisLen < bestLen ? el : best;
            });
        };

        return pickShortest(primary) ?? pickShortest(secondary) ?? null;
    };

    // Pass 1: structured elements, ignore nav/TOC
    const structuredNodes = Array.from(
        document.body.querySelectorAll<HTMLElement>(BASE_SELECTOR)
    );

    const first = pickBestMatch(structuredNodes, false);
    if (first) return first;

    // Pass 2: structured elements, allow nav/TOC (e.g., headings inside sidebars)
    const second = pickBestMatch(structuredNodes, true);
    if (second) {
        // CRITICAL: Before returning a nav/TOC match, verify it's actually scrollable
        // If it's hidden or not scrollable, return null so error handling kicks in
        if (!isElementScrollable(second)) {
            console.warn(
                "[Docs Summarizer] Found nav/TOC match for term but element is not scrollable/visible:",
                term,
                second
            );
            return null; // Return null so error message is shown to user
        }
        console.warn("[Docs Summarizer] Using nav/TOC match for term:", term, second);
        return second;
    }

    console.warn("[Docs Summarizer] No element match at all for term:", term);
    return null;
}

/**
 * Clear ALL highlights:
 *  - unwrap any inline <span> we injected
 *  - remove the block highlight class from any paragraph/heading
 */
export function clearAllHighlights(): void {
    // Unwrap inline spans
    for (const span of inlineHighlights) {
        const parent = span.parentNode as HTMLElement | null;
        if (!parent) continue;

        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
    }
    inlineHighlights = [];

    // Remove block-level highlight class
    for (const el of blockHighlights) {
        el.classList.remove("docs-summarizer-page-highlight");
    }
    blockHighlights = [];
}


/**
 * Scroll to the first element that matches `term` and try to highlight:
 *  - First: an exact phrase match inside a single text node
 *  - If that fails (phrase crosses links/nodes), highlight the whole element instead
 */
export async function scrollToPageMatch(term: string): Promise<void> {
  console.log("[Docs Summarizer] scrollToPageMatch called", { term });

  const rawTerm = term.trim();
  if (!rawTerm) {
    console.warn("[Docs Summarizer] Empty scroll term received");
    return;
  }

  const lowerTerm = rawTerm.toLowerCase();

  // Global guard: check against the full rendered page text first.
  // This protects us if the model invents a phrase that never appears.
  // IMPORTANT: Use CURRENT page text (not stored snapshot) because:
  // 1. Page content may have changed since validation
  // 2. Dynamic content may have loaded
  // 3. User may have interacted with the page
  // We still use the same normalization as markdown.ts for consistency
  const body = document.body;
  if (!body) {
    await showAlert("Docs Summarizer: Page body not available.", "Error");
    return;
  }
  
  // Extract current page text using same method as content-script
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style").forEach((el) => el.remove());
  const raw = ((clone as any).innerText ?? clone.textContent ?? "");
  const fullPageText = raw.replace(/\s+/g, " ").trim().toLowerCase();
  
  // Normalize whitespace for comparison (same as markdown.ts)
  const normalizedPageText = fullPageText.replace(/\s+/g, " ").trim();
  const normalizedTerm = lowerTerm.replace(/\s+/g, " ").trim();
  
  // Also try ultra-normalized (remove all whitespace) for code blocks
  const ultraNormalizedPageText = normalizedPageText.replace(/\s/g, "");
  const ultraNormalizedTerm = normalizedTerm.replace(/\s/g, "");

  const exactMatch = normalizedPageText.includes(normalizedTerm);
  const lenientMatch = ultraNormalizedPageText.includes(ultraNormalizedTerm);

  if (!exactMatch && !lenientMatch) {
    console.warn(
      "[Docs Summarizer] Scroll term not found in full page text (even with normalization):",
      rawTerm,
      "Stored text length:",
      fullPageText.length,
      "Sample:",
      fullPageText.slice(0, 200)
    );
    await showAlert(
      "Docs Summarizer could not find that phrase on this page.\n\n" +
        "The model may have referenced text that is not actually present " +
        "or the page content may have changed since the summary was generated.",
      "Phrase Not Found"
    );
    return;
  }

  // Clear previous highlights so we don't stack spans
  clearAllHighlights();

  const originalTarget = findPageMatchElement(rawTerm);
  if (!originalTarget) {
    console.warn(
      "[Docs Summarizer] No page match found for scroll target:",
      rawTerm
    );
    await showAlert(
      "Docs Summarizer could not find that phrase on this page. " +
        "The model may have referenced text that is not actually present " +
        "or used slightly different punctuation/wording.",
      "Phrase Not Found"
    );
    return;
  }

  // If findPageMatchElement somehow gave us a very large container,
  // refine to the smallest child block that actually contains the phrase.
  const BASE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,code,pre";
  const getText = (el: HTMLElement): string =>
    (el.innerText || el.textContent || "").toLowerCase();

  let target: HTMLElement = originalTarget;
  const originalTextLen = getText(originalTarget).length;

  if (
    (!originalTarget.matches(BASE_SELECTOR) || originalTextLen > 3000) &&
    lowerTerm
  ) {
    const candidates = Array.from(
      originalTarget.querySelectorAll<HTMLElement>(BASE_SELECTOR)
    ).filter((el) => getText(el).includes(lowerTerm));

    if (candidates.length > 0) {
      target = candidates.reduce((best, el) => {
        const bestLen = getText(best).length;
        const thisLen = getText(el).length;
        return thisLen < bestLen ? el : best;
      });
      console.log(
        "[Docs Summarizer] Refined fallback target to child element",
        {
          term: rawTerm,
          originalTarget,
          refinedTarget: target,
        }
      );
    }
  }

  console.log("[Docs Summarizer] Using target element for term", {
    term: rawTerm,
    target,
  });

  // Scroll the target into view
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  let foundInline = false;

  const walker = document.createTreeWalker(
    target,
    NodeFilter.SHOW_TEXT,
    null
  );

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent ?? "";
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(lowerTerm);
    if (index === -1) continue;

    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + lowerTerm.length);

    const span = document.createElement("span");
    span.style.backgroundColor = "#FFD6A5"; // Light orange/peach for spanned highlights
    span.style.borderRadius = "2px";
    span.style.padding = "0 1px";

    try {
      range.surroundContents(span);
      inlineHighlights.push(span);
      foundInline = true;
      console.log("[Docs Summarizer] Applied inline highlight", {
        term: rawTerm,
      });
    } catch (e) {
      console.warn(
        "[Docs Summarizer] Could not highlight phrase inline:",
        e
      );
    }

    // only the first inline hit
    break;
  }

  // Always highlight the whole block so the user clearly sees "look here"
  target.classList.add("docs-summarizer-page-highlight");
  blockHighlights.push(target);

  if (!foundInline) {
    console.log(
      "[Docs Summarizer] Applied block highlight only (fallback)",
      { term: rawTerm }
    );
  } else {
    console.log(
      "[Docs Summarizer] Applied inline + block highlight",
      { term: rawTerm }
    );
  }
}


// === END HIGHLIGHT STATE & HELPERS =================================


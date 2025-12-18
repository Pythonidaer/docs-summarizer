import { DRAWER_ROOT_ID } from "./constants";
import { getPageTextForLinks } from "./pageText";
import { showAlert } from "./ui/modal";
import { normalizeTextForMatchingCaseInsensitive, normalizeTextForMatching } from "./utils/textNormalization";

let activeHighlights: HTMLElement[] = [];

// === HIGHLIGHT STATE & HELPERS =====================================

// Inline phrase spans (exact phrase highlight inside a paragraph)
let inlineHighlights: HTMLElement[] = [];

// Block-level highlights (whole paragraph / heading, for phrases that span links)
let blockHighlights: HTMLElement[] = [];

/**
 * Finds a Range that spans across multiple text nodes for a phrase that crosses element boundaries.
 * This handles cases where text like "The Swift Programming Language" spans across an <a> tag.
 * 
 * IMPORTANT: This function finds the exact phrase boundaries, excluding any leading/trailing characters.
 */
function findCrossNodeRange(
  container: HTMLElement,
  normalizedTerm: string,
  normalizedIndex: number,
  rawTerm: string
): Range | null {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Accept all text nodes, including those inside inline elements like <a>, <em>, <strong>, etc.
        // We need to include text from all descendants to properly match phrases that span elements
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // First, collect all text nodes and build a complete normalized text string
  // This includes text nodes inside inline elements like <a>, <em>, etc.
  const textNodes: Array<{ node: Text; text: string; normalized: string; startCount: number }> = [];
  let normalizedCharCount = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent ?? "";
    const normalizedText = normalizeTextForMatchingCaseInsensitive(text);
    
    textNodes.push({
      node: textNode,
      text,
      normalized: normalizedText,
      startCount: normalizedCharCount
    });

    normalizedCharCount += normalizedText.length;
  }

  // CRITICAL: Find the exact phrase in the ORIGINAL concatenated text, then map to nodes
  // This ensures we find the exact phrase boundaries even when it spans inline elements
  
  // Build the concatenated original text (not normalized) to search for exact phrase
  const fullOriginalText = textNodes.map(tn => tn.text).join("");
  
  // Escape the raw term for regex (but preserve case for exact matching)
  const rawTermEscaped = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Create a regex that finds the exact phrase with word/punctuation boundaries
  const phraseRegex = new RegExp(`(^|[\\s.,;:!?)\\]])${rawTermEscaped}([\\s.,;:!?(\[]|$)`, 'i');
  
  // Also create a simpler regex without boundaries for fallback
  const simpleRegex = new RegExp(rawTermEscaped.replace(/\s+/g, '\\s+'), 'i');
  
  // Search in the concatenated original text
  let match = fullOriginalText.match(phraseRegex);
  let matchIndex = match ? (match.index ?? -1) + (match[1]?.length || 0) : -1;
  
  if (matchIndex === -1) {
    match = fullOriginalText.match(simpleRegex);
    matchIndex = match ? (match.index ?? -1) : -1;
  }
  
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  
  if (matchIndex !== -1) {
    // Found the phrase - now map the position back to individual text nodes
    const phraseEndIndex = matchIndex + rawTerm.length;
    let charCount = 0;
    
    for (let i = 0; i < textNodes.length; i++) {
      const textNodeInfo = textNodes[i];
      if (!textNodeInfo) continue;
      const { node, text } = textNodeInfo;
      const nodeStart = charCount;
      const nodeEnd = charCount + text.length;
      
      // Check if the phrase starts in this node
      if (!startNode && matchIndex >= nodeStart && matchIndex < nodeEnd) {
        startNode = node;
        startOffset = matchIndex - nodeStart;
      }
      
      // Check if the phrase ends in this node
      if (!endNode && phraseEndIndex > nodeStart && phraseEndIndex <= nodeEnd) {
        endNode = node;
        endOffset = phraseEndIndex - nodeStart;
        break; // Found both, we're done
      }
      
      charCount = nodeEnd;
    }
  }
  
  // Fallback: If we still haven't found it, use the normalized index approach
  if (!startNode || !endNode) {
    const fullNormalizedText = textNodes.map(tn => tn.normalized).join("");
    let actualNormalizedIndex = normalizedIndex;
    
    // Search for the exact term in the normalized text with boundaries
    if (normalizedIndex < 0 || normalizedIndex >= fullNormalizedText.length) {
      actualNormalizedIndex = fullNormalizedText.indexOf(normalizedTerm);
    } else {
      const substring = fullNormalizedText.substring(normalizedIndex, normalizedIndex + normalizedTerm.length);
      if (substring !== normalizedTerm) {
        actualNormalizedIndex = fullNormalizedText.indexOf(normalizedTerm);
      }
    }
    
    if (actualNormalizedIndex >= 0) {
      normalizedCharCount = 0;
      for (const textNodeInfo of textNodes) {
        const { node, text, normalized, startCount } = textNodeInfo;
        const nodeEnd = startCount + normalized.length;

        if (!startNode && actualNormalizedIndex >= startCount && actualNormalizedIndex < nodeEnd) {
          startNode = node;
          const offsetInNode = actualNormalizedIndex - startCount;
          let charCount = 0;
          for (let i = 0; i < text.length; i++) {
            const char = text[i] || "";
            const normalizedChar = normalizeTextForMatchingCaseInsensitive(char);
            if (normalizedChar.length > 0) {
              if (charCount === offsetInNode) {
                startOffset = i;
                break;
              }
              charCount++;
            }
          }
        }

        const termEndNormalized = actualNormalizedIndex + normalizedTerm.length;
        if (!endNode && termEndNormalized > startCount && termEndNormalized <= nodeEnd) {
          endNode = node;
          const offsetInNode = termEndNormalized - startCount;
          let charCount = 0;
          for (let i = 0; i < text.length; i++) {
            const char = text[i] || "";
            const normalizedChar = normalizeTextForMatchingCaseInsensitive(char);
            if (normalizedChar.length > 0) {
              charCount++;
              if (charCount >= offsetInNode) {
                endOffset = i + 1;
                break;
              }
            }
          }
          if (endOffset === 0) {
            endOffset = text.length;
          }
        }

        if (startNode && endNode) {
          break;
        }
      }
    }
  }

  // DEBUG: Log cross-node range finding details
  console.log("[DEBUG findCrossNodeRange]", {
    normalizedIndex,
    normalizedTermLength: normalizedTerm.length,
    textNodesCount: textNodes.length,
    textNodesInfo: textNodes.map((tn, idx) => ({
      index: idx,
      textLength: tn.text.length,
      normalizedLength: tn.normalized.length,
      startCount: tn.startCount,
      textSample: tn.text.slice(0, 50),
      normalizedSample: tn.normalized.slice(0, 50)
    })),
    startNodeFound: !!startNode,
    endNodeFound: !!endNode,
    startOffset,
    endOffset,
    startNodeText: startNode?.textContent?.slice(0, 50),
    endNodeText: endNode?.textContent?.slice(0, 50)
  });

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    
    // CRITICAL: Validate range contains exactly the phrase, with no leading/trailing characters
    const rangeText = range.toString();
    const rangeNormalized = normalizeTextForMatchingCaseInsensitive(rangeText);
    
    // Strip ONLY leading/trailing whitespace and unwanted punctuation for comparison
    // We want to remove leading ". " and trailing " F" but preserve valid punctuation like commas within the phrase
    // Strategy: Strip leading/trailing punctuation/whitespace that's clearly outside the phrase boundaries
    let rangeTrimmed = rangeNormalized.trim();
    
    // Strip leading punctuation/whitespace (like ". React" -> "React")
    rangeTrimmed = rangeTrimmed.replace(/^[.\s]+/, "");
    
    // Strip trailing single letters followed by punctuation/whitespace (like "components. F" -> "components")
    // But be careful - only strip if it's clearly a trailing character (single letter followed by space/punctuation)
    rangeTrimmed = rangeTrimmed.replace(/\s+[A-Za-z][.,;:!?)\]\s]*$/, "");
    
    // Strip trailing punctuation that's clearly separate (like "components. " -> "components")
    // But preserve punctuation that might be part of the phrase (like "(UI).")
    rangeTrimmed = rangeTrimmed.replace(/[.,;:!?)\]\s]+$/, "");
    
    // Final check: if there's still leading punctuation, strip it
    rangeTrimmed = rangeTrimmed.replace(/^[.,;:!?(\[\s]+/, "");
    
    // Must be exact match - no extra characters
    const isValid = rangeTrimmed === normalizedTerm;
    
    console.log("[DEBUG findCrossNodeRange Validation]", {
      rangeCreated: true,
      rangeText,
      rangeNormalized,
      rangeTrimmed,
      expectedNormalized: normalizedTerm,
      isValid,
      rangeLength: rangeText.length,
      expectedLength: rawTerm.length,
      startOffset,
      endOffset
    });
    
    // Only return range if it's valid (exact match)
    if (isValid) {
      return range;
    } else {
      console.warn("[Docs Summarizer] findCrossNodeRange created invalid range (contains extra characters), returning null", {
        rangeText,
        expectedTerm: rawTerm,
        rangeTrimmed,
        normalizedTerm
      });
      return null;
    }
  }

  console.log("[DEBUG findCrossNodeRange]", {
    rangeCreated: false,
    reason: !startNode ? "startNode not found" : "endNode not found"
  });

  return null;
}

export function findPageMatchElement(term: string): HTMLElement | null {
    const query = term.trim();
    if (!query) return null;

    // Normalize the search term using consistent normalization
    const targetNormalized = normalizeTextForMatchingCaseInsensitive(query);
    const extensionRoot = document.getElementById(DRAWER_ROOT_ID);
    const BASE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,code,pre,figcaption,blockquote,dd,dt";

    // Normalize element text using the same normalization function
    const getText = (el: HTMLElement): string => {
        const raw = el.innerText || el.textContent || "";
        return normalizeTextForMatchingCaseInsensitive(raw);
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
            // Now both text and targetNormalized are normalized consistently, so includes() should work
            if (!text.includes(targetNormalized)) continue;

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
    let foundHiddenNavMatch = false;
    
    if (second) {
        // CRITICAL: Before returning a nav/TOC match, verify it's actually scrollable
        // If it's hidden or not scrollable, continue searching in main content
        if (!isElementScrollable(second)) {
            foundHiddenNavMatch = true;
            console.warn(
                "[Docs Summarizer] Found nav/TOC match for term but element is not scrollable/visible:",
                term,
                second,
                "Continuing search in main content..."
            );
            // Don't return null - continue to search in main content areas
            // The phrase might exist in both nav and main content
        } else {
            console.warn("[Docs Summarizer] Using nav/TOC match for term:", term, second);
            return second;
        }
    }
    
    // Pass 2b: If nav/TOC match was found but not scrollable, search more aggressively in main content
    // This handles cases where the same phrase exists in both nav (hidden) and main content (visible)
    if (foundHiddenNavMatch) {
        // Search specifically in main content areas with more specific selectors
        const mainContent = document.querySelector("main,article,[role='main'],.content,[class*='content'],.markdown-body");
        if (mainContent) {
            const mainNodes = Array.from(
                mainContent.querySelectorAll<HTMLElement>(BASE_SELECTOR)
            );
            const mainMatch = pickBestMatch(mainNodes, false);
            if (mainMatch && isElementScrollable(mainMatch)) {
                console.log("[Docs Summarizer] Found main content match after rejecting hidden nav match:", term, mainMatch);
                return mainMatch;
            }
        }
        
        // Also try searching for headings specifically (common case: heading text in nav vs actual heading)
        const headingNodes = Array.from(
            document.body.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")
        ).filter((el) => {
            // Skip if in nav/TOC or our drawer
            if (extensionRoot && extensionRoot.contains(el)) return false;
            const navLike = el.closest("nav,[role='navigation'],.vector-toc,#toc,header,footer,aside,[class*='toc']");
            if (navLike) return false;
            
            // Skip hidden
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") return false;
            
            // Check if it contains the phrase
            const text = getText(el);
            return text.includes(targetNormalized);
        });
        
        if (headingNodes.length > 0) {
            // Prefer headings in main content
            const inMain = headingNodes.filter((el) =>
                !!el.closest("main,article,[role='main'],.content,[class*='content'],.markdown-body")
            );
            const bestHeading = inMain.length > 0 ? inMain[0] : headingNodes[0];
            if (bestHeading && isElementScrollable(bestHeading)) {
                console.log("[Docs Summarizer] Found heading match in main content:", term, bestHeading);
                return bestHeading;
            }
        }
    }

    // Pass 3: Fallback - search container elements (div, section, article, etc.)
    // This handles cases where text is directly in a div without a child p/li/etc
    const containerSelector = "div,section,article,main";
    const containerNodes = Array.from(
        document.body.querySelectorAll<HTMLElement>(containerSelector)
    );

    // Filter to only containers that:
    // 1. Are in main content areas (not nav/footer/header)
    // 2. Have substantial text content (at least 50 chars to avoid layout divs)
    // 3. Contain the phrase
    const validContainers = containerNodes.filter((el) => {
        // Skip if in nav/footer/header
        const navLike = el.closest("nav,[role='navigation'],.vector-toc,#toc,header,footer,aside,[class*='toc']");
        if (navLike) return false;

        // Skip if in our drawer
        if (extensionRoot && extensionRoot.contains(el)) return false;

        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;

        // Check if it contains the phrase and has substantial content
        const text = getText(el);
        return text.includes(targetNormalized) && text.length >= 50;
    });

    if (validContainers.length > 0) {
        // Prefer containers in main content areas
        const inMain = validContainers.filter((el) =>
            !!el.closest("main,article,[role='main'],.content,[class*='content'],.markdown-body")
        );

        const candidates = inMain.length > 0 ? inMain : validContainers;

        // Pick the smallest container that contains the phrase (most specific match)
        const best = candidates.reduce((best, el) => {
            const bestLen = getText(best).length;
            const thisLen = getText(el).length;
            return thisLen < bestLen ? el : best;
        });

        console.log("[Docs Summarizer] Found match in container element:", {
            term,
            element: best,
            tagName: best.tagName
        });

        // Verify it's scrollable
        if (isElementScrollable(best)) {
            return best;
        } else {
            // Found in container but not scrollable - might be collapsed/hidden
            console.warn(
                "[Docs Summarizer] Found phrase in container but element is not scrollable (may be collapsed/hidden):",
                term,
                best
            );
        }
    }

    // Final check: if we found the phrase in page text but no scrollable element,
    // it might be in collapsed/hidden content (common in SPAs)
    console.warn("[Docs Summarizer] No scrollable element match found for term:", term);
    console.warn(
        "[Docs Summarizer] This phrase exists in the page HTML but may be in collapsed/hidden content. " +
        "Try expanding navigation sections or tabs if available."
    );
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

  let rawTerm = term.trim();
  if (!rawTerm) {
    console.warn("[Docs Summarizer] Empty scroll term received");
    return;
  }

  // Strip trailing punctuation to avoid range boundary issues
  // This handles cases where punctuation like ".)" is in a separate text node
  // We'll match the core phrase and extend the range to include punctuation if it exists
  const originalTerm = rawTerm;
  rawTerm = rawTerm.replace(/[.,;:!?)\]]+$/, "").trim();
  
  if (rawTerm !== originalTerm) {
    console.log("[Docs Summarizer] Stripped trailing punctuation from scroll term", {
      original: originalTerm,
      stripped: rawTerm
    });
  }

  // Normalize term once for consistent use
  const normalizedTerm = normalizeTextForMatchingCaseInsensitive(rawTerm);

  // Global guard: check against the full rendered page text first.
  // This protects us if the model invents a phrase that never appears.
  // IMPORTANT: Use CURRENT page text (not stored snapshot) because:
  // 1. Page content may have changed since validation
  // 2. Dynamic content may have loaded
  // 3. User may have interacted with the page
  // Use consistent normalization for matching
  const body = document.body;
  if (!body) {
    await showAlert("Docs Summarizer: Page body not available.", "Error");
    return;
  }
  
  // Extract current page text using same method as content-script
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style").forEach((el) => el.remove());
  const raw = ((clone as any).innerText ?? clone.textContent ?? "");
  
  // Normalize using consistent function
  const normalizedPageText = normalizeTextForMatchingCaseInsensitive(raw);
  
  // Also try ultra-normalized (remove all whitespace) for code blocks
  const ultraNormalizedPageText = normalizedPageText.replace(/\s/g, "");
  const ultraNormalizedTerm = normalizedTerm.replace(/\s/g, "");

  const exactMatch = normalizedPageText.includes(normalizedTerm);
  const lenientMatch = ultraNormalizedPageText.includes(ultraNormalizedTerm);

  // DEBUG: Log phase 1 - validation
  console.log("[DEBUG Phase 1: Validation]", {
    rawTerm,
    normalizedTerm,
    normalizedTermLength: normalizedTerm.length,
    pageTextLength: normalizedPageText.length,
    exactMatch,
    lenientMatch,
    pageTextSample: normalizedPageText.slice(0, 500),
    searchResult: exactMatch 
      ? `Found at index ${normalizedPageText.indexOf(normalizedTerm)}`
      : "NOT FOUND"
  });

  if (!exactMatch && !lenientMatch) {
    console.warn(
      "[Docs Summarizer] Scroll term not found in full page text (even with normalization):",
      rawTerm,
      "Page text length:",
      normalizedPageText.length,
      "Sample:",
      normalizedPageText.slice(0, 200)
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
  
  // DEBUG: Log phase 2 - element finding
  if (originalTarget) {
    const elementText = originalTarget.innerText || originalTarget.textContent || "";
    const elementNormalized = normalizeTextForMatchingCaseInsensitive(elementText);
    const containsPhrase = elementNormalized.includes(normalizedTerm);
    
    console.log("[DEBUG Phase 2: Element Finding]", {
      elementFound: true,
      elementTag: originalTarget.tagName,
      elementId: originalTarget.id,
      elementClass: originalTarget.className,
      elementTextLength: elementText.length,
      elementTextSample: elementText.slice(0, 300),
      elementNormalizedSample: elementNormalized.slice(0, 300),
      containsPhrase,
      phraseIndex: containsPhrase ? elementNormalized.indexOf(normalizedTerm) : -1
    });
  } else {
    console.log("[DEBUG Phase 2: Element Finding]", {
      elementFound: false,
      reason: "findPageMatchElement returned null"
    });
  }
  
  if (!originalTarget) {
    console.warn(
      "[Docs Summarizer] No page match found for scroll target:",
      rawTerm
    );
    
    // Check if phrase exists in page text
    const phraseInPageText = normalizedPageText.includes(normalizedTerm);
    
    // Try to find if the phrase exists in collapsed/hidden elements
    let foundInCollapsedContent = false;
    if (phraseInPageText) {
      // Search for the phrase in all elements, including hidden ones
      const allElements = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
      for (const el of allElements) {
        const text = normalizeTextForMatchingCaseInsensitive(el.innerText || el.textContent || "");
        if (text.includes(normalizedTerm)) {
          const style = window.getComputedStyle(el);
          const isHidden = style.display === "none" || style.visibility === "hidden";
          const isCollapsed = style.maxHeight === "0px" || 
            (style.height === "0px" && style.overflow !== "visible" && style.overflow !== "auto");
          const hasAriaHidden = el.getAttribute("aria-hidden") === "true";
          const hasCollapsedClass = el.className.includes("collapsed") || 
            el.closest("[class*='collapsed']") !== null;
          
          // Check parent chain for collapsed/hidden containers
          let parentHidden = false;
          let current: HTMLElement | null = el.parentElement;
          while (current && current !== document.body) {
            const parentStyle = window.getComputedStyle(current);
            if (parentStyle.display === "none" || parentStyle.visibility === "hidden" ||
                parentStyle.maxHeight === "0px" ||
                (parentStyle.height === "0px" && parentStyle.overflow !== "visible" && parentStyle.overflow !== "auto")) {
              parentHidden = true;
              break;
            }
            if (current.getAttribute("aria-hidden") === "true") {
              parentHidden = true;
              break;
            }
            current = current.parentElement;
          }
          
          if (isHidden || isCollapsed || hasAriaHidden || parentHidden || hasCollapsedClass) {
            foundInCollapsedContent = true;
            console.log("[Docs Summarizer] Found phrase in collapsed/hidden element:", {
              term: rawTerm,
              element: el,
              isHidden,
              isCollapsed,
              hasAriaHidden,
              parentHidden,
              hasCollapsedClass
            });
            break;
          }
        }
      }
    }
    
    // Build user-friendly error message
    let errorMessage: string;
    if (phraseInPageText && foundInCollapsedContent) {
      errorMessage = 
        "The phrase you're looking for exists on this page, but it's currently hidden or collapsed " +
        "(like in a navigation menu that needs to be expanded, or a tab that needs to be opened).\n\n" +
        "Try expanding any collapsed sections, navigation menus, or switching between tabs if available. " +
        "Once the content is visible, the link should work.";
    } else if (phraseInPageText) {
      errorMessage = 
        "The phrase exists on this page, but we couldn't scroll to it. " +
        "This might happen if the content is in a section that needs to be expanded or navigated to.\n\n" +
        "Try looking for the phrase manually on the page, or expanding any collapsed sections if available.";
    } else {
      errorMessage = 
        "We couldn't find that exact phrase on this page. " +
        "The AI may have referenced text that doesn't match exactly, or the page content may have changed.\n\n" +
        "Try looking for similar text on the page, or ask the AI to rephrase the link.";
    }
    
    await showAlert(errorMessage, "Phrase Not Found");
    return;
  }

  // If findPageMatchElement somehow gave us a very large container,
  // refine to the smallest child block that actually contains the phrase.
  const BASE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,code,pre";
  const getText = (el: HTMLElement): string =>
    normalizeTextForMatchingCaseInsensitive(el.innerText || el.textContent || "");

  let target: HTMLElement = originalTarget;
  const originalTextLen = getText(originalTarget).length;

  if (
    (!originalTarget.matches(BASE_SELECTOR) || originalTextLen > 3000) &&
    normalizedTerm
  ) {
    const candidates = Array.from(
      originalTarget.querySelectorAll<HTMLElement>(BASE_SELECTOR)
    ).filter((el) => getText(el).includes(normalizedTerm));

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

  // First, try to find the phrase within a single text node (fast path)
  const walker = document.createTreeWalker(
    target,
    NodeFilter.SHOW_TEXT,
    null
  );

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent ?? "";
    
    // CRITICAL: Normalize text node content before matching
    // This ensures we handle HTML entities, Unicode, and whitespace consistently
    const normalizedText = normalizeTextForMatchingCaseInsensitive(text);
    const index = normalizedText.indexOf(normalizedTerm);
    
    if (index === -1) continue;

    // IMPROVED: More precise matching - find exact boundaries
    // Use regex with word boundaries to ensure we match complete phrases, not partial matches
    // This prevents including surrounding characters like leading periods or trailing punctuation
    
    let originalIndex = -1;
    let originalEndIndex = -1;
    
    // Escape special regex characters in the term, but preserve spaces for matching
    const termEscaped = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // CRITICAL: Search for the exact term with strict boundaries
    // We want to match the term exactly, ensuring we don't include leading/trailing characters
    // Use a pattern that requires word boundaries or start/end of string
    const regex = new RegExp(`(^|\\s|\\W)${termEscaped}(\\s|\\W|$)`, 'i');
    const match = text.match(regex);
    
    if (match && match.index !== undefined) {
      // Match found - account for the leading boundary capture group (match[1])
      const boundaryLength = match[1]?.length || 0;
      originalIndex = match.index + boundaryLength;
      originalEndIndex = originalIndex + rawTerm.length;
      
      // CRITICAL: Verify the extracted text is exactly what we want
      const extracted = text.substring(originalIndex, originalEndIndex);
      const extractedNormalized = normalizeTextForMatchingCaseInsensitive(extracted);
      
      // Also verify that characters before and after are boundary characters
      const charBefore = (originalIndex > 0 ? text[originalIndex - 1] : ' ') ?? ' ';
      const charAfter = (originalEndIndex < text.length ? text[originalEndIndex] : ' ') ?? ' ';
      const isBoundaryBefore = /[\s\W]/.test(charBefore) || originalIndex === 0;
      const isBoundaryAfter = /[\s\W]/.test(charAfter) || originalEndIndex === text.length;
      
      if (extractedNormalized !== normalizedTerm || !isBoundaryBefore || !isBoundaryAfter) {
        // Try finding the term without requiring leading boundary (in case it's at start)
        const regexNoLeading = new RegExp(`^${termEscaped}(\\s|\\W|$)`, 'i');
        const matchNoLeading = text.match(regexNoLeading);
        if (matchNoLeading && matchNoLeading.index !== undefined) {
          originalIndex = matchNoLeading.index;
          originalEndIndex = originalIndex + rawTerm.length;
          const extracted2 = text.substring(originalIndex, originalEndIndex);
          const extracted2Normalized = normalizeTextForMatchingCaseInsensitive(extracted2);
          const charAfter2 = (originalEndIndex < text.length ? text[originalEndIndex] : ' ') ?? ' ';
          const isBoundaryAfter2 = /[\s\W]/.test(charAfter2) || originalEndIndex === text.length;
          if (extracted2Normalized !== normalizedTerm || !isBoundaryAfter2) {
            originalIndex = -1;
            originalEndIndex = -1;
          }
        } else {
          // Normalization mismatch or boundary issue - fall through to alternative matching
          originalIndex = -1;
          originalEndIndex = -1;
        }
      }
    }
    
    // Fallback: If regex didn't work, try simple case-insensitive search
    if (originalIndex === -1 || originalEndIndex === -1) {
      const termLower = rawTerm.toLowerCase();
      const textLower = text.toLowerCase();
      const simpleIndex = textLower.indexOf(termLower);
      
      if (simpleIndex !== -1) {
        // Verify this matches the normalized position
        const simpleNormalized = normalizeTextForMatchingCaseInsensitive(text.substring(simpleIndex, simpleIndex + rawTerm.length));
        if (simpleNormalized === normalizedTerm) {
          originalIndex = simpleIndex;
          originalEndIndex = simpleIndex + rawTerm.length;
        }
      }
    }
    
    // Last resort: Use normalized position mapping for HTML entities/Unicode edge cases
    if (originalIndex === -1 || originalEndIndex === -1) {
      // Build a mapping: for each position in normalized text, track the original position
      const normalizedToOriginal: number[] = [];
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i] || "";
        const normalizedChar = normalizeTextForMatchingCaseInsensitive(char);
        
        // For each character in the normalized version, map it to original position
        if (normalizedChar.length > 0) {
          for (let j = 0; j < normalizedChar.length; j++) {
            normalizedToOriginal.push(i);
          }
        }
      }
      
      // Now find the original positions for the match
      if (index >= 0 && index < normalizedToOriginal.length) {
        const mappedIndex = normalizedToOriginal[index];
        if (mappedIndex !== undefined) {
          originalIndex = mappedIndex;
          
          // Find the end position
          const endIndex = index + normalizedTerm.length - 1;
          if (endIndex < normalizedToOriginal.length) {
            const mappedEndIndex = normalizedToOriginal[endIndex];
            if (mappedEndIndex !== undefined) {
              // Get the position after the last character
              originalEndIndex = mappedEndIndex + 1;
            } else {
              originalEndIndex = text.length;
            }
          } else {
            // Fallback: use the last position
            originalEndIndex = text.length;
          }
        }
      }
    }
    
    if (originalIndex === -1 || originalEndIndex === -1) continue;

    // CRITICAL: Verify the entire phrase is within this text node
    // If the phrase would span inline elements, we should skip single-node matching
    // and let cross-node matching handle it instead
    if (originalEndIndex > text.length) {
      // Phrase extends beyond this text node - skip to cross-node matching
      continue;
    }

    // Double-check: verify the exact text we're about to highlight
    const textToHighlight = text.substring(originalIndex, originalEndIndex);
    const textToHighlightNormalized = normalizeTextForMatchingCaseInsensitive(textToHighlight);
    
    // CRITICAL: The normalized text must exactly match our search term
    // Also check that we're not including leading/trailing characters
    const exactMatch = textToHighlightNormalized === normalizedTerm;
    if (!exactMatch) {
      // The exact match isn't in this text node - skip to cross-node matching
      continue;
    }
    
    // Additional validation: check that characters immediately before and after are boundaries
    // This prevents matching part of a larger word
    const charBefore = (originalIndex > 0 ? text[originalIndex - 1] : ' ') ?? ' ';
    const charAfter = (originalEndIndex < text.length ? text[originalEndIndex] : ' ') ?? ' ';
    const isValidBoundaryBefore = /[\s\W]/.test(charBefore) || originalIndex === 0;
    const isValidBoundaryAfter = /[\s\W]/.test(charAfter) || originalEndIndex === text.length;
    
    if (!isValidBoundaryBefore || !isValidBoundaryAfter) {
      // Not a valid word boundary - skip this match
      continue;
    }

    // CRITICAL: Do NOT extend range to include trailing punctuation from next text nodes
    // The highlight should match exactly what the link says, no more, no less
    // This ensures the highlighted text matches the link text exactly

    const range = document.createRange();
    try {
      range.setStart(textNode, originalIndex);
      range.setEnd(textNode, originalEndIndex);
      
      // CRITICAL: Verify the range contains exactly what we expect before wrapping
      const rangeText = range.toString();
      const rangeTextNormalized = normalizeTextForMatchingCaseInsensitive(rangeText);
      if (rangeTextNormalized !== normalizedTerm) {
        // Range doesn't contain the exact phrase - skip this node
        continue;
      }
    } catch (e) {
      // If range creation fails (e.g., invalid offsets), skip this node
      console.warn("[Docs Summarizer] Range creation failed", e);
      continue;
    }

    const span = document.createElement("span");
    span.className = "docs-summarizer-inline-highlight"; // Add class for CSS targeting
    span.style.backgroundColor = "#FFD6A5"; // Light orange/peach for spanned highlights
    span.style.color = "#1a1a1a"; // Dark text for readability on light background
    span.style.borderRadius = "2px";
    span.style.padding = "0 1px";

    try {
      range.surroundContents(span);
      
      // CRITICAL: Verify the span contains exactly the phrase after wrapping
      // The span's innerText should match the search term exactly, with no leading/trailing characters
      const spanInnerText = span.innerText || span.textContent || "";
      const spanInnerTextNormalized = normalizeTextForMatchingCaseInsensitive(spanInnerText);
      
      // Strip any leading/trailing whitespace and punctuation for comparison
      const spanTextTrimmed = spanInnerTextNormalized.trim();
      
      // The trimmed span text should exactly match the normalized term
      // Allow for a trailing period only if it's part of balanced parentheses like "(UI)."
      const exactMatch = spanTextTrimmed === normalizedTerm;
      const matchWithTrailingPeriod = spanTextTrimmed === normalizedTerm + "." && normalizedTerm.endsWith(")");
      
      if (!exactMatch && !matchWithTrailingPeriod) {
        // Span contains more than expected - unwrap it and skip
        console.warn("[Docs Summarizer] Span contains incorrect text after wrapping, unwrapping", {
          expected: normalizedTerm,
          actual: spanTextTrimmed,
          rawSpanText: spanInnerText,
          term: rawTerm
        });
        // Unwrap the span
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
        }
        // Skip to cross-node matching
        continue;
      }
      
      inlineHighlights.push(span);
      foundInline = true;
      console.log("[Docs Summarizer] Applied inline highlight", {
        term: rawTerm,
        highlightedText: spanInnerText
      });
      break; // Found in single text node, we're done
    } catch (e) {
      console.warn(
        "[Docs Summarizer] Could not highlight phrase inline (may span nodes):",
        e
      );
      // Continue to try cross-node matching
    }
  }

  // If single-node matching failed, try cross-node matching
  // This handles cases where text spans across inline elements (like links)
  if (!foundInline) {
    const targetRawText = target.innerText || target.textContent || "";
    const targetText = normalizeTextForMatchingCaseInsensitive(targetRawText);
    
    // CRITICAL: Find the exact phrase with proper boundaries, not just any occurrence
    // Use regex to find the phrase with word boundaries
    const termEscaped = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s|\\W)${termEscaped}(\\s|\\W|$)`, 'i');
    const match = targetRawText.match(regex);
    
    let index = -1;
    if (match && match.index !== undefined) {
      // Account for the leading boundary
      index = targetText.indexOf(normalizedTerm, match.index);
    } else {
      // Fallback: try simple indexOf
      index = targetText.indexOf(normalizedTerm);
    }
    
    // DEBUG: Log phase 3 - cross-node matching attempt
    console.log("[DEBUG Phase 3: Cross-Node Matching]", {
      singleNodeMatchFailed: true,
      targetTextLength: targetText.length,
      phraseFoundInTarget: index !== -1,
      phraseIndex: index,
      targetTextSample: targetText.slice(Math.max(0, index - 50), index + normalizedTerm.length + 50),
      matchFound: !!match,
      matchIndex: match?.index
    });
    
    if (index !== -1) {
      // Find the range that spans across multiple text nodes
      // IMPORTANT: Pass the index in the normalized target text, which should match the normalized term exactly
      const range = findCrossNodeRange(target, normalizedTerm, index, rawTerm);
      
      // DEBUG: Log range creation details
      if (range) {
        const rangeText = range.toString();
        console.log("[DEBUG Phase 3: Range Created]", {
          rangeFound: true,
          startContainer: range.startContainer.nodeName,
          startOffset: range.startOffset,
          endContainer: range.endContainer.nodeName,
          endOffset: range.endOffset,
          rangeText,
          rangeTextLength: rangeText.length,
          expectedTerm: rawTerm,
          rangeMatches: normalizeTextForMatchingCaseInsensitive(rangeText) === normalizedTerm
        });
      } else {
        console.log("[DEBUG Phase 3: Range Creation]", {
          rangeFound: false,
          reason: "findCrossNodeRange returned null"
        });
      }
      
      if (range) {
        const span = document.createElement("span");
        span.className = "docs-summarizer-inline-highlight";
        span.style.backgroundColor = "#FFD6A5";
        span.style.color = "#1a1a1a";
        span.style.borderRadius = "2px";
        span.style.padding = "0 1px";

        try {
          // Check if range spans across element boundaries (like <em> tags)
          // surroundContents() fails if the range partially selects element nodes
          const startContainer = range.startContainer;
          const endContainer = range.endContainer;
          
          // If start and end containers are different nodes, we likely span element boundaries
          // Use extractContents + insertNode which properly handles inline elements
          const spansMultipleNodes = startContainer !== endContainer;
          
          if (spansMultipleNodes || 
              startContainer.nodeType !== Node.TEXT_NODE || 
              endContainer.nodeType !== Node.TEXT_NODE) {
            // Range spans multiple nodes or includes non-text nodes - use extractContents + insertNode
            // This properly handles cases where the phrase spans inline elements like <em>
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
          } else {
            // Same text node - safe to use surroundContents
            range.surroundContents(span);
          }
          
          // CRITICAL: Verify the span contains exactly the phrase after wrapping
          // The span's innerText should match the search term exactly, with no leading/trailing characters
          const spanInnerText = span.innerText || span.textContent || "";
          const spanInnerTextNormalized = normalizeTextForMatchingCaseInsensitive(spanInnerText);
          
          // Strip any leading/trailing whitespace and punctuation for comparison
          const spanTextTrimmed = spanInnerTextNormalized.trim().replace(/^[.,;:!?)\]\s]+/, "").replace(/[.,;:!?(\[\s]+$/, "");
          
          // The trimmed span text should exactly match the normalized term
          // Allow for a trailing period only if it's part of balanced parentheses like "(UI)."
          const exactMatch = spanTextTrimmed === normalizedTerm;
          const matchWithTrailingPeriod = spanTextTrimmed === normalizedTerm + "." && normalizedTerm.endsWith(")");
          
          if (!exactMatch && !matchWithTrailingPeriod) {
            // Span contains more than expected - unwrap it and skip
            console.warn("[Docs Summarizer] Cross-node span contains incorrect text after wrapping, unwrapping", {
              expected: normalizedTerm,
              actual: spanTextTrimmed,
              rawSpanText: spanInnerText,
              term: rawTerm
            });
            // Unwrap the span
            const parent = span.parentNode;
            if (parent) {
              while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
              }
              parent.removeChild(span);
            }
            // Fall through to block highlight only
          } else {
            inlineHighlights.push(span);
            foundInline = true;
            console.log("[Docs Summarizer] Applied cross-node inline highlight", {
              term: rawTerm,
              highlightedText: spanInnerText
            });
          }
        } catch (e) {
          const errorDetails = {
            errorType: e?.constructor?.name || typeof e,
            errorMessage: e instanceof Error ? e.message : String(e),
            errorStack: e instanceof Error ? e.stack : undefined,
            rangeStart: range.startContainer.nodeName,
            rangeStartOffset: range.startOffset,
            rangeEnd: range.endContainer.nodeName,
            rangeEndOffset: range.endOffset,
            rangeText: range.toString(),
            rangeTextLength: range.toString().length,
            expectedTerm: rawTerm,
            expectedLength: rawTerm.length,
            startNodeText: range.startContainer.nodeType === Node.TEXT_NODE 
              ? (range.startContainer as Text).textContent?.slice(0, 100)
              : undefined,
            endNodeText: range.endContainer.nodeType === Node.TEXT_NODE
              ? (range.endContainer as Text).textContent?.slice(0, 100)
              : undefined
          };
          
          console.error(
            "[DEBUG Phase 3: Range.surroundContents Error]",
            errorDetails
          );
          console.warn(
            "[Docs Summarizer] Could not highlight phrase across nodes:",
            e instanceof Error ? e.message : String(e)
          );
        }
      }
    }
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


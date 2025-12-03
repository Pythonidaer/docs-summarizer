import { DRAWER_ROOT_ID } from "./constants";

let activeHighlights: HTMLElement[] = [];

// === HIGHLIGHT STATE & HELPERS =====================================

// Inline phrase spans (exact phrase highlight inside a paragraph)
let inlineHighlights: HTMLElement[] = [];

// Block-level highlights (whole paragraph / heading, for phrases that span links)
let blockHighlights: HTMLElement[] = [];


export function findPageMatchElement(term: string): HTMLElement | null {
    const query = term.trim();
    if (!query) return null;

    const targetLower = query.toLowerCase();
    const extensionRoot = document.getElementById(DRAWER_ROOT_ID);
    const BASE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,code,pre";

    const getText = (el: HTMLElement): string =>
        (el.innerText || el.textContent || "").toLowerCase();

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
export function scrollToPageMatch(term: string): void {
    console.log("[Docs Summarizer] scrollToPageMatch called", { term });

    // Clear previous highlights so we don't stack spans
    clearAllHighlights();

    const originalTarget = findPageMatchElement(term);
    if (!originalTarget) {
        console.warn("[Docs Summarizer] No page match found for scroll target:", term);
        alert(
            'Docs Summarizer could not find that phrase on this page. ' +
            'The model may have referenced text that is not actually present ' +
            'or used slightly different punctuation/wording.'
        );
        return;
    }

    const lowerTerm = term.trim().toLowerCase();

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
            console.log("[Docs Summarizer] Refined fallback target to child element", {
                term,
                originalTarget,
                refinedTarget: target
            });
        }
    }

    console.log("[Docs Summarizer] Using target element for term", { term, target });

    // Scroll the target into view
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // If term is empty, just highlight the block and return
    if (!lowerTerm) {
        target.classList.add("docs-summarizer-page-highlight");
        blockHighlights.push(target);
        console.log("[Docs Summarizer] Applied block highlight (empty term)", { term });
        return;
    }

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
        span.style.backgroundColor = "rgba(249, 115, 22, 0.12)";
        span.style.outline = "2px solid #f97316";
        span.style.borderRadius = "2px";
        span.style.padding = "0 1px";

        try {
            range.surroundContents(span);
            inlineHighlights.push(span);
            foundInline = true;
            console.log("[Docs Summarizer] Applied inline highlight", { term });
        } catch (e) {
            console.warn("[Docs Summarizer] Could not highlight phrase inline:", e);
        }

        break; // only the first inline hit
    }

    // Always highlight the whole block so the user clearly sees "look here"
    target.classList.add("docs-summarizer-page-highlight");
    blockHighlights.push(target);

    if (!foundInline) {
        console.log("[Docs Summarizer] Applied block highlight only (fallback)", { term });
    } else {
        console.log("[Docs Summarizer] Applied inline + block highlight", { term });
    }
}

// === END HIGHLIGHT STATE & HELPERS =================================


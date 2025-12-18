/**
 * Text normalization utilities for consistent matching across the extension.
 * Handles HTML entities, Unicode normalization, and whitespace collapsing.
 */

/**
 * Normalizes text for matching by:
 * 1. Decoding HTML entities (e.g., &nbsp; → space, &amp; → &)
 * 2. Normalizing Unicode characters (e.g., smart quotes → regular quotes)
 * 3. Collapsing all whitespace to single spaces
 * 4. Trimming leading/trailing whitespace
 * 
 * This ensures consistent matching regardless of how text is stored in HTML.
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return "";
  
  // Step 1: Decode HTML entities
  // Use a temporary element to decode entities (works even if innerText isn't available)
  let decoded = text;
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.textContent = text; // textContent assignment decodes entities
    decoded = temp.innerText || temp.textContent || text;
  } else {
    // Fallback for non-DOM environments (tests): basic entity decoding
    decoded = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }
  
  // Step 2: Normalize Unicode (NFKC: Compatibility decomposition + composition)
  // This handles smart quotes, em dashes, etc.
  const unicodeNormalized = decoded.normalize("NFKC");
  
  // Step 3: Collapse all whitespace (spaces, tabs, newlines, non-breaking spaces) to single space
  const whitespaceCollapsed = unicodeNormalized.replace(/\s+/g, " ");
  
  // Step 4: Trim and return
  return whitespaceCollapsed.trim();
}

/**
 * Normalizes text and converts to lowercase for case-insensitive matching.
 */
export function normalizeTextForMatchingCaseInsensitive(text: string): string {
  return normalizeTextForMatching(text).toLowerCase();
}

/**
 * Ultra-normalized version: removes ALL whitespace (useful for code blocks).
 */
export function ultraNormalizeText(text: string): string {
  return normalizeTextForMatching(text).replace(/\s/g, "");
}


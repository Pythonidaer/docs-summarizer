/** @jest-environment jsdom */

// Mock modal before importing
jest.mock("../ui/modal", () => ({
  showAlert: jest.fn().mockResolvedValue(undefined),
}));

import { findPageMatchElement, scrollToPageMatch } from "../highlight";
import { DRAWER_ROOT_ID } from "../constants";
import { showAlert } from "../ui/modal";

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

describe("findPageMatchElement", () => {
  test("finds a heading inside main and ignores drawer-root", () => {
    // Simulate the extension drawer root
    const drawer = document.createElement("div");
    drawer.id = DRAWER_ROOT_ID;
    drawer.textContent = "Ignore me";
    document.body.appendChild(drawer);

    // Simulate actual page content
    document.body.innerHTML += `
      <main>
        <h1>Target Heading</h1>
        <p>Some text here.</p>
      </main>
      <nav>Target Heading nav duplicate</nav>
    `;

    const el = findPageMatchElement("Target Heading");

    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("H1");
    expect(el!.textContent).toContain("Target Heading");
  });
});

describe("scrollToPageMatch", () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = "";
  });

  test("wraps the matched phrase in an inline highlight span", async () => {
    // Basic page content
    document.body.innerHTML = `
      <main>
        <p id="para-1">Here is some Banana pudding text in a paragraph.</p>
      </main>
    `;

    const target = document.getElementById("para-1")!;
    // jsdom doesn't implement scrollIntoView by default; stub it so the call doesn't blow up
    target.scrollIntoView = jest.fn() as any;

    // Act
    await scrollToPageMatch("Banana pudding");

    // Assert: the paragraph should now contain a span wrapping the phrase
    const span = target.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.textContent).toContain("Banana pudding");
    // Parent should still be the paragraph
    expect(span!.parentElement).toBe(target);
  });

  test("falls back to block highlight when inline highlight fails", async () => {
    document.body.innerHTML = `
      <main>
        <p id="para-2">This paragraph will trigger a fallback highlight.</p>
      </main>
    `;

    const target = document.getElementById("para-2")!;
    target.scrollIntoView = jest.fn() as any;

    // Force inline highlight to throw so that scrollToPageMatch must fall back.
    // Most implementations use Range.surroundContents; we simulate a failure there.
    const originalCreateRange = document.createRange.bind(document);
    (document as any).createRange = () => {
      const range = originalCreateRange();
      (range as any).surroundContents = () => {
        throw new Error("force inline highlight failure");
      };
      return range;
    };

    await scrollToPageMatch("fallback highlight");

    // After a forced failure, we expect the element to have the block highlight class
    expect(target.classList.contains("docs-summarizer-page-highlight")).toBe(true);

    // Restore createRange to avoid affecting other tests
    (document as any).createRange = originalCreateRange;
  });
});

describe("clearAllHighlights", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("removes all inline highlight spans created by scrollToPageMatch", async () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Text with highlighted phrase here.</p>
        <p id="p2">Another highlight there.</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    // Create highlights by calling scrollToPageMatch
    const p1 = document.getElementById("p1");
    const p2 = document.getElementById("p2");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    if (p2) p2.scrollIntoView = jest.fn() as any;
    
    await scrollToPageMatch("highlighted phrase");
    await scrollToPageMatch("highlight");

    // Verify highlights were created
    const spansBefore = document.querySelectorAll("span[style*='background-color']");
    expect(spansBefore.length).toBeGreaterThan(0);

    clearAllHighlights();

    // Spans should be unwrapped (text should remain, but spans removed)
    const remainingSpans = document.querySelectorAll("span[style*='background-color']");
    expect(remainingSpans.length).toBe(0);
    
    // Text content should still be present
    expect(document.body.textContent).toContain("highlighted phrase");
    expect(document.body.textContent).toContain("highlight");
  });

  test("removes all block highlight classes created by scrollToPageMatch", async () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Paragraph one with target text</p>
        <h2 id="h1">Heading with target text</h2>
        <p id="p2">Normal paragraph</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    const p1 = document.getElementById("p1");
    const h1 = document.getElementById("h1");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    if (h1) h1.scrollIntoView = jest.fn() as any;
    
    // Create highlights
    await scrollToPageMatch("target text");

    // Verify highlight was created
    const highlightedBefore = document.querySelectorAll(".docs-summarizer-page-highlight");
    expect(highlightedBefore.length).toBeGreaterThan(0);
    
    clearAllHighlights();

    const highlighted = document.querySelectorAll(".docs-summarizer-page-highlight");
    expect(highlighted.length).toBe(0);
    
    // Elements should still exist
    expect(document.getElementById("p1")).not.toBeNull();
    expect(document.getElementById("h1")).not.toBeNull();
    expect(document.getElementById("p1")?.classList.contains("docs-summarizer-page-highlight")).toBe(false);
  });

  test("handles empty state gracefully", () => {
    document.body.innerHTML = `<main><p>No highlights</p></main>`;

    const { clearAllHighlights } = require("../highlight");
    
    // Should not throw when no highlights exist
    expect(() => clearAllHighlights()).not.toThrow();
  });

  test("clears both inline and block highlights together", async () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Text with inline highlight phrase.</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    const p1 = document.getElementById("p1");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    
    // Create both inline and block highlights
    await scrollToPageMatch("inline highlight phrase");

    // Verify both were created
    const highlightedBefore = document.querySelectorAll(".docs-summarizer-page-highlight");
    const spansBefore = document.querySelectorAll("span[style*='background-color']");
    expect(highlightedBefore.length).toBeGreaterThan(0);
    expect(spansBefore.length).toBeGreaterThan(0);
    
    clearAllHighlights();

    const highlighted = document.querySelectorAll(".docs-summarizer-page-highlight");
    const inlineSpans = document.querySelectorAll("span[style*='background-color']");
    
    expect(highlighted.length).toBe(0);
    expect(inlineSpans.length).toBe(0);
  });

  test("can be called multiple times safely", async () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Some text with target phrase.</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    const p1 = document.getElementById("p1");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    
    await scrollToPageMatch("target phrase");
    clearAllHighlights();
    
    // Calling again should not throw
    expect(() => clearAllHighlights()).not.toThrow();
    expect(() => clearAllHighlights()).not.toThrow();
  });
});

describe("scrollToPageMatch - edge cases", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("shows alert when phrase not found in page text", async () => {
    document.body.innerHTML = `<main><p>Some text here</p></main>`;
    
    mockShowAlert.mockClear();

    await scrollToPageMatch("phrase that does not exist");

    expect(mockShowAlert).toHaveBeenCalled();
    const errorMessage = mockShowAlert.mock.calls[0]?.[0] || "";
    // Error message should indicate phrase not found (for phrases that don't exist in page text)
    expect(errorMessage).toMatch(/couldn't find|could not find|doesn't match exactly|may have referenced/i);
  });

  test("prefers main content over navigation", () => {
    document.body.innerHTML = `
      <nav>
        <h2>Target in nav</h2>
      </nav>
      <main>
        <h2>Target in nav</h2>
        <p>Some content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("Target in nav");

    expect(el).not.toBeNull();
    expect(el?.closest("main")).not.toBeNull();
    expect(el?.closest("nav")).toBeNull();
  });

  test("handles HTML entities like &nbsp; in phrase matching", () => {
    // Simulate a paragraph with &nbsp; entities
    document.body.innerHTML = `
      <main>
        <p>In one of Hitler's strokes of propaganda genius, the newly renamed&nbsp; National Socialist German Workers Party, or&nbsp; Nazi Party</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    // The phrase should match even though the HTML has &nbsp;
    const el = findPageMatchElement("the newly renamed National Socialist German Workers Party");

    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("P");
  });

  test("handles multiple spaces in phrase matching", () => {
    document.body.innerHTML = `
      <main>
        <p>This   has    multiple     spaces   between   words</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    // Should match even with normalized spacing
    const el = findPageMatchElement("has multiple spaces between");

    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("P");
  });

  test("handles very long phrases", async () => {
    const longPhrase = "This is a very long phrase that contains many words and should still work correctly when searching for matches in the page content";
    document.body.innerHTML = `
      <main>
        <p>${longPhrase}</p>
      </main>
    `;

    const { scrollToPageMatch } = require("../highlight");
    const p = document.querySelector("p");
    if (p) p.scrollIntoView = jest.fn() as any;

    await expect(scrollToPageMatch(longPhrase)).resolves.not.toThrow();
  });

  test("handles special characters in phrase", async () => {
    const specialPhrase = "Text with (parentheses) and [brackets] and {braces}";
    document.body.innerHTML = `
      <main>
        <p>${specialPhrase}</p>
      </main>
    `;

    const { scrollToPageMatch } = require("../highlight");
    const p = document.querySelector("p");
    if (p) p.scrollIntoView = jest.fn() as any;

    await expect(scrollToPageMatch(specialPhrase)).resolves.not.toThrow();
  });

  test("finds phrases in figcaption elements", () => {
    // Simulate a figure with a figcaption containing a link
    document.body.innerHTML = `
      <main>
        <figure>
          <img src="test.jpg" alt="Test image">
          <figcaption>Nails are a <a href="/wiki/Primate#Distinguishing_features" title="Primate">distinguishing feature</a> of the primate order.</figcaption>
        </figure>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    // The phrase should be found even though it's split by a link inside the figcaption
    const el = findPageMatchElement("Nails are a distinguishing feature of the primate order");

    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("FIGCAPTION");
    expect(el?.textContent).toContain("Nails are a distinguishing feature of the primate order");
  });

  test("finds phrases in figcaption with inline links", async () => {
    // Simulate the exact scenario from the user's report
    document.body.innerHTML = `
      <main>
        <figure>
          <img src="test.jpg" alt="Test image">
          <figcaption>Nails are a <a href="/wiki/Primate#Distinguishing_features" title="Primate">distinguishing feature</a> of the primate order.</figcaption>
        </figure>
      </main>
    `;

    const { scrollToPageMatch } = require("../highlight");
    const figcaption = document.querySelector("figcaption");
    if (figcaption) figcaption.scrollIntoView = jest.fn() as any;

    // Should not throw and should find the phrase
    await expect(scrollToPageMatch("Nails are a distinguishing feature of the primate order")).resolves.not.toThrow();
    
    // Verify the figcaption was found and highlighted
    const highlighted = document.querySelector(".docs-summarizer-page-highlight");
    expect(highlighted).not.toBeNull();
    expect(highlighted?.tagName).toBe("FIGCAPTION");
  });
});

describe("findPageMatchElement - nav/TOC visibility check", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("rejects nav/TOC matches that are hidden (display: none)", () => {
    document.body.innerHTML = `
      <nav style="display: none;">
        <li>nail plate</li>
      </nav>
      <main>
        <p>Some other content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail plate");

    // Should return null because nav is hidden, not find the hidden nav element
    expect(el).toBeNull();
  });

  test("rejects nav/TOC matches that are collapsed (height: 0)", () => {
    document.body.innerHTML = `
      <nav style="height: 0; overflow: hidden;">
        <li>nail matrix</li>
      </nav>
      <main>
        <p>Some other content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail matrix");

    // Should return null because nav is collapsed
    expect(el).toBeNull();
  });

  test("rejects nav/TOC matches that are invisible (visibility: hidden)", () => {
    document.body.innerHTML = `
      <nav style="visibility: hidden;">
        <li>nail plate</li>
      </nav>
      <main>
        <p>Some other content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail plate");

    // Should return null because nav is invisible
    expect(el).toBeNull();
  });

  test("rejects nav/TOC matches that have zero bounding box", () => {
    document.body.innerHTML = `
      <nav style="position: absolute; width: 0; height: 0;">
        <li>nail matrix</li>
      </nav>
      <main>
        <p>Some other content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail matrix");

    // Should return null because nav has no size
    expect(el).toBeNull();
  });

  test("accepts nav/TOC matches that are visible and scrollable", () => {
    document.body.innerHTML = `
      <nav style="display: block; visibility: visible;">
        <li>nail plate</li>
      </nav>
      <main>
        <p>Some other content</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail plate");

    // Should return the nav element if it's visible and scrollable
    expect(el).not.toBeNull();
    expect(el?.closest("nav")).not.toBeNull();
  });

  test("prefers main content over visible nav/TOC", () => {
    document.body.innerHTML = `
      <nav style="display: block;">
        <li>nail plate</li>
      </nav>
      <main>
        <p>nail plate</p>
      </main>
    `;

    const { findPageMatchElement } = require("../highlight");
    const el = findPageMatchElement("nail plate");

    // Should prefer main content even if nav is visible
    expect(el).not.toBeNull();
    expect(el?.closest("main")).not.toBeNull();
    expect(el?.closest("nav")).toBeNull();
  });

  test("returns null for nav/TOC match when main content not found and nav is hidden", async () => {
    document.body.innerHTML = `
      <nav style="display: none;">
        <li>nail plate</li>
      </nav>
      <main>
        <p>Different content</p>
      </main>
    `;

    mockShowAlert.mockClear();
    const { scrollToPageMatch } = require("../highlight");

    await scrollToPageMatch("nail plate");

    // Should show error because nav match is hidden
    expect(mockShowAlert).toHaveBeenCalled();
    const errorMessage = mockShowAlert.mock.calls[0]?.[0] || "";
    // Error message should indicate phrase not found or exists but is hidden
    expect(errorMessage).toMatch(/couldn't find|exists on this page|phrase you're looking for/i);
  });
});

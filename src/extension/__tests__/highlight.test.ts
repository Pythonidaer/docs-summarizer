/** @jest-environment jsdom */
import { findPageMatchElement, scrollToPageMatch } from "../highlight";
import { DRAWER_ROOT_ID } from "../constants";

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

  test("wraps the matched phrase in an inline highlight span", () => {
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
    scrollToPageMatch("Banana pudding");

    // Assert: the paragraph should now contain a span wrapping the phrase
    const span = target.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.textContent).toContain("Banana pudding");
    // Parent should still be the paragraph
    expect(span!.parentElement).toBe(target);
  });

  test("falls back to block highlight when inline highlight fails", () => {
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

    scrollToPageMatch("fallback highlight");

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

  test("removes all inline highlight spans created by scrollToPageMatch", () => {
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
    
    scrollToPageMatch("highlighted phrase");
    scrollToPageMatch("highlight");

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

  test("removes all block highlight classes created by scrollToPageMatch", () => {
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
    scrollToPageMatch("target text");

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

  test("clears both inline and block highlights together", () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Text with inline highlight phrase.</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    const p1 = document.getElementById("p1");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    
    // Create both inline and block highlights
    scrollToPageMatch("inline highlight phrase");

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

  test("can be called multiple times safely", () => {
    document.body.innerHTML = `
      <main>
        <p id="p1">Some text with target phrase.</p>
      </main>
    `;

    const { scrollToPageMatch, clearAllHighlights } = require("../highlight");
    
    const p1 = document.getElementById("p1");
    if (p1) p1.scrollIntoView = jest.fn() as any;
    
    scrollToPageMatch("target phrase");
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

  test("shows alert when phrase not found in page text", () => {
    document.body.innerHTML = `<main><p>Some text here</p></main>`;
    
    const mockAlert = jest.fn();
    (global as any).window.alert = mockAlert;

    const { scrollToPageMatch } = require("../highlight");
    scrollToPageMatch("phrase that does not exist");

    expect(mockAlert).toHaveBeenCalled();
    expect(mockAlert.mock.calls[0]?.[0]).toContain("could not find that phrase");
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

  test("handles very long phrases", () => {
    const longPhrase = "This is a very long phrase that contains many words and should still work correctly when searching for matches in the page content";
    document.body.innerHTML = `
      <main>
        <p>${longPhrase}</p>
      </main>
    `;

    const { scrollToPageMatch } = require("../highlight");
    const p = document.querySelector("p");
    if (p) p.scrollIntoView = jest.fn() as any;

    expect(() => scrollToPageMatch(longPhrase)).not.toThrow();
  });

  test("handles special characters in phrase", () => {
    const specialPhrase = "Text with (parentheses) and [brackets] and {braces}";
    document.body.innerHTML = `
      <main>
        <p>${specialPhrase}</p>
      </main>
    `;

    const { scrollToPageMatch } = require("../highlight");
    const p = document.querySelector("p");
    if (p) p.scrollIntoView = jest.fn() as any;

    expect(() => scrollToPageMatch(specialPhrase)).not.toThrow();
  });
});

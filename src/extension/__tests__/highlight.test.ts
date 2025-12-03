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

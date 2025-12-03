/** @jest-environment jsdom */
import { renderMarkdownInto } from "../markdown";
import { setPageTextForLinks } from "../pageText";

describe("renderInlineMarkdown", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    setPageTextForLinks(""); // reset between tests
  });

  test("renders external links as <a> with target=_blank", () => {
    const input = "See [Google](https://google.com) for more info.";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.href).toContain("https://google.com");
    expect(link!.target).toBe("_blank");
  });

  test("renders scroll links only when term exists in PAGE_TEXT_FOR_LINKS", () => {
    setPageTextForLinks("Hello world");

    const input = "Jump to [section](#scroll:world)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("section");
    expect(link!.style.color).toBe("rgb(249, 115, 22)");
  });

  test("does NOT render scroll links if term is not present in page text", () => {
    setPageTextForLinks("Nothing matching");

    const input = "Jump to [section](#scroll:missing)";
    renderMarkdownInto(container, input);

    // Should render plain text, not a link
    const link = container.querySelector("a");
    expect(link).toBeNull();

    expect(container.textContent).toContain("section");
    expect(container.textContent).not.toContain("Jump to ["); // shouldn't leave raw markdown
  });

  test("renders plain text when href is nonsense", () => {
    const input = "This is [broken](not_a_real_link)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).toBeNull();
    expect(container.textContent).toContain("broken");
  });
});

describe("renderMarkdownInto - block structure", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  test("renders headings for #, ##, ###", () => {
    const input = [
      "# Heading One",
      "## Heading Two",
      "### Heading Three",
    ].join("\n");

    renderMarkdownInto(container, input);

    const h1 = container.querySelector("h1");
    const h2 = container.querySelector("h2");
    const h3 = container.querySelector("h3");

    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    expect(h3).not.toBeNull();

    expect(h1!.textContent).toBe("Heading One");
    expect(h2!.textContent).toBe("Heading Two");
    expect(h3!.textContent).toBe("Heading Three");
  });

  test("renders unordered lists from - and *", () => {
    const input = [
      "- Item one",
      "- Item two",
      "",
      "* Another one",
      "* And another",
    ].join("\n");

    renderMarkdownInto(container, input);

    const uls = container.querySelectorAll("ul");
    expect(uls.length).toBeGreaterThan(0);

    const firstUlLis = uls[0]!.querySelectorAll("li");
    expect(firstUlLis[0]!.textContent).toContain("Item one");
    expect(firstUlLis[1]!.textContent).toContain("Item two");

    const secondUlLis = uls[1]!.querySelectorAll("li");
    expect(secondUlLis[0]!.textContent).toContain("Another one");
    expect(secondUlLis[1]!.textContent).toContain("And another");
  });

  test("renders ordered lists from 1. and 1)", () => {
    const input = [
      "1. First",
      "2. Second",
      "",
      "1) Another first",
      "2) Another second",
    ].join("\n");

    renderMarkdownInto(container, input);

    const ols = container.querySelectorAll("ol");
    expect(ols.length).toBeGreaterThanOrEqual(2);

    const firstOlLis = ols[0]!.querySelectorAll("li");
    expect(firstOlLis[0]!.textContent).toContain("First");
    expect(firstOlLis[1]!.textContent).toContain("Second");

    const secondOlLis = ols[1]!.querySelectorAll("li");
    expect(secondOlLis[0]!.textContent).toContain("Another first");
    expect(secondOlLis[1]!.textContent).toContain("Another second");
  });

  test("renders fenced code blocks as <pre><code>", () => {
    const input = [
      "```ts",
      "const x = 1;",
      "console.log(x);",
      "```",
    ].join("\n");

    renderMarkdownInto(container, input);

    const pre = container.querySelector("pre");
    const code = pre?.querySelector("code");

    expect(pre).not.toBeNull();
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("const x = 1;");
    expect(code!.textContent).toContain("console.log(x);");
  });

  test("renders normal text lines as paragraphs", () => {
    const input = [
      "This is a paragraph.",
      "",
      "This is another line of text.",
    ].join("\n");

    renderMarkdownInto(container, input);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs[0]!).not.toBeNull();
    expect(paragraphs[1]!).not.toBeNull();
    expect(paragraphs[0]!.textContent).toContain("This is a paragraph.");
    expect(paragraphs[1]!.textContent).toContain("This is another line of text.");
  });
});
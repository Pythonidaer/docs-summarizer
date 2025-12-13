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
    expect(container.textContent).toContain("Jump to");
    expect(container.textContent).toContain("section");
  });

  test("validates scroll links case-insensitively", () => {
    setPageTextForLinks("Hello WORLD with Mixed Case");

    const input = "Jump to [section](#scroll:world)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("section");
  });

  test("handles trailing punctuation variations in phrase matching", () => {
    setPageTextForLinks("The Night of the Long Knives was a significant event.");

    const input = "See [Night of the Long Knives](#scroll:Night of the Long Knives)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("Night of the Long Knives");
  });

  test("validates scroll links with exact phrase matching", () => {
    setPageTextForLinks("What are you wanting certification in?");

    const input = "See [certification](#scroll:What are you wanting certification in?)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("certification");
  });

  test("rejects scroll links when phrase is partial match only", () => {
    setPageTextForLinks("Hello world");

    // "world" exists, but "missing world" doesn't exist as exact phrase
    const input = "Jump to [section](#scroll:missing world)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).toBeNull();
    expect(container.textContent).toContain("section");
  });

  test("handles empty page text gracefully", () => {
    setPageTextForLinks("");

    const input = "Jump to [section](#scroll:anything)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).toBeNull();
    expect(container.textContent).toContain("section");
  });

  test("validates multiple scroll links in same text", () => {
    setPageTextForLinks("First phrase exists. Second phrase also exists.");

    const input = "See [first](#scroll:First phrase exists) and [second](#scroll:Second phrase also exists)";
    renderMarkdownInto(container, input);

    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0]!.textContent).toBe("first");
    expect(links[1]!.textContent).toBe("second");
  });

  test("validates and filters mixed valid/invalid scroll links", () => {
    setPageTextForLinks("Valid phrase exists here");

    const input = "See [valid](#scroll:Valid phrase exists) and [invalid](#scroll:This does not exist)";
    renderMarkdownInto(container, input);

    const links = container.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0]!.textContent).toBe("valid");
    expect(container.textContent).toContain("invalid"); // Should be plain text
  });

  test("handles special characters in scroll link phrases", () => {
    setPageTextForLinks("Question: What's your name? (Required)");

    const input = "See [question](#scroll:Question: What's your name? (Required))";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("question");
  });

  test("validates scroll links with whitespace normalization", () => {
    setPageTextForLinks("Multiple   spaces   here");

    // Should match even with different whitespace in the link
    const input = "See [link](#scroll:Multiple spaces here)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("link");
  });

  test("validates scroll links with lenient whitespace matching for code blocks", () => {
    // Simulate code block text that might have different whitespace
    setPageTextForLinks("type Query { me: User } type User { name: String }");

    // AI might try to match with different whitespace formatting
    const input = "See [code](#scroll:type Query {me: User})";
    renderMarkdownInto(container, input);

    // Should match with lenient whitespace (no spaces between braces)
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("code");
  });

  test("rejects scroll links that don't match even with lenient whitespace", () => {
    setPageTextForLinks("type Query { me: User }");

    // Completely different phrase
    const input = "See [code](#scroll:completely different text)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).toBeNull();
    expect(container.textContent).toContain("code");
  });

  test("renders plain text when href is nonsense", () => {
    const input = "This is [broken](not_a_real_link)";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).toBeNull();
    expect(container.textContent).toContain("broken");
  });

  test("renders bold text with **markers", () => {
    const input = "This is **bold text** in a sentence.";
    renderMarkdownInto(container, input);

    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("bold text");
    expect(strong!.style.fontWeight).toBe("600");
    expect(container.textContent).toContain("This is");
    expect(container.textContent).toContain("in a sentence.");
  });

  test("renders multiple bold sections", () => {
    const input = "**First** and **second** bold sections.";
    renderMarkdownInto(container, input);

    const strongElements = container.querySelectorAll("strong");
    expect(strongElements.length).toBe(2);
    expect(strongElements[0]!.textContent).toBe("First");
    expect(strongElements[1]!.textContent).toBe("second");
  });

  test("renders bold text alongside links", () => {
    const input = "See **bold link** at [Google](https://google.com).";
    renderMarkdownInto(container, input);

    const strong = container.querySelector("strong");
    const link = container.querySelector("a");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("bold link");
    expect(link).not.toBeNull();
    expect(link!.href).toContain("https://google.com");
  });

  test("does not render bold inside links", () => {
    const input = "See [**bold** text](https://example.com).";
    renderMarkdownInto(container, input);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    // The bold markers should not create a separate <strong> element
    const strong = container.querySelector("strong");
    expect(strong).toBeNull();
    // The link should contain the text including the asterisks
    expect(link!.textContent).toContain("bold");
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

  test("renders ordered lists with bold text correctly", () => {
    const input = "1. **Rephrase your prompt**: Try different wording\n2. **Refresh the page**: Sometimes retrying works";
    renderMarkdownInto(container, input);

    const listItems = container.querySelectorAll("ol li");
    expect(listItems.length).toBe(2);
    
    // Check that bold text is rendered, not duplicated
    const firstItem = listItems[0];
    const strongElements = firstItem!.querySelectorAll("strong");
    expect(strongElements.length).toBe(1);
    expect(strongElements[0]!.textContent).toBe("Rephrase your prompt");
    
    // Check that the text doesn't contain the asterisks
    expect(firstItem!.textContent).not.toContain("**");
    expect(firstItem!.textContent).toContain("Rephrase your prompt");
    expect(firstItem!.textContent).toContain("Try different wording");
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
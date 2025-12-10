/** @jest-environment jsdom */
import {
  extractPageStructure,
  serializePageStructureForModel,
  type PageStructure,
} from "../pageStructure";

describe("extractPageStructure", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("returns empty structure for empty document", () => {
    document.body.innerHTML = "";
    const result = extractPageStructure(document);
    expect(result.blocks).toEqual([]);
  });

  test("extracts headings with correct levels", () => {
    document.body.innerHTML = `
      <main>
        <h1>Main Title</h1>
        <h2>Section One</h2>
        <h3>Subsection</h3>
        <h2>Section Two</h2>
      </main>
    `;

    const result = extractPageStructure(document);
    const headings = result.blocks.filter((b) => b.kind === "heading");

    expect(headings.length).toBe(4);
    expect(headings[0]?.level).toBe(1);
    expect(headings[0]?.text).toBe("Main Title");
    expect(headings[1]?.level).toBe(2);
    expect(headings[1]?.text).toBe("Section One");
    expect(headings[2]?.level).toBe(3);
    expect(headings[2]?.text).toBe("Subsection");
    expect(headings[3]?.level).toBe(2);
    expect(headings[3]?.text).toBe("Section Two");
  });

  test("tracks heading path hierarchy correctly", () => {
    document.body.innerHTML = `
      <main>
        <h1>Chapter 1</h1>
        <h2>Section A</h2>
        <h3>Subsection 1</h3>
        <h2>Section B</h2>
      </main>
    `;

    const result = extractPageStructure(document);
    const blocks = result.blocks;

    const h1 = blocks.find((b) => b.text === "Chapter 1");
    const h2a = blocks.find((b) => b.text === "Section A");
    const h3 = blocks.find((b) => b.text === "Subsection 1");
    const h2b = blocks.find((b) => b.text === "Section B");

    // Implementation includes the heading itself in the path
    expect(h1?.headingPath).toEqual(["Chapter 1"]);
    expect(h2a?.headingPath).toEqual(["Chapter 1", "Section A"]);
    expect(h3?.headingPath).toEqual(["Chapter 1", "Section A", "Subsection 1"]);
    expect(h2b?.headingPath).toEqual(["Chapter 1", "Section B"]);
  });

  test("extracts paragraphs from p, li, dd, blockquote, figcaption", () => {
    document.body.innerHTML = `
      <main>
        <p>Paragraph text here.</p>
        <ul>
          <li>List item text.</li>
        </ul>
        <dl>
          <dd>Definition description text.</dd>
        </dl>
        <blockquote>Quote text here.</blockquote>
        <figure>
          <figcaption>Caption text here.</figcaption>
        </figure>
      </main>
    `;

    const result = extractPageStructure(document);
    const paragraphs = result.blocks.filter((b) => b.kind === "paragraph");

    expect(paragraphs.length).toBe(5);
    expect(paragraphs.some((p) => p.text.includes("Paragraph text"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("List item text"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("Definition description"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("Quote text"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("Caption text"))).toBe(true);
  });

  test("extracts text-heavy table cells as paragraphs", () => {
    document.body.innerHTML = `
      <main>
        <table>
          <tr>
            <td>Short</td>
            <td>This is a very long table cell with more than 40 characters of text content that should be extracted.</td>
          </tr>
        </table>
      </main>
    `;

    const result = extractPageStructure(document);
    const paragraphs = result.blocks.filter((b) => b.kind === "paragraph");

    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0]?.text).toContain("very long table cell");
  });

  test("extracts text-heavy div/section/article without child paragraphs", () => {
    document.body.innerHTML = `
      <main>
        <div>This is a text-heavy div element with more than 80 characters of content that has no child paragraph elements inside it.</div>
        <section>This is a text-heavy section element with more than 80 characters of content that has no child paragraph elements inside it.</section>
        <article>This is a text-heavy article element with more than 80 characters of content that has no child paragraph elements inside it.</article>
      </main>
    `;

    const result = extractPageStructure(document);
    const paragraphs = result.blocks.filter((b) => b.kind === "paragraph");

    expect(paragraphs.length).toBe(3);
    expect(paragraphs.some((p) => p.text.includes("text-heavy div"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("text-heavy section"))).toBe(true);
    expect(paragraphs.some((p) => p.text.includes("text-heavy article"))).toBe(true);
  });

  test("does not extract div/section/article with child paragraphs", () => {
    document.body.innerHTML = `
      <main>
        <div>
          <p>This div has a paragraph child, so the div itself should not be extracted.</p>
        </div>
      </main>
    `;

    const result = extractPageStructure(document);
    const paragraphs = result.blocks.filter((b) => b.kind === "paragraph");

    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0]?.text).toContain("This div has a paragraph");
    expect(paragraphs[0]?.tagName).toBe("p");
  });

  test("extracts code blocks from pre elements", () => {
    document.body.innerHTML = `
      <main>
        <pre>const x = 1;
console.log(x);</pre>
      </main>
    `;

    const result = extractPageStructure(document);
    const codeBlocks = result.blocks.filter((b) => b.kind === "code");

    expect(codeBlocks.length).toBe(1);
    expect(codeBlocks[0]?.text).toContain("const x = 1");
    expect(codeBlocks[0]?.tagName).toBe("pre");
  });

  test("extracts standalone code elements (not in pre) with length > 20", () => {
    document.body.innerHTML = `
      <main>
        <code>This is a standalone code element with more than 20 characters of text content.</code>
        <code>Short</code>
        <pre><code>Code inside pre should not be extracted separately</code></pre>
      </main>
    `;

    const result = extractPageStructure(document);
    const codeBlocks = result.blocks.filter((b) => b.kind === "code");

    expect(codeBlocks.length).toBe(2); // One standalone, one pre
    const standalone = codeBlocks.find((b) => b.tagName === "code");
    expect(standalone?.text).toContain("standalone code element");
    expect(codeBlocks.some((b) => b.tagName === "pre")).toBe(true);
  });

  test("infers region correctly: main, header, footer, nav, aside, references", () => {
    // Note: extractPageStructure only walks within main/article/body root
    // So header/nav/footer/aside must be inside main to be found
    document.body.innerHTML = `
      <main>
        <header>
          <h1>Header Title</h1>
          <p>Header paragraph</p>
        </header>
        <nav>
          <h2>Nav Title</h2>
        </nav>
        <h1>Main Title</h1>
        <p>Main paragraph</p>
        <aside>
          <h2>Aside Title</h2>
        </aside>
        <footer>
          <p>Footer paragraph</p>
        </footer>
        <div id="references">
          <h2>References</h2>
        </div>
      </main>
    `;

    const result = extractPageStructure(document);
    const mainBlocks = result.blocks.filter((b) => b.region === "main");
    const headerBlocks = result.blocks.filter((b) => b.region === "header");
    const navBlocks = result.blocks.filter((b) => b.region === "nav");
    const asideBlocks = result.blocks.filter((b) => b.region === "aside");
    const footerBlocks = result.blocks.filter((b) => b.region === "footer");
    const refBlocks = result.blocks.filter((b) => b.region === "references");

    expect(mainBlocks.some((b) => b.text.includes("Main Title"))).toBe(true);
    expect(headerBlocks.some((b) => b.text.includes("Header Title"))).toBe(true);
    expect(navBlocks.some((b) => b.text.includes("Nav Title"))).toBe(true);
    expect(asideBlocks.some((b) => b.text.includes("Aside Title"))).toBe(true);
    expect(footerBlocks.some((b) => b.text.includes("Footer paragraph"))).toBe(true);
    expect(refBlocks.some((b) => b.text.includes("References"))).toBe(true);
  });

  test("skips script and style elements", () => {
    document.body.innerHTML = `
      <main>
        <h1>Title</h1>
        <script>console.log('should be skipped');</script>
        <style>.class { color: red; }</style>
        <p>Paragraph</p>
      </main>
    `;

    const result = extractPageStructure(document);
    const allText = result.blocks.map((b) => b.text).join(" ");

    expect(allText).not.toContain("should be skipped");
    expect(allText).not.toContain("color: red");
    expect(allText).toContain("Title");
    expect(allText).toContain("Paragraph");
  });

  test("normalizes whitespace in extracted text", () => {
    document.body.innerHTML = `
      <main>
        <p>Text   with    multiple    spaces
        and
        newlines</p>
      </main>
    `;

    const result = extractPageStructure(document);
    const paragraph = result.blocks.find((b) => b.kind === "paragraph");

    expect(paragraph?.text).toBe("Text with multiple spaces and newlines");
    expect(paragraph?.text).not.toContain("   ");
    expect(paragraph?.text).not.toContain("\n");
  });

  test("uses article as root if main is not present", () => {
    document.body.innerHTML = `
      <article>
        <h1>Article Title</h1>
        <p>Article content</p>
      </article>
    `;

    const result = extractPageStructure(document);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.some((b) => b.text.includes("Article Title"))).toBe(true);
  });

  test("uses body as root if neither main nor article is present", () => {
    document.body.innerHTML = `
      <h1>Body Title</h1>
      <p>Body content</p>
    `;

    const result = extractPageStructure(document);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.some((b) => b.text.includes("Body Title"))).toBe(true);
  });

  test("assigns unique IDs to blocks", () => {
    document.body.innerHTML = `
      <main>
        <h1>Title 1</h1>
        <h2>Title 2</h2>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </main>
    `;

    const result = extractPageStructure(document);
    const ids = result.blocks.map((b) => b.id);

    expect(ids.length).toBe(new Set(ids).size); // All unique
    expect(ids.every((id) => id.startsWith("b"))).toBe(true);
  });
});

describe("serializePageStructureForModel", () => {
  test("returns empty string for empty structure", () => {
    const structure: PageStructure = { blocks: [] };
    const result = serializePageStructureForModel(structure);
    expect(result).toBe("");
  });

  test("includes all headings regardless of length", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "heading",
          level: 1,
          text: "Short",
          headingPath: [],
          region: "main",
          tagName: "h1",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).toContain("Short");
    expect(result).toContain("[HEADING]");
  });

  test("filters out short non-heading blocks (< 20 chars)", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "paragraph",
          text: "Short",
          headingPath: [],
          region: "main",
          tagName: "p",
        },
        {
          id: "b2",
          kind: "paragraph",
          text: "This is a longer paragraph with more than 20 characters.",
          headingPath: [],
          region: "main",
          tagName: "p",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).not.toContain("Short");
    expect(result).toContain("This is a longer paragraph");
  });

  test("truncates long text to 140 characters", () => {
    const longText = "a".repeat(200);
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "paragraph",
          text: longText,
          headingPath: [],
          region: "main",
          tagName: "p",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    const lines = result.split("\n");
    const blockLine = lines.find((l) => l.includes("[PARAGRAPH]"));

    expect(blockLine).toBeDefined();
    expect(blockLine?.length).toBeLessThan(longText.length + 100); // Account for prefix
    expect(blockLine).toContain("...");
  });

  test("formats heading paths correctly", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "paragraph",
          text: "Content under heading",
          headingPath: ["Chapter 1", "Section A", "Subsection"],
          region: "main",
          tagName: "p",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).toContain("Chapter 1 > Section A > Subsection");
  });

  test("shows '(no heading)' for blocks without heading path", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "paragraph",
          text: "Content with no heading",
          headingPath: [],
          region: "main",
          tagName: "p",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).toContain("(no heading)");
  });

  test("includes header and instruction lines", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "heading",
          level: 1,
          text: "Title",
          headingPath: [],
          region: "main",
          tagName: "h1",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).toContain("=== PAGE STRUCTURE OVERVIEW ===");
    expect(result).toContain("Each line describes a block");
    expect(result).toContain("When choosing scroll links");
  });

  test("formats all block kinds correctly", () => {
    const structure: PageStructure = {
      blocks: [
        {
          id: "b1",
          kind: "heading",
          level: 1,
          text: "Heading text",
          headingPath: [],
          region: "main",
          tagName: "h1",
        },
        {
          id: "b2",
          kind: "paragraph",
          text: "Paragraph text with enough characters to pass",
          headingPath: [],
          region: "main",
          tagName: "p",
        },
        {
          id: "b3",
          kind: "code",
          text: "Code block text with enough characters to pass",
          headingPath: [],
          region: "main",
          tagName: "pre",
        },
      ],
    };

    const result = serializePageStructureForModel(structure);
    expect(result).toContain("[HEADING]");
    expect(result).toContain("[PARAGRAPH]");
    expect(result).toContain("[CODE]");
  });
});


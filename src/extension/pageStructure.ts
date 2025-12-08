export type BlockKind = "heading" | "paragraph" | "code";

export type BlockRegion =
  | "main"
  | "header"
  | "footer"
  | "nav"
  | "aside"
  | "references"
  | "other";

export interface PageBlock {
  id: string;
  kind: BlockKind;
  level?: number;        // for headings
  text: string;          // normalized text
  headingPath: string[]; // H1 > H2 > ...
  region: BlockRegion;
  tagName: string;
}

export interface PageStructure {
  blocks: PageBlock[];
}

// ---------- helpers ----------

function inferRegion(el: HTMLElement): BlockRegion {
  if (el.closest("header")) return "header";
  if (el.closest("nav")) return "nav";
  if (el.closest("footer")) return "footer";
  if (el.closest("aside")) return "aside";

  const refContainer = el.closest(
    "[id*='ref'],[class*='ref'],[id*='bibliograph'],[class*='bibliograph'],[id*='footnote'],[class*='footnote']"
  );
  if (refContainer) return "references";

  if (el.closest("main, article")) return "main";

  return "other";
}

function normalizeText(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function isParagraphLike(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();

  if (
    tag === "p" ||
    tag === "li" ||
    tag === "dd" ||
    tag === "blockquote" ||
    tag === "figcaption"
  ) {
    return true;
  }

  // Text-heavy table cells
  if ((tag === "td" || tag === "th") && normalizeText(el).length > 40) {
    return true;
  }

  // Fallback: text-heavy div/section/article with no child p/li/dd
  if (tag === "div" || tag === "section" || tag === "article") {
    const hasChildParagraph = el.querySelector("p, li, dd");
    const text = normalizeText(el);
    if (!hasChildParagraph && text.length > 80) {
      return true;
    }
  }

  return false;
}

function isCodeLike(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();

  // Primary: <pre> blocks are code containers
  if (tag === "pre") return true;

  // Standalone <code> with meaningful length, not already inside <pre>
  if (tag === "code" && !el.closest("pre")) {
    const text = normalizeText(el);
    return text.length > 20;
  }

  return false;
}

// ---------- main extractor ----------

export function extractPageStructure(doc: Document): PageStructure {
  const blocks: PageBlock[] = [];
  let nextId = 1;

  const root =
    doc.querySelector("main") ??
    doc.querySelector("article") ??
    doc.body;

  if (!root) return { blocks: [] };

  const headingStack: { level: number; text: string }[] = [];

  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node = walker.currentNode as HTMLElement | null;

  while (node) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (el.matches("script, style")) {
      node = walker.nextNode() as HTMLElement | null;
      continue;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = normalizeText(el);
      if (text) {
        while (
          headingStack.length &&
          headingStack[headingStack.length - 1]!.level >= level
        ) {
          headingStack.pop();
        }
        headingStack.push({ level, text });

        blocks.push({
          id: `b${nextId++}`,
          kind: "heading",
          level,
          text,
          headingPath: headingStack.map(h => h.text),
          region: inferRegion(el),
          tagName: tag,
        });
      }

      node = walker.nextNode() as HTMLElement | null;
      continue;
    }

    // Code blocks
    if (isCodeLike(el)) {
      const text = normalizeText(el);
      if (text) {
        blocks.push({
          id: `b${nextId++}`,
          kind: "code",
          text,
          headingPath: headingStack.map(h => h.text),
          region: inferRegion(el),
          tagName: tag,
        });
      }

      node = walker.nextNode() as HTMLElement | null;
      continue;
    }

    // Paragraph-like content
    if (isParagraphLike(el)) {
      const text = normalizeText(el);
      if (text) {
        blocks.push({
          id: `b${nextId++}`,
          kind: "paragraph",
          text,
          headingPath: headingStack.map(h => h.text),
          region: inferRegion(el),
          tagName: tag,
        });
      }

      node = walker.nextNode() as HTMLElement | null;
      continue;
    }

    node = walker.nextNode() as HTMLElement | null;
  }

  return { blocks };
}


export function serializePageStructureForModel(structure: PageStructure): string {
  if (!structure.blocks.length) return "";

  const lines: string[] = [];
  lines.push("=== PAGE STRUCTURE OVERVIEW ===");
  lines.push(
    "Each line describes a block: [kind][region][under heading path]: snippet"
  );
  lines.push("");

  for (const b of structure.blocks) {
    // Only include headings + content, skip very short snippets
    if (b.text.length < 20 && b.kind !== "heading") continue;

    const path =
      b.headingPath.length > 0 ? b.headingPath.join(" > ") : "(no heading)";
    const snippet =
      b.text.length > 140 ? b.text.slice(0, 137) + "..." : b.text;

    lines.push(
      `[${b.kind.toUpperCase()}][${b.region}] under ${path}: ${snippet}`
    );
  }

  lines.push("");
  lines.push(
    "When choosing scroll links, PREFER short phrases from PARAGRAPH or CODE blocks in region=main, and AVOID nav/header/footer/references unless explicitly requested."
  );

  return lines.join("\n");
}

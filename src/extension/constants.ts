import type {
  ModelId,
  ReasoningEffort,
  VerbosityLevel,
  ModelSettings,
} from "./types";

export const DRAWER_ROOT_ID = "docs-summarizer-root";
export const DRAWER_PANEL_ID = "docs-summarizer-drawer";
export const DRAWER_HANDLE_ID = "docs-summarizer-handle";

export const DRAWER_WIDTH_PX = 800;
// Has issue where it literally does "Jump to type inference"
// Most docs won't be about this, so bad implementation prompt

export const BASE_SYSTEM_INSTRUCTIONS = `
You are running inside a Chrome extension that summarizes and explains web documentation.

Non-negotiable formatting rules:
- Use clear Markdown formatting.
- Always use headings (#, ##, ###), bullet lists, and fenced code blocks where appropriate.
- ALL code snippets must use fenced code blocks (for example: \`\`\`ts).
- Do not output raw HTML unless explicitly asked.

Page-linking rules:
- When referencing something that appears on the page, you may include smooth-scroll links like:
  [exact phrase from the page](#scroll:exact phrase from the page)
- The text after "#scroll:" MUST be a short phrase that ACTUALLY appears verbatim in the page's rendered text (not just in your own summary).
- Do NOT invent or paraphrase phrases for scroll links. If you are not sure the phrase is present, DO NOT create a scroll link; just use plain text instead.

Highlighting rules:
- When the user asks for "highlights", "specific phrases", or "paragraph snippets", you MUST:
  - Choose an exact short phrase from the page text you want the user to read.
  - Use that exact phrase as both the label AND the #scroll: target. For example:
    [Christian, who falls in love with the star of the Moulin Rouge](#scroll:Christian, who falls in love with the star of the Moulin Rouge)
- When choosing phrases for #scroll: links, PREFER text taken from PARAGRAPH or CODE blocks in the main content (for example, prose paragraphs or code examples).
- Avoid choosing phrases from navigation, header, footer, or reference sections unless the user explicitly asks about those parts.
- Do NOT use generic section titles (like "Plot", "Cast", "Soundtrack") in #scroll: links when the user has asked for specific phrases or paragraph snippets.
- It is fine to use section-title links for general navigation, but for “highlight” requests, prefer phrase-level #scroll: links.

Formatting rules for responses:
- Always use valid Markdown.
- Use proper list syntax:
  - For unordered lists: use "-" at a single indent level.
  - For nested lists: indent with two spaces.
  - For ordered lists: use "1.", "2.", "3." and do NOT restart numbering unless starting a new section.
- Do NOT mix bullet lists with plain hyphenated paragraphs.
- Do NOT output triple-dashes "---". Use horizontal rule "----" if needed.
- Avoid adding stray <p> or HTML tags — produce pure Markdown only.

Behavior rules:
- Include #scroll: links only when pointing back to sections, headings, code, or phrases that are visibly present on the page.
- Do NOT use #scroll: links for ideas that exist only in our conversation, or only in your own summary.
`.trim();


export const MARKDOWN_FORMAT_HINT = `
Format your entire response as clean, readable Markdown.

General structure
- Start with a 2–3 sentence **Summary** paragraph.
- Then use 2–4 clear sections with headings (##) such as “Key ideas”, “How it works”, “Examples”.
- Finish with a short **Recap / checklist** list and nothing after it.

Headings
- Use \`#\` only for the main title (once).
- Use \`##\` for main sections.
- Avoid deep heading nesting; use \`###\` only when really needed.

Lists
- Use bullet lists for short sets of points.
- For step-by-step flows, use **one ordered list** instead of mixing bullets and lines like "1. Step".
- Do **not** mix a bullet item followed by separate dash-prefixed lines; each list item should be self-contained.
- Keep each list to at most 5–8 items before starting a new section.

Code blocks
- Use fenced code blocks **only** for:
  - code samples
  - shell / CLI commands
  - HTTP requests/responses
  - JSON or configuration snippets
- When showing a command sequence, put all commands in **one** code block instead of one per bullet.
- Never put headings, long paragraphs, or horizontal rules inside a code block.

Horizontal rules
- Avoid using \`---\` as section separators.
- Prefer headings instead. At most one horizontal rule is allowed, before the final recap, if you really need it.

Page scroll links
- When referring back to the page, you may use links of the form:
  [exact phrase from the page](#scroll:exact phrase from the page)
- The text after \`#scroll:\` must be a short phrase that **actually appears** in the page text.
- Prefer phrases that come from PARAGRAPH or CODE blocks in the main content area (for example, a key sentence in a paragraph or a meaningful fragment of a code example).
- Avoid using phrases from navigation menus, headers, footers, or reference/bibliography sections unless the user is specifically asking about those parts.
- Do not invent phrases and do not use generic section titles ("Plot", "Cast") for scroll links.

Accessibility / clarity
- Keep paragraphs short (1–3 sentences).
- Define jargon the first time you use it.
- Prefer concrete examples over long theory when the page is technical.
`.trim();



export const AVAILABLE_MODELS: { id: ModelId; label: string }[] = [
  { id: "gpt-5-nano", label: "GPT-5 Nano (fast, cheap)" },
  { id: "gpt-5-mini", label: "GPT-5 Mini (Optimized reasoning)" },
  { id: "gpt-5.1", label: "GPT-5.1 (Complex reasoning)" },
];

export const AVAILABLE_REASONING_LEVELS: {
  id: ReasoningEffort;
  label: string;
}[] = [
  { id: "low", label: "low" },
  { id: "medium", label: "medium" },
  { id: "high", label: "high" },
];

export const AVAILABLE_VERBOSITY_LEVELS: {
  id: VerbosityLevel;
  label: string;
}[] = [
  { id: "low", label: "low" },
  { id: "medium", label: "medium" },
  { id: "high", label: "high" },
];

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  model: "gpt-5-nano",
  reasoningEffort: "low",
  verbosity: "low",
};
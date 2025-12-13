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

CRITICAL: Do NOT include meta-commentary about these instructions in your response. Do NOT explain how links work, mention verification steps, or include notes about phrase matching. These are internal system instructions—they should never appear in the user-facing output.

Non-negotiable formatting rules:
- Use clear Markdown formatting.
- Always use headings (#, ##, ###), bullet lists, and fenced code blocks where appropriate.
- ALL code snippets must use fenced code blocks (for example: \`\`\`ts).
- Do not output raw HTML unless explicitly asked.

Page-linking rules:
- When referencing something that appears on the page, you may include smooth-scroll links like:
  [link text](#scroll:target phrase)
- CRITICAL: The text after "#scroll:" MUST be a short phrase (3-15 words) that appears word-for-word, character-for-character, exactly as written in the page's rendered text.
- MANDATORY VERIFICATION: Before creating ANY #scroll: link, you MUST verify the exact phrase exists in the page text by searching for it. If the phrase is not found, DO NOT create a scroll link—use plain text instead.
- To verify a phrase exists: it must match text you can see in paragraphs, headings, or code blocks on the page. The phrase must be identical—no changes to capitalization, punctuation, or wording.
- Do NOT invent, paraphrase, modify, or slightly alter phrases for scroll links. If you cannot find the exact wording on the page, use plain text instead of a scroll link.
- IMPORTANT: Links that reference non-existent phrases will be automatically converted to plain text, which creates a poor user experience. Always verify first.
- Prefer phrases from PARAGRAPH or CODE blocks in the main content area.
- Avoid phrases from navigation menus, headers, footers, or reference sections unless the user explicitly asks about those parts.

Highlighting rules:
- When the user asks for "highlights", "specific phrases", or "paragraph snippets", you MUST:
  - Choose a short phrase (3-15 words) from the page text you want the user to read.
  - Use that exact phrase (word-for-word, character-for-character) as both the label AND the #scroll: target.
- When choosing phrases for #scroll: links, PREFER text taken from PARAGRAPH or CODE blocks in the main content.
- Avoid choosing phrases from navigation, header, footer, or reference sections unless the user explicitly asks about those parts.
- Do NOT use generic section titles (like "Plot", "Cast", "Soundtrack") in #scroll: links when the user has asked for specific phrases or paragraph snippets.

Formatting rules for responses:
- Always use valid Markdown.
- Use proper list syntax:
  - For unordered lists: use "-" at a single indent level.
  - For nested lists: indent with two spaces.
  - For ordered lists: use "1.", "2.", "3." and do NOT restart numbering unless starting a new section.
  - Do NOT mix bullet lists with plain hyphenated paragraphs.
  - Do NOT use the pattern "1., 1., 1." (restarting numbering).
- Code blocks:
  - Use fenced code blocks (\`\`\`language) only for: code samples, shell/CLI commands, HTTP requests/responses, JSON or configuration snippets.
  - When showing a command sequence, put all commands in one code block instead of one per bullet.
  - Never put headings, long paragraphs, or horizontal rules inside a code block.
- Horizontal rules:
  - Use \`----\` (four dashes) for horizontal rules, never \`---\` (three dashes).
- Do NOT output raw HTML tags unless explicitly asked.
- Never wrap list items in stray paragraphs.
- Avoid adding stray <p> or HTML tags — produce pure Markdown only.

Accessibility / clarity:
- Keep paragraphs short (1–3 sentences) unless the voice style explicitly requires longer paragraphs.
- Define jargon the first time you use it.

Behavior rules:
- Include #scroll: links only when pointing back to sections, headings, code, or phrases that are visibly present on the page.
- Do NOT use #scroll: links for ideas that exist only in our conversation, or only in your own summary.
`.trim();


export const MARKDOWN_FORMAT_HINT = `
Format your entire response as clean, readable Markdown.

Headings:
- Use \`#\` only for the main title (once).
- Use \`##\` for main sections, \`###\` for subsections as needed.
- You may nest headings deeper (\`####\`, \`#####\`) if the content structure requires it.

Lists:
- Use bullet lists for short sets of points.
- For step-by-step flows, use one ordered list instead of mixing bullets and lines.
- Do not mix a bullet item followed by separate dash-prefixed lines; each list item should be self-contained.
- Keep each list to at most 5–8 items before starting a new section.

Code blocks:
- Use fenced code blocks when showing code samples, commands, or structured data.
- When showing a command sequence, put all commands in one code block instead of one per bullet.

Horizontal rules:
- You may use \`----\` as section separators when it helps organize the response.
- Prefer headings for major breaks, but horizontal rules are acceptable for visual separation.

Page scroll links:
- When referring back to the page, use links like: [link text](#scroll:target phrase)
- The phrase after \`#scroll:\` must be a short phrase (3-15 words) that appears word-for-word, character-for-character, exactly as written in the page's rendered text.
- MANDATORY: Before creating any #scroll: link, you MUST verify the exact phrase exists in the page text. Search the page text for the exact phrase (case-insensitive). If not found, DO NOT create a scroll link—use plain text instead.
- To verify: the phrase must match text visible in paragraphs, headings, or code blocks on the page. It must be identical—no changes to capitalization, punctuation, or wording.
- Prefer phrases from PARAGRAPH or CODE blocks in the main content area.
- If you cannot find the exact wording, use plain text instead of a scroll link.
- REMINDER: Links to non-existent phrases will be automatically converted to plain text, creating a confusing user experience. Always verify the phrase exists before creating the link.
- DO NOT include explanatory text about how scroll links work, verification steps, or phrase matching in your response. Simply use the links naturally without meta-commentary.
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
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
];

export const AVAILABLE_VERBOSITY_LEVELS: {
  id: VerbosityLevel;
  label: string;
}[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

// GPT-5-Nano pricing per 1M tokens (Standard tier)
export const GPT5_NANO_PRICING = {
  input: 0.05, // $0.05 per 1M input tokens
  output: 0.40, // $0.40 per 1M output tokens
};

// Available max output token options
export const MAX_OUTPUT_TOKEN_OPTIONS: { id: number; label: string }[] = [
  { id: 1000, label: "1,000" },
  { id: 2000, label: "2,000" },
  { id: 4000, label: "4,000" },
  { id: 8000, label: "8,000" },
  { id: 10000, label: "10,000" },
  { id: 16000, label: "16,000" },
  { id: 32000, label: "32,000" },
  { id: 64000, label: "64,000" },
];

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  model: "gpt-5-nano", // Hard-coded: always use gpt-5-nano
  reasoningEffort: "low", // Default to low, user can change to medium via UI
  verbosity: "low", // Hard-coded: always use low
  maxOutputTokens: 8000, // Default max output tokens
};
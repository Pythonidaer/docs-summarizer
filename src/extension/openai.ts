import { ensureApiKey } from "./storage/apiKey";
import { DEFAULT_INSTRUCTIONS, MARKDOWN_FORMAT_HINT } from "./constants";
import type { Message } from "./types";


export function getActiveInstructions(
  useCustom: boolean,
  instructionsText: string
): string {
  const trimmed = instructionsText.trim();

  if (useCustom && trimmed.length > 0) {
    return trimmed;
  }

  return DEFAULT_INSTRUCTIONS;
}

export function buildInputForPageSummary(
  text: string,
  useCustom: boolean,
  instructionsText: string
): string {
  const lines: string[] = [];

  if (useCustom) {
    // If using custom instructions, let them define style
    lines.push("Summarize the following documentation according to your active instructions.");
  } else {
    // Default ADHD-friendly summary behavior
    lines.push("Summarize and explain the following documentation for a junior-level engineer.");
    lines.push("Start with a 2–3 sentence overview, then provide 3–5 bullet points of key ideas.");
  }

  lines.push("");
  lines.push("DOCUMENTATION:");
  lines.push(text);
  lines.push("");
  lines.push("=== RESPONSE FORMAT ===");
  lines.push(MARKDOWN_FORMAT_HINT);

  return lines.join("\n");
}

export function buildInputForConversation(pageText: string, history: Message[], instructions: string): string {
    const lines: string[] = [];

    lines.push("You are helping a developer understand the following documentation.");
    lines.push("");
    lines.push("=== PAGE CONTENT (read-only context) ===");
    lines.push(pageText);
    lines.push("");
    lines.push("=== CONVERSATION SO FAR ===");

    if (history.length === 0) {
        lines.push("(No prior conversation.)");
    } else {
        for (const msg of history) {
            const prefix = msg.role === "user" ? "User" : "Assistant";
            lines.push(`${prefix}: ${msg.text}`);
        }
    }

    lines.push("");
    lines.push("Continue the conversation as the assistant, responding to the most recent user message.");
    lines.push("");
    lines.push("=== RESPONSE FORMAT ===");
    lines.push(MARKDOWN_FORMAT_HINT);

    return lines.join("\n");
}

export async function callOpenAI(
  input: string,
  instructions: string
): Promise<string> {
  const apiKey = await ensureApiKey();
  if (!apiKey) {
    throw new Error("API key missing");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-nano",
      instructions,
      input,
      max_output_tokens: 2000,
      reasoning: { effort: "low" },
      text: {
        verbosity: "low",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const summaryText = extractTextFromResponse(data);

  if (!summaryText || !summaryText.trim()) {
    throw new Error(
      "The model returned an empty response. Try rephrasing your question or reducing the amount of text."
    );
  }

  return summaryText;
}


// ------------ OpenAI call via fetch --------------
export async function summarizeWithOpenAI(
  pageText: string,
  useCustom: boolean,
  customInstructions: string
): Promise<string> {
  const instructions = getActiveInstructions(useCustom, customInstructions);
const input = buildInputForPageSummary(
  pageText,
  useCustom,
  customInstructions
);  return callOpenAI(input, instructions);
}

export async function chatWithOpenAI(
  pageText: string,
  history: Message[],
  useCustom: boolean,
  customInstructions: string
): Promise<string> {
  const instructions = getActiveInstructions(useCustom, customInstructions);
  const input = buildInputForConversation(pageText, history, instructions);
  return callOpenAI(input, instructions);
}

export function extractTextFromResponse(data: any) : string {
    // 1) Try convenience field if present
    if (typeof data.output_text === "string" && data.output_text.trim()) {
        return data.output_text.trim();
    }

    const outputs = data.output;
    if (!Array.isArray(outputs)) return "";

    // 2) Look through all output items for an output_text content block
    for (const item of outputs) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const piece of item.content) {
            if (!piece) continue;

            // Most common shape: { type: "output_text", text: "..." }
            if (
                (piece.type === "output_text" || piece.type === "output") &&
                typeof piece.text === "string" &&
                piece.text.trim()
            ) {
                return piece.text.trim();
         }
        }
    }

    return "";
}
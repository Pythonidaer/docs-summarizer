// src/extension/openai.ts
import { ensureApiKey } from "./storage/apiKey";
import { BASE_SYSTEM_INSTRUCTIONS, MARKDOWN_FORMAT_HINT } from "./constants";
import type { Message, ModelSettings } from "./types";
import { getPromptVoiceInstructions, PromptVoiceId } from "./prompts/voices";

export interface BuildInstructionsOptions {
  useCustom: boolean;
  customInstructions: string;
  promptVoiceId?: PromptVoiceId; // optional for now
}

export function buildInstructions(options: BuildInstructionsOptions): string {
  const { useCustom, customInstructions, promptVoiceId } = options;

  const pieces: string[] = [];

  // 1) System layer – always included
  pieces.push(BASE_SYSTEM_INSTRUCTIONS);

  // 2) Prompt voice layer – selected style
  const voiceInstructions = getPromptVoiceInstructions(promptVoiceId ?? "default");
  if (voiceInstructions.trim().length > 0) {
    pieces.push(voiceInstructions.trim());
  }

  // 3) Custom layer – only if enabled and non-empty
  if (useCustom) {
    const trimmed = customInstructions.trim();
    if (trimmed.length > 0) {
      pieces.push(trimmed);
    }
  }

  return pieces.join("\n\n");
}

export function buildInputForPageSummary(text: string, structureSummary?: string): string {
  const lines: string[] = [];

  lines.push("Summarize and explain the following documentation.");
  lines.push("Produce clean, valid Markdown with consistent structure.");

  lines.push("");
  lines.push("DOCUMENTATION:");
  lines.push(text);
  lines.push("");

  if (structureSummary && structureSummary.trim().length > 0) {
    lines.push("");
    lines.push(structureSummary.trim())
  }
  lines.push("=== RESPONSE FORMAT ===");
  lines.push(MARKDOWN_FORMAT_HINT);

  return lines.join("\n");
}

export function buildInputForConversation(
  pageText: string,
  history: Message[]
): string {
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

type CallMode = "summary" | "chat";

export async function callOpenAI(
  input: string,
  instructions: string,
  modelSettings: ModelSettings,
  mode: CallMode
): Promise<string> {
  const apiKey = await ensureApiKey();
  if (!apiKey) {
    throw new Error("API key missing");
  }

  // Debug logging: see exactly what we send
  console.groupCollapsed(
    `[Docs Summarizer] OpenAI request (${mode}) – ${new Date().toISOString()}`
  );
  console.log("Model settings", modelSettings);
  console.log("Instructions (final composite prompt)", instructions);
  console.log("Input (first 8000 chars)", input.slice(0, 8000));
  console.groupEnd();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`, // API key is NOT logged anywhere
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelSettings.model,
      instructions,
      input,
      max_output_tokens: 8000,
      reasoning: { effort: modelSettings.reasoningEffort },
      text: {
        verbosity: modelSettings.verbosity,
      },
    }),
  });

  const status = response.status;
  let data: any;

  try {
    data = await response.json();
  } catch (e) {
    console.error("[Docs Summarizer] Failed to parse OpenAI JSON", e);
    throw new Error(`OpenAI error (invalid JSON, status ${status})`);
  }

  console.groupCollapsed(
    `[Docs Summarizer] OpenAI response (${mode}) – status ${status}`
  );
  console.log("Raw response JSON", data);
  console.log("response.status field", data?.status);
  console.log("response.incomplete_details", data?.incomplete_details);
  console.log("response.error", data?.error);
  console.groupEnd();

  // HTTP-level error
  if (!response.ok) {
    const msg =
      data?.error?.message ??
      data?.error ??
      `HTTP ${status}`;
    throw new Error(`OpenAI error: ${msg}`);
  }

  // API-level error inside JSON
  if (data?.error) {
    const msg =
      data.error.message ??
      data.error.type ??
      JSON.stringify(data.error);
    throw new Error(`OpenAI error: ${msg}`);
  }

  // Responses API status field (completed / incomplete / failed / cancelled)
  if (data?.status && data.status !== "completed") {
    const details = data?.incomplete_details
      ? ` – details: ${JSON.stringify(data.incomplete_details)}`
      : "";
    throw new Error(
      `OpenAI response not completed (status: ${data.status})${details}`
    );
  }

  const summaryText = extractTextFromResponse(data);

  if (!summaryText || !summaryText.trim()) {
    // Last fallback: show that we saw a "successful" but empty payload
    throw new Error(
      "The model returned an empty response (no text blocks found). " +
        "Try reducing the amount of page text or adjusting instructions."
    );
  }

  return summaryText;
}

// ------------ High-level helpers --------------

export async function summarizeWithOpenAI(
  pageText: string,
  pageStructureSummary: string | null,
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings
): Promise<string> {
  const input = buildInputForPageSummary(pageText, pageStructureSummary ?? "");

  const instructions = buildInstructions({
    useCustom,
    customInstructions,
    promptVoiceId,
  });

  console.log("[Docs Summarizer] Using prompt voice (summary)", { promptVoiceId });

  return callOpenAI(input, instructions, modelSettings, "summary");
}

export async function chatWithOpenAI(
  pageText: string,
  history: Message[],
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings
): Promise<string> {
  const input = buildInputForConversation(pageText, history);

  const instructions = buildInstructions({
    useCustom,
    customInstructions,
    promptVoiceId,
  });

  console.log("[Docs Summarizer] Using prompt voice (chat)", { promptVoiceId });

  return callOpenAI(input, instructions, modelSettings, "chat");
}

// ------------ Response extractor --------------

export function extractTextFromResponse(data: any): string {
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

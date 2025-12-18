// src/extension/openai.ts
import { ensureApiKey } from "./storage/apiKey";
import { BASE_SYSTEM_INSTRUCTIONS, MARKDOWN_FORMAT_HINT, GPT5_NANO_PRICING } from "./constants";
import type { Message, ModelSettings, TokenUsage } from "./types";
import { getPromptVoiceInstructions, PromptVoiceId } from "./prompts/voices";
import type { StyleCommand } from "./styleCommands";
import { buildStyleInstructions } from "./styleCommands";

export interface OpenAIResponse {
  text: string;
  responseTime: number; // in seconds
  tokenUsage: TokenUsage | null;
}

export interface BuildInstructionsOptions {
  useCustom: boolean;
  customInstructions: string;
  promptVoiceId?: PromptVoiceId; // optional for now
  styleCommands?: StyleCommand[]; // Style modifier commands
}

export function buildInstructions(options: BuildInstructionsOptions): string {
  const { useCustom, customInstructions, promptVoiceId, styleCommands } = options;

  const pieces: string[] = [];

  // 1) System layer – always included
  pieces.push(BASE_SYSTEM_INSTRUCTIONS);

  // 2) Style commands layer – if present, add before voice to allow voice to override if needed
  if (styleCommands && styleCommands.length > 0) {
    const styleInstructions = buildStyleInstructions(styleCommands);
    if (styleInstructions) {
      pieces.push(styleInstructions);
    }
  }

  // 3) Prompt voice layer – selected style
  const voiceInstructions = getPromptVoiceInstructions(promptVoiceId ?? "default");
  if (voiceInstructions.trim().length > 0) {
    pieces.push(voiceInstructions.trim());
  }

  // 4) Custom layer – only if enabled and non-empty
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

/**
 * Strips scroll links from assistant messages to prevent the model from
 * referencing its own generated (potentially invalid) phrases.
 * Converts [text](#scroll:phrase) to just "text"
 */
function stripScrollLinks(text: string): string {
  // Match both #scroll: and scroll: patterns
  // Pattern: [label text](#scroll:phrase) or [label text](scroll:phrase)
  // Replace with just the label text
  return text.replace(/\[([^\]]+)\]\(#?scroll:[^)]+\)/g, "$1");
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
      // Strip scroll links from assistant messages to prevent model from
      // referencing its own generated (potentially invalid) phrases
      const messageText = msg.role === "assistant" 
        ? stripScrollLinks(msg.text)
        : msg.text;
      lines.push(`${prefix}: ${messageText}`);
    }
    lines.push("");
    lines.push("CRITICAL REMINDER: When creating #scroll: links, you MUST ONLY reference phrases from the PAGE CONTENT section above, NEVER from your own previous responses. Your previous responses are shown for context only—do not create scroll links to phrases you mentioned in those responses.");
  }

  lines.push("");
  lines.push("Continue the conversation as the assistant, responding to the most recent user message.");
  lines.push("");
  lines.push("=== RESPONSE FORMAT ===");
  lines.push(MARKDOWN_FORMAT_HINT);

  return lines.join("\n");
}

type CallMode = "summary" | "chat";

/**
 * Extracts token usage from OpenAI API response
 */
export function extractTokenUsage(data: any): TokenUsage | null {
  if (!data?.usage) {
    return null;
  }

  const usage = data.usage;
  
  // Handle both naming conventions
  const inputTokens = Math.max(0, usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Math.max(0, usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

  // Guard against negative or invalid values
  if (totalTokens < 0 || (inputTokens === 0 && outputTokens === 0 && !usage.total_tokens)) {
    return null;
  }

  // If we don't have both input and output, we can't calculate cost accurately
  if (inputTokens === 0 && outputTokens === 0) {
    return null;
  }

  const cost = calculateTokenCost(inputTokens, outputTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
  };
}

/**
 * Calculates cost in dollars for gpt-5-nano based on token usage
 */
export function calculateTokenCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GPT5_NANO_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * GPT5_NANO_PRICING.output;
  return inputCost + outputCost;
}

export async function callOpenAI(
  input: string,
  instructions: string,
  modelSettings: ModelSettings,
  mode: CallMode,
  history?: Message[] // Optional history for better error logging
): Promise<OpenAIResponse> {
  // Ensure API key exists (shows prompt if needed - UI must be in content script)
  // But we don't use the key here - background script will read it from storage
  const apiKeyExists = await ensureApiKey();
  if (!apiKeyExists) {
    throw new Error("API key missing");
  }

  // Send request to background script (API key never leaves storage)
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "OPENAI_REQUEST",
        payload: {
          input,
          instructions,
          modelSettings: {
            model: modelSettings.model,
            reasoningEffort: modelSettings.reasoningEffort,
            verbosity: modelSettings.verbosity,
            maxOutputTokens: modelSettings.maxOutputTokens,
          },
          mode,
          history,
        },
      },
      (response: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Extension error: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        if (response.success) {
          resolve({
            text: response.text,
            responseTime: response.responseTime,
            tokenUsage: response.tokenUsage,
          });
        } else {
          reject(new Error("Unknown error from background script"));
        }
      }
    );
  });
}

// ------------ High-level helpers --------------

export async function summarizeWithOpenAI(
  pageText: string,
  pageStructureSummary: string | null,
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings,
  styleCommands?: StyleCommand[]
): Promise<OpenAIResponse> {
  const input = buildInputForPageSummary(pageText, pageStructureSummary ?? "");

  const instructionsOptions: BuildInstructionsOptions = {
    useCustom,
    customInstructions,
    promptVoiceId,
  };
  if (styleCommands && styleCommands.length > 0) {
    instructionsOptions.styleCommands = styleCommands;
  }
  const instructions = buildInstructions(instructionsOptions);

  console.log("[Docs Summarizer] Using prompt voice (summary)", { promptVoiceId, styleCommands });

  return callOpenAI(input, instructions, modelSettings, "summary", undefined);
}

export async function chatWithOpenAI(
  pageText: string,
  history: Message[],
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings,
  styleCommands?: StyleCommand[]
): Promise<OpenAIResponse> {
  const input = buildInputForConversation(pageText, history);

  const instructionsOptions: BuildInstructionsOptions = {
    useCustom,
    customInstructions,
    promptVoiceId,
  };
  if (styleCommands && styleCommands.length > 0) {
    instructionsOptions.styleCommands = styleCommands;
  }
  const instructions = buildInstructions(instructionsOptions);

  console.log("[Docs Summarizer] Using prompt voice (chat)", { promptVoiceId, styleCommands });

  return callOpenAI(input, instructions, modelSettings, "chat", history);
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

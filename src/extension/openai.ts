// src/extension/openai.ts
import { ensureApiKey } from "./storage/apiKey";
import { BASE_SYSTEM_INSTRUCTIONS, MARKDOWN_FORMAT_HINT, GPT5_NANO_PRICING } from "./constants";
import type { Message, ModelSettings, TokenUsage } from "./types";
import { getPromptVoiceInstructions, PromptVoiceId } from "./prompts/voices";

export interface OpenAIResponse {
  text: string;
  responseTime: number; // in seconds
  tokenUsage: TokenUsage | null;
}

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
  console.log("Input (first 10000 chars)", input.slice(0, 10000));
  console.groupEnd();

  // Track response time
  const startTime = performance.now();

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
      max_output_tokens: modelSettings.maxOutputTokens,
      reasoning: { effort: modelSettings.reasoningEffort },
      text: {
        verbosity: modelSettings.verbosity,
      },
    }),
  });

  const endTime = performance.now();
  const responseTime = (endTime - startTime) / 1000; // Convert to seconds

  const status = response.status;
  let data: any;

  try {
    data = await response.json();
  } catch (e) {
    console.error("[Docs Summarizer] Failed to parse OpenAI JSON", e);
    throw new Error(`OpenAI error (invalid JSON, status ${status})`);
  }

  // Always expand logs for errors, collapse for success
  const logGroup = (data?.status !== "completed" || data?.error)
    ? console.group  // Always expanded for errors
    : console.groupCollapsed; // Collapsed for success

  logGroup(
    `[Docs Summarizer] OpenAI response (${mode}) – status ${status}`
  );
  console.log("Raw response JSON", data);
  console.log("response.status field", data?.status);
  console.log("response.incomplete_details", data?.incomplete_details);
  console.log("response.error", data?.error);
  console.log("response.usage", data?.usage);
  
  // If incomplete or error, also log what we sent
  if (data?.status !== "completed" || data?.error) {
    console.log("Input length:", input.length, "chars");
    console.log("Instructions length:", instructions.length, "chars");
    console.log("Full input sent (last 2000 chars):", input.slice(-2000));
    console.log("Full instructions sent (last 1000 chars):", instructions.slice(-1000));
    
    // For content_filter specifically, we'll log full input in the error section below
    // But also log page text length here to understand context
    if (data?.incomplete_details?.reason === "content_filter" && input.includes("=== PAGE CONTENT ===")) {
      const pageContentMatch = input.match(/=== PAGE CONTENT[^=]*===\s*\n([\s\S]*?)\n\n=== CONVERSATION/);
      if (pageContentMatch && pageContentMatch[1]) {
        console.log("Page content length:", pageContentMatch[1].length, "chars");
        console.log("Page content preview (first 500 chars):", pageContentMatch[1].slice(0, 500));
      }
    }
  }
  
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
    // Try to extract any partial text that was generated before the filter triggered
    let partialText = "";
    try {
      partialText = extractTextFromResponse(data) || "";
    } catch (e) {
      // Ignore extraction errors
    }
    
    const tokenUsage = extractTokenUsage(data);
    let tokenInfo = "";
    
    if (data?.incomplete_details?.reason === "max_tokens" || data?.status === "incomplete") {
      if (tokenUsage) {
        tokenInfo = ` (Used ${tokenUsage.totalTokens.toLocaleString()} tokens, max was ${modelSettings.maxOutputTokens?.toLocaleString() || modelSettings.maxOutputTokens})`;
      } else if (data?.usage?.total_tokens) {
        const totalTokens = Math.max(0, data.usage.total_tokens);
        tokenInfo = ` (Used ${totalTokens.toLocaleString()} tokens, max was ${modelSettings.maxOutputTokens?.toLocaleString() || modelSettings.maxOutputTokens})`;
      } else {
        tokenInfo = ` (Max tokens: ${modelSettings.maxOutputTokens?.toLocaleString() || modelSettings.maxOutputTokens})`;
      }
    }
    
    // Enhanced logging for content_filter errors
    if (data?.incomplete_details?.reason === "content_filter") {
      console.error("[Docs Summarizer] ⚠️ CONTENT FILTER TRIGGERED ⚠️");
      console.error("Partial response text (before filter):", partialText || "(no partial text available)");
      console.error("Partial text length:", partialText.length, "chars");
      if (partialText) {
        console.error("First 500 chars of partial response:", partialText.slice(0, 500));
        console.error("Last 500 chars of partial response:", partialText.slice(-500));
      }
      console.error("Full incomplete_details:", JSON.stringify(data.incomplete_details, null, 2));
      console.error("Full response data:", JSON.stringify(data, null, 2));
      
      // Log the input that was sent
      console.error("=== FULL INPUT SENT (for content_filter analysis) ===");
      console.error("Input length:", input.length, "chars");
      console.error("Full input:", input);
      console.error("=== FULL INSTRUCTIONS SENT ===");
      console.error("Instructions length:", instructions.length, "chars");
      console.error("Full instructions:", instructions);
      
      // Also log just the user's most recent message if we can extract it
      if (input.includes("User:") || input.includes("=== CONVERSATION SO FAR ===")) {
        const userMsgMatch = input.match(/User:\s*([^\n]+(?:\n(?!User:|Assistant:)[^\n]+)*)/);
        if (userMsgMatch && userMsgMatch[1]) {
          console.error("=== USER'S MOST RECENT MESSAGE ===");
          console.error(userMsgMatch[1]);
        }
      }
      
      // Log conversation history if available
      if (mode === "chat") {
        if (history && history.length > 0) {
          console.error("Conversation history (last 5 messages):");
          history.slice(-5).forEach((msg, i) => {
            const preview = msg.text.slice(0, 300);
            console.error(`  [${i}] ${msg.role}: ${preview}${msg.text.length > 300 ? '...' : ''}`);
          });
          console.error("Total messages in history:", history.length);
        } else if (input.includes("=== CONVERSATION SO FAR ===")) {
          // Fallback: try to extract from input string
          const historyStart = input.indexOf("=== CONVERSATION SO FAR ===");
          const historyEnd = input.indexOf("Continue the conversation");
          if (historyStart !== -1 && historyEnd !== -1) {
            const historySection = input.slice(historyStart, historyEnd);
            console.error("Conversation history section (from input):", historySection.slice(0, 2000));
            // Count messages
            const messageMatches = historySection.match(/(User|Assistant):/g);
            console.error("Number of messages in history:", messageMatches?.length || 0);
          }
        }
      }
    }
    
    const details = data?.incomplete_details
      ? ` – details: ${JSON.stringify(data.incomplete_details)}`
      : "";
    
    // Include partial text in error message if available
    const partialTextInfo = partialText 
      ? `\n\n⚠️ Partial response before filter (${partialText.length} chars): "${partialText.slice(0, 200)}${partialText.length > 200 ? '...' : ''}"`
      : "";
    
    throw new Error(
      `OpenAI response not completed (status: ${data.status})${tokenInfo}${details}${partialTextInfo}`
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

  // Extract token usage
  const tokenUsage = extractTokenUsage(data);

  return {
    text: summaryText,
    responseTime,
    tokenUsage,
  };
}

// ------------ High-level helpers --------------

export async function summarizeWithOpenAI(
  pageText: string,
  pageStructureSummary: string | null,
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings
): Promise<OpenAIResponse> {
  const input = buildInputForPageSummary(pageText, pageStructureSummary ?? "");

  const instructions = buildInstructions({
    useCustom,
    customInstructions,
    promptVoiceId,
  });

  console.log("[Docs Summarizer] Using prompt voice (summary)", { promptVoiceId });

  return callOpenAI(input, instructions, modelSettings, "summary", undefined);
}

export async function chatWithOpenAI(
  pageText: string,
  history: Message[],
  useCustom: boolean,
  customInstructions: string,
  promptVoiceId: PromptVoiceId,
  modelSettings: ModelSettings
): Promise<OpenAIResponse> {
  const input = buildInputForConversation(pageText, history);

  const instructions = buildInstructions({
    useCustom,
    customInstructions,
    promptVoiceId,
  });

  console.log("[Docs Summarizer] Using prompt voice (chat)", { promptVoiceId });

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

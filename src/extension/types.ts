type MessageRole = "user" | "assistant";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number; // in dollars
}

export interface Message {
    id: string;
    role: MessageRole;
    text: string;
    loading?: boolean; // True when waiting for OpenAI response
    voiceId?: string; // Optional: prompt voice ID used for assistant messages
    responseTime?: number; // Response time in seconds
    tokenUsage?: TokenUsage | null; // Token usage and cost information (null when not available)
}
// gpt-5.1
// Complex reasoning, broad world knowledge, and code-heavy or multi-step agentic tasks
// gpt-5-mini
// Cost-optimized reasoning and chat; balances speed, cost, and capability
// gpt-5-nano
// High-throughput tasks, especially simple instruction-following or classification
export type ModelId = "gpt-5-nano" | "gpt-5-mini" | "gpt-5.1";

export type ReasoningEffort = "low" | "medium" | "high";

export type VerbosityLevel = "low" | "medium" | "high";

export interface ModelSettings {
  model: ModelId;
  reasoningEffort: ReasoningEffort;
  verbosity: VerbosityLevel;
  maxOutputTokens: number; // Maximum output tokens (default: 10000)
}
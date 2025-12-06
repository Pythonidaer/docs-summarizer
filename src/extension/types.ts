type MessageRole = "user" | "assistant";

export interface Message {
    id: string;
    role: MessageRole;
    text: string;
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
}
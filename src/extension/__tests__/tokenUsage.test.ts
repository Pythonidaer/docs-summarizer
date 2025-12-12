/** @jest-environment node */
import { calculateTokenCost, extractTokenUsage } from "../openai";
import { GPT5_NANO_PRICING } from "../constants";
import type { TokenUsage } from "../types";

describe("extractTokenUsage", () => {
  test("extracts token usage from standard response format", () => {
    const responseData = {
      status: "completed",
      output_text: "Test response",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
      },
    };

    const result = extractTokenUsage(responseData);
    expect(result).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: expect.any(Number),
    });
  });

  test("extracts token usage with prompt_tokens and completion_tokens", () => {
    const responseData = {
      status: "completed",
      output_text: "Test response",
      usage: {
        prompt_tokens: 2000,
        completion_tokens: 800,
        total_tokens: 2800,
      },
    };

    const result = extractTokenUsage(responseData);
    expect(result).toEqual({
      inputTokens: 2000,
      outputTokens: 800,
      totalTokens: 2800,
      cost: expect.any(Number),
    });
  });

  test("returns null when usage data is missing", () => {
    const responseData = {
      status: "completed",
      output_text: "Test response",
    };

    const result = extractTokenUsage(responseData);
    expect(result).toBeNull();
  });

  test("handles partial usage data gracefully", () => {
    const responseData = {
      status: "completed",
      output_text: "Test response",
      usage: {
        total_tokens: 1500,
        // Missing input/output breakdown
      },
    };

    const result = extractTokenUsage(responseData);
    // Should still calculate cost if we have total_tokens
    expect(result).toBeNull(); // For now, we require both input and output
  });
});

describe("calculateTokenCost", () => {
  test("calculates cost correctly for gpt-5-nano", () => {
    const usage: TokenUsage = {
      inputTokens: 1000000, // 1M tokens
      outputTokens: 1000000, // 1M tokens
      totalTokens: 2000000,
      cost: 0, // Will be calculated
    };

    const cost = calculateTokenCost(usage.inputTokens, usage.outputTokens);
    
    // Input: 1M * $0.05 = $0.05
    // Output: 1M * $0.40 = $0.40
    // Total: $0.45
    expect(cost).toBeCloseTo(0.45, 6);
  });

  test("calculates cost for small token counts", () => {
    const cost = calculateTokenCost(1000, 500);
    
    // Input: 1000 / 1M * $0.05 = $0.00005
    // Output: 500 / 1M * $0.40 = $0.0002
    // Total: $0.00025
    expect(cost).toBeCloseTo(0.00025, 10);
  });

  test("handles zero tokens", () => {
    const cost = calculateTokenCost(0, 0);
    expect(cost).toBe(0);
  });

  test("handles very large token counts", () => {
    const cost = calculateTokenCost(5000000, 3000000);
    
    // Input: 5M * $0.05 = $0.25
    // Output: 3M * $0.40 = $1.20
    // Total: $1.45
    expect(cost).toBeCloseTo(1.45, 6);
  });
});


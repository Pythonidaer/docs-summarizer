import {
  getPromptVoiceInstructions,
  PROMPT_VOICES,
  type PromptVoiceId,
} from "../prompts/voices";

describe("getPromptVoiceInstructions", () => {
  test("returns correct instructions for each voice ID", () => {
    for (const voice of PROMPT_VOICES) {
      const instructions = getPromptVoiceInstructions(voice.id);
      expect(instructions).toBe(voice.instructions);
      expect(instructions.trim().length).toBeGreaterThan(0);
    }
  });

  test("returns default voice instructions when ID is null", () => {
    const defaultVoice = PROMPT_VOICES.find((v) => v.id === "default");
    const result = getPromptVoiceInstructions(null);
    expect(result).toBe(defaultVoice?.instructions);
  });

  test("returns default voice instructions when ID is undefined", () => {
    const defaultVoice = PROMPT_VOICES.find((v) => v.id === "default");
    const result = getPromptVoiceInstructions(undefined);
    expect(result).toBe(defaultVoice?.instructions);
  });

  test("returns empty string for invalid ID (implementation behavior)", () => {
    // Implementation returns empty string for invalid IDs, not default
    const result = getPromptVoiceInstructions("invalid_voice_id" as PromptVoiceId);
    expect(result).toBe("");
  });

  test("returns empty string for missing voice (edge case)", () => {
    // This shouldn't happen in practice, but test the fallback
    // Instead of modifying PROMPT_VOICES (which could affect other tests),
    // we just verify the behavior with an invalid ID
    const result = getPromptVoiceInstructions("nonexistent" as PromptVoiceId);
    expect(result).toBe("");
  });
});

describe("PROMPT_VOICES data integrity", () => {
  test("all voices have required fields", () => {
    for (const voice of PROMPT_VOICES) {
      expect(voice.id).toBeDefined();
      expect(voice.label).toBeDefined();
      expect(voice.description).toBeDefined();
      expect(voice.instructions).toBeDefined();
      expect(typeof voice.id).toBe("string");
      expect(typeof voice.label).toBe("string");
      expect(typeof voice.description).toBe("string");
      expect(typeof voice.instructions).toBe("string");
      expect(voice.id.length).toBeGreaterThan(0);
      expect(voice.label.length).toBeGreaterThan(0);
      expect(voice.description.length).toBeGreaterThan(0);
      expect(voice.instructions.trim().length).toBeGreaterThan(0);
    }
  });

  test("no duplicate voice IDs", () => {
    const ids = PROMPT_VOICES.map((v) => v.id);
    const uniqueIds = new Set(ids);
    // Check that all IDs are unique
    expect(ids.length).toBe(uniqueIds.size);
    // Verify we have the expected number of voices (10)
    expect(PROMPT_VOICES.length).toBe(10);
  });

  test("all voice IDs are valid PromptVoiceId types", () => {
    const validIds: PromptVoiceId[] = [
      "default",
      "teacher",
      "senior_engineer",
      "simplifier",
      "organizer",
      "socratic",
      "in_depth",
      "mla_essay",
      "technical_report",
      "research_abstract",
    ];

    for (const voice of PROMPT_VOICES) {
      expect(validIds).toContain(voice.id);
    }
  });

  test("default voice exists", () => {
    const defaultVoice = PROMPT_VOICES.find((v) => v.id === "default");
    expect(defaultVoice).toBeDefined();
    expect(defaultVoice?.label).toBe("Default");
  });

  test("all voices have non-empty instructions", () => {
    for (const voice of PROMPT_VOICES) {
      const trimmed = voice.instructions.trim();
      expect(trimmed.length).toBeGreaterThan(0);
      expect(trimmed).not.toBe("");
    }
  });
});


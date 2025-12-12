/** @jest-environment jsdom */

// Mock chrome API before importing
(global as any).chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
};

import { wireDrawerEvents } from "../ui/events";
import { renderMessages } from "../ui/messages";
import { summarizeWithOpenAI } from "../openai";
import { extractPageTextFromDoc } from "../content-script";
import { extractPageStructure, serializePageStructureForModel } from "../pageStructure";
import { setPageTextForLinks } from "../pageText";
import type { Message, ModelSettings } from "../types";
import type { PromptVoiceId } from "../prompts/voices";

// Mock dependencies
jest.mock("../openai");
jest.mock("../content-script");
jest.mock("../pageStructure");
jest.mock("../pageText");
jest.mock("../ui/messages");

const mockSummarizeWithOpenAI = summarizeWithOpenAI as jest.MockedFunction<typeof summarizeWithOpenAI>;
const mockExtractPageTextFromDoc = extractPageTextFromDoc as jest.MockedFunction<typeof extractPageTextFromDoc>;
const mockExtractPageStructure = extractPageStructure as jest.MockedFunction<typeof extractPageStructure>;
const mockSerializePageStructureForModel = serializePageStructureForModel as jest.MockedFunction<typeof serializePageStructureForModel>;
const mockSetPageTextForLinks = setPageTextForLinks as jest.MockedFunction<typeof setPageTextForLinks>;
const mockRenderMessages = renderMessages as jest.MockedFunction<typeof renderMessages>;

describe("wireDrawerEvents - summarize button", () => {
  let root: HTMLDivElement;
  let drawer: HTMLDivElement;
  let handle: HTMLDivElement;
  let closeButton: HTMLButtonElement;
  let chatInput: HTMLTextAreaElement;
  let sendBtn: HTMLButtonElement;
  let summarizeBtn: HTMLButtonElement;
  let main: HTMLDivElement;
  let messages: Message[];
  let pageText: string;
  let pageStructureSummary: string;
  let setDrawerOpen: jest.Mock;
  let getUseCustomInstructions: jest.Mock;
  let getCustomInstructions: jest.Mock;
  let getPromptVoiceId: jest.Mock;
  let getModelSettings: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockRenderMessages.mockImplementation(() => {});

    // Create DOM elements
    root = document.createElement("div");
    drawer = document.createElement("div");
    handle = document.createElement("div");
    closeButton = document.createElement("button");
    chatInput = document.createElement("textarea");
    sendBtn = document.createElement("button");
    summarizeBtn = document.createElement("button");
    summarizeBtn.textContent = "Summarize";
    main = document.createElement("div");
    document.body.appendChild(main);

    // Initialize state
    messages = [];
    pageText = "Sample page text content";
    pageStructureSummary = "Page structure summary";
    setDrawerOpen = jest.fn();
    getUseCustomInstructions = jest.fn().mockReturnValue(false);
    getCustomInstructions = jest.fn().mockReturnValue("");
    getPromptVoiceId = jest.fn().mockReturnValue("default" as PromptVoiceId);
    getModelSettings = jest.fn().mockReturnValue({
      model: "gpt-5-nano",
      reasoningEffort: "low",
      verbosity: "low",
    } as ModelSettings);

    // Setup default mocks
    mockExtractPageTextFromDoc.mockReturnValue(pageText);
    mockExtractPageStructure.mockReturnValue({ blocks: [] });
    mockSerializePageStructureForModel.mockReturnValue(pageStructureSummary);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("adds user message 'Summarize' when summarize button is clicked", async () => {
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "This is a summary",
      responseTime: 1.5,
      tokenUsage: null,
    });

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    // Click summarize button
    summarizeBtn.click();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that user message was added
    expect(messages.length).toBeGreaterThan(0);
    const userMessage = messages.find(m => m.role === "user" && m.text === "Summarize");
    expect(userMessage).toBeDefined();
    expect(mockRenderMessages).toHaveBeenCalled();
  });

  test("adds assistant message after successful summary", async () => {
    const summaryText = "This is the generated summary";
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: summaryText,
      responseTime: 2.5,
      tokenUsage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cost: 0.0000525,
      },
    });

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that both user and assistant messages are present
    expect(messages.length).toBe(2);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.text).toBe("Summarize");
    expect(messages[1]?.role).toBe("assistant");
    expect(messages[1]?.text).toBe(summaryText);
  });

  test("removes user message if summary fails", async () => {
    const error = new Error("Summary failed");
    mockSummarizeWithOpenAI.mockRejectedValue(error);

    // Mock alert to avoid actual alert in tests
    const mockAlert = jest.fn();
    global.alert = mockAlert;

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that user message was removed after error
    expect(messages.length).toBe(0);
    expect(mockAlert).toHaveBeenCalled();
  });

  test("removes user message if no text found on page", async () => {
    // Mock empty page text
    pageText = "";
    mockExtractPageTextFromDoc.mockReturnValue("");

    // Mock alert
    const mockAlert = jest.fn();
    global.alert = mockAlert;

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    // Wait for retry delays (500ms + 1000ms) plus some buffer
    await new Promise(resolve => setTimeout(resolve, 1600));

    // Check that user message was not added (or was removed) when no text found
    const userMessages = messages.filter(m => m.role === "user" && m.text === "Summarize");
    expect(userMessages.length).toBe(0);
    expect(mockAlert).toHaveBeenCalled();
  });

  test("calls renderMessages after adding user message", async () => {
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "Summary",
      responseTime: 1.0,
      tokenUsage: null,
    });

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that renderMessages was called with messages array containing user message
    expect(mockRenderMessages).toHaveBeenCalled();
    const calls = mockRenderMessages.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messagesArg = calls[0]?.[1];
    expect(messagesArg).toBeDefined();
    const userMsg = messagesArg?.find((m: Message) => m.role === "user" && m.text === "Summarize");
    expect(userMsg).toBeDefined();
  });

  test("button text always restores to 'Summarize page' after summary", async () => {
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "Summary",
      responseTime: 1.0,
      tokenUsage: null,
    });
    summarizeBtn.textContent = "Summarize page"; // Initial state

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Button should restore to "Summarize page" regardless of previous state
    expect(summarizeBtn.textContent).toBe("Summarize");
    expect(summarizeBtn.disabled).toBe(false);
  });

  test("button text restores to 'Summarize page' even if it was 'Summarizing…' before", async () => {
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "Summary",
      responseTime: 1.0,
      tokenUsage: null,
    });
    summarizeBtn.textContent = "Summarizing…"; // Simulate previous state

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Button should restore to "Summarize page" even if it was "Summarizing…" before
    expect(summarizeBtn.textContent).toBe("Summarize");
  });

  test("summarize does not use custom instructions (only prompt voice)", async () => {
    getUseCustomInstructions.mockReturnValue(true);
    getCustomInstructions.mockReturnValue("Custom instruction text");
    getPromptVoiceId.mockReturnValue("visual_mapper" as PromptVoiceId);
    getModelSettings.mockReturnValue({
      model: "gpt-5-nano",
      reasoningEffort: "low",
      verbosity: "low",
      maxOutputTokens: 10000,
    } as ModelSettings);
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "Summary",
      responseTime: 1.0,
      tokenUsage: null,
    });

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that summarizeWithOpenAI was called with useCustom=false
    expect(mockSummarizeWithOpenAI).toHaveBeenCalledWith(
      pageText,
      pageStructureSummary,
      false, // useCustom should be false for summarize
      "", // customInstructions should be empty
      "visual_mapper", // prompt voice should still be used
      expect.objectContaining({
        maxOutputTokens: expect.any(Number),
      }) // modelSettings
    );
  });

  test("assistant message includes voiceId when summarize succeeds", async () => {
    getPromptVoiceId.mockReturnValue("visual_mapper" as PromptVoiceId);
    mockSummarizeWithOpenAI.mockResolvedValue({
      text: "Summary text",
      responseTime: 2.0,
      tokenUsage: {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        cost: 0.000105,
      },
    });

    wireDrawerEvents({
      root,
      drawer,
      handle,
      closeButton,
      chatInput,
      sendBtn,
      summarizeBtn,
      main,
      pageText,
      pageStructureSummary,
      messages,
      setDrawerOpen,
      getUseCustomInstructions,
      getCustomInstructions,
      getPromptVoiceId,
      getModelSettings,
    });

    summarizeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that assistant message has voiceId
    const assistantMessage = messages.find(m => m.role === "assistant");
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.voiceId).toBe("visual_mapper");
  });
});


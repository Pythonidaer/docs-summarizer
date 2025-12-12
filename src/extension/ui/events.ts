// src/extension/ui/events.ts
import { chatWithOpenAI, summarizeWithOpenAI } from "../openai";
import { renderMessages } from "./messages";
import type { Message, ModelSettings } from "../types";
import type { PromptVoiceId } from "../prompts/voices";
import { extractPageTextFromDoc } from "../content-script";
import { extractPageStructure, serializePageStructureForModel } from "../pageStructure";
import { setPageTextForLinks } from "../pageText";

export interface WireDrawerEventsArgs {
  root: HTMLDivElement;
  drawer: HTMLDivElement;
  handle: HTMLDivElement;
  closeButton: HTMLButtonElement;
  chatInput: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  summarizeBtn: HTMLButtonElement;
  main: HTMLDivElement;
  pageText: string;
  pageStructureSummary: string;
  messages: Message[];
  setDrawerOpen: (
    root: HTMLDivElement,
    drawer: HTMLDivElement,
    handle: HTMLDivElement,
    isOpen: boolean
  ) => void;
  getUseCustomInstructions: () => boolean;
  getCustomInstructions: () => string;
  getPromptVoiceId: () => PromptVoiceId;
  getModelSettings: () => ModelSettings;
}

export function wireDrawerEvents({
  root,
  drawer,
  handle,
  closeButton,
  chatInput,
  sendBtn,
  summarizeBtn,
  main,
  pageText,
  messages,
  pageStructureSummary,
  setDrawerOpen,
  getUseCustomInstructions,
  getCustomInstructions,
  getPromptVoiceId,
  getModelSettings,
}: WireDrawerEventsArgs): void {
  let isOpen = false;

  const handleSend = async () => {
    const userText = chatInput.value.trim();
    if (!userText) return;

    messages.push({
      id: `user-${Date.now()}`,
      role: "user",
      text: userText,
    });
    renderMessages(main, messages);
    chatInput.value = "";

    try {
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.5";

      const result = await chatWithOpenAI(
        pageText,
        messages,
        getUseCustomInstructions(),
        getCustomInstructions(),
        getPromptVoiceId(),
        getModelSettings()
      );

      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: result.text,
        responseTime: result.responseTime,
        tokenUsage: result.tokenUsage,
        voiceId: getPromptVoiceId(), // Include voiceId for metadata display
      });
      renderMessages(main, messages);

      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    } catch (err: any) {
      console.error("[Docs Summarizer] Chat error:", err);
      alert(`Docs Summarizer chat error: ${err?.message ?? String(err)}`);
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  };

  sendBtn.addEventListener("click", () => {
    void handleSend();
  });

  chatInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  });

  const toggle = () => {
    isOpen = !isOpen;
    setDrawerOpen(root, drawer, handle, isOpen);
  };

  handle.addEventListener("click", toggle);

  closeButton.addEventListener("click", () => {
    if (!isOpen) return;
    isOpen = false;
    setDrawerOpen(root, drawer, handle, isOpen);
  });

  summarizeBtn.addEventListener("click", async () => {
    // Add user message to show the summarize action in the chat
    const userMessageId = `user-${Date.now()}`;
    messages.push({
      id: userMessageId,
      role: "user",
      text: "Summarize",
    });
    renderMessages(main, messages);

    try {
      // Re-extract text if empty (handles SPAs that load content dynamically)
      let currentPageText = pageText;
      let currentPageStructureSummary = pageStructureSummary;
      
      if (!currentPageText || currentPageText.trim().length === 0) {
      summarizeBtn.disabled = true;
      const previousLabel = summarizeBtn.textContent;
      summarizeBtn.textContent = "Loading…";
        
        // Try extracting immediately
        currentPageText = extractPageTextFromDoc(document);
        
        // If still empty, wait a bit and retry (for SPAs that load content asynchronously)
        if (!currentPageText || currentPageText.trim().length === 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          currentPageText = extractPageTextFromDoc(document);
        }
        
        // If still empty after retry, wait a bit more
        if (!currentPageText || currentPageText.trim().length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait another 1s
          currentPageText = extractPageTextFromDoc(document);
        }
        
        // Re-extract structure if we got new text
        if (currentPageText && currentPageText.trim().length > 0) {
          const structure = extractPageStructure(document);
          currentPageStructureSummary = serializePageStructureForModel(structure);
          setPageTextForLinks(currentPageText);
        }
        
        if (!currentPageText || currentPageText.trim().length === 0) {
          // Remove user message since summary failed
          const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
          if (userMessageIndex !== -1) {
            messages.splice(userMessageIndex, 1);
            renderMessages(main, messages);
          }
          
          alert(
            "Docs Summarizer: No text found on this page.\n\n" +
            "This may be because:\n" +
            "• The page content hasn't loaded yet (try waiting a moment and clicking again)\n" +
            "• The page uses a format we can't extract text from\n" +
            "• The page is empty or contains only images/media"
          );
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = "Summarize"; // Always restore to this text
            return;
          }
          
          summarizeBtn.textContent = "Summarizing…";
        }

        summarizeBtn.disabled = true;
        summarizeBtn.textContent = "Summarizing…";

      const result = await summarizeWithOpenAI(
        currentPageText,
        currentPageStructureSummary,
        false, // Don't use custom instructions for summarize button
        "", // No custom instructions for summarize
        getPromptVoiceId(),
        getModelSettings()
      );

      const voiceId = getPromptVoiceId();
      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: result.text,
        voiceId, // Include voiceId so it can be displayed in the message
        responseTime: result.responseTime,
        tokenUsage: result.tokenUsage ?? null, // Keep null as null, convert undefined to null
      });
      renderMessages(main, messages);

        summarizeBtn.textContent = "Summarize"; // Always restore to this text
        summarizeBtn.disabled = false;
    } catch (err: any) {
      // Remove user message since summary failed
      const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
      if (userMessageIndex !== -1) {
        messages.splice(userMessageIndex, 1);
        renderMessages(main, messages);
      }
      
      console.error("[Docs Summarizer] Error:", err);
      alert(`Docs Summarizer error: ${err?.message ?? String(err)}`);
      summarizeBtn.disabled = false;
        summarizeBtn.textContent = "Summarize"; // Always restore to this text
    }
  });

  setDrawerOpen(root, drawer, handle, false);
}

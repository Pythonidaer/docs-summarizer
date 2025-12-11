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
      const previousLabel = sendBtn.textContent;
      sendBtn.textContent = "Sending…";

      const reply = await chatWithOpenAI(
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
        text: reply,
      });
      renderMessages(main, messages);

      sendBtn.disabled = false;
      sendBtn.textContent = previousLabel;
    } catch (err: any) {
      console.error("[Docs Summarizer] Chat error:", err);
      alert(`Docs Summarizer chat error: ${err?.message ?? String(err)}`);
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
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
    try {
      // Re-extract text if empty (handles SPAs that load content dynamically)
      let currentPageText = pageText;
      let currentPageStructureSummary = pageStructureSummary;
      
      if (!currentPageText || currentPageText.trim().length === 0) {
        summarizeBtn.disabled = true;
        const previousLabel = summarizeBtn.textContent;
        summarizeBtn.textContent = "Loading content…";
        
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
          alert(
            "Docs Summarizer: No text found on this page.\n\n" +
            "This may be because:\n" +
            "• The page content hasn't loaded yet (try waiting a moment and clicking again)\n" +
            "• The page uses a format we can't extract text from\n" +
            "• The page is empty or contains only images/media"
          );
          summarizeBtn.disabled = false;
          summarizeBtn.textContent = previousLabel;
          return;
        }
        
        summarizeBtn.textContent = "Summarizing…";
      }

      summarizeBtn.disabled = true;
      const previousLabel = summarizeBtn.textContent;
      if (summarizeBtn.textContent !== "Summarizing…") {
        summarizeBtn.textContent = "Summarizing…";
      }

      const summary = await summarizeWithOpenAI(
        currentPageText,
        currentPageStructureSummary,
        getUseCustomInstructions(),
        getCustomInstructions(),
        getPromptVoiceId(),
        getModelSettings()
      );

      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: summary,
      });
      renderMessages(main, messages);

      summarizeBtn.textContent = previousLabel;
      summarizeBtn.disabled = false;
    } catch (err: any) {
      console.error("[Docs Summarizer] Error:", err);
      alert(`Docs Summarizer error: ${err?.message ?? String(err)}`);
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = "Summarize page";
    }
  });

  setDrawerOpen(root, drawer, handle, false);
}

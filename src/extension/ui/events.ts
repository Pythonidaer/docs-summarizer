// src/extension/ui/events.ts
import { chatWithOpenAI, summarizeWithOpenAI } from "../openai";
import { renderMessages } from "./messages";
import type { Message, ModelSettings } from "../types";
import type { PromptVoiceId } from "../prompts/voices";

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
      if (!pageText) {
        alert("Docs Summarizer: No text found on this page.");
        return;
      }

      summarizeBtn.disabled = true;
      const previousLabel = summarizeBtn.textContent;
      summarizeBtn.textContent = "Summarizing…";

      const summary = await summarizeWithOpenAI(
        pageText,
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

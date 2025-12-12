// src/extension/ui/toolbar.ts
import { PROMPT_VOICES } from "../prompts/voices";
import {
  AVAILABLE_REASONING_LEVELS,
  MAX_OUTPUT_TOKEN_OPTIONS,
} from "../constants";
import { getBlurEnabled, setBlurEnabled } from "./focusBlur";

export interface ToolbarElements {
  toolbar: HTMLDivElement;
  blurCheckbox: HTMLInputElement;
  voiceSelect: HTMLSelectElement;
  reasoningSelect: HTMLSelectElement;
  maxTokensSelect: HTMLSelectElement;
  summarizeBtn: HTMLButtonElement;
  clearHighlightsBtn: HTMLButtonElement;
  detachBtn: HTMLButtonElement;
}

function createLabeledCheckbox(labelText: string): {
  container: HTMLLabelElement;
  checkbox: HTMLInputElement;
} {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    cursor: "pointer",
    opacity: "0.9",
  } as CSSStyleDeclaration);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.style.margin = "0";

  const span = document.createElement("span");
  span.textContent = labelText;

  label.appendChild(checkbox);
  label.appendChild(span);

  return { container: label, checkbox };
}

function createLabeledSelect(
  labelText: string,
  options: { id: string; label: string }[]
): { container: HTMLLabelElement; select: HTMLSelectElement } {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    cursor: "pointer",
    opacity: "0.9",
    whiteSpace: "nowrap",
  } as CSSStyleDeclaration);

  const span = document.createElement("span");
  span.textContent = labelText;

  const select = document.createElement("select");
  Object.assign(select.style, {
    fontSize: "12px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#050505",
    color: "#f5f5f5",
    maxWidth: "220px",
  } as CSSStyleDeclaration);

  for (const opt of options) {
    const optionEl = document.createElement("option");
    optionEl.value = opt.id;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }

  label.appendChild(span);
  label.appendChild(select);

  return { container: label, select };
}

function createPromptVoiceSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  Object.assign(select.style, {
    fontSize: "12px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#050505",
    color: "#f5f5f5",
    maxWidth: "220px",
  } as CSSStyleDeclaration);

  for (const voice of PROMPT_VOICES) {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = voice.label;
    select.appendChild(option);
  }

  return select;
}

/**
 * Layout:
 *   Row 1: [Reason] [Voice] [Max Tokens] [Blur page]
 *   Row 2: [Summarize] [Clear] [Detach]
 */
export function createToolbar(): ToolbarElements {
  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "8px",
  } as CSSStyleDeclaration);

  // ----- Row 1: reason + voice + max tokens + blur (all on one line) -----
  const row1 = document.createElement("div");
  Object.assign(row1.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  const row1Left = document.createElement("div");
  Object.assign(row1Left.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  const row1Right = document.createElement("div");
  Object.assign(row1Right.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  const {
    container: reasoningLabel,
    select: reasoningSelect,
  } = createLabeledSelect("Reasoning:", AVAILABLE_REASONING_LEVELS);

  const voiceLabel = document.createElement("label");
  Object.assign(voiceLabel.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    cursor: "pointer",
    opacity: "0.9",
  } as CSSStyleDeclaration);
  const voiceText = document.createElement("span");
  voiceText.textContent = "Voice:";
  const voiceSelect = createPromptVoiceSelect();
  voiceLabel.appendChild(voiceText);
  voiceLabel.appendChild(voiceSelect);

  const {
    container: maxTokensLabel,
    select: maxTokensSelect,
  } = createLabeledSelect("Max Tokens:", MAX_OUTPUT_TOKEN_OPTIONS.map(opt => ({ id: String(opt.id), label: opt.label })));

  const {
    container: blurLabel,
    checkbox: blurCheckbox,
  } = createLabeledCheckbox("Blur page when open");

  // Initialize blur checkbox from current setting
  blurCheckbox.checked = getBlurEnabled();
  blurCheckbox.addEventListener("change", () => {
    setBlurEnabled(blurCheckbox.checked);
  });

  row1Left.appendChild(reasoningLabel);
  row1Left.appendChild(voiceLabel);
  row1Left.appendChild(maxTokensLabel);
  row1Right.appendChild(blurLabel);

  row1.appendChild(row1Left);
  row1.appendChild(row1Right);

  // ----- Row 2: buttons -----
  const row2 = document.createElement("div");
  Object.assign(row2.style, {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  const summarizeBtn = document.createElement("button");
  summarizeBtn.id = "docs-summarizer-summarize-btn";
  summarizeBtn.textContent = "Summarize page";
  Object.assign(summarizeBtn.style, {
    padding: "6px 10px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#10b981",
    color: "#ffffff",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  const clearHighlightsBtn = document.createElement("button");
  clearHighlightsBtn.textContent = "Clear highlights";
  Object.assign(clearHighlightsBtn.style, {
    padding: "6px 10px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#374151",
    color: "#ffffff",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  const detachBtn = document.createElement("button");
  detachBtn.textContent = "Detach to Window";
  detachBtn.title = "Open in a separate window";
  Object.assign(detachBtn.style, {
    padding: "6px 10px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#6366f1",
    color: "#ffffff",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  row2.appendChild(summarizeBtn);
  row2.appendChild(clearHighlightsBtn);
  row2.appendChild(detachBtn);

  // Assemble
  toolbar.appendChild(row1);
  toolbar.appendChild(row2);

  return {
    toolbar,
    blurCheckbox,
    voiceSelect,
    reasoningSelect,
    maxTokensSelect,
    summarizeBtn,
    clearHighlightsBtn,
    detachBtn,
  };
}

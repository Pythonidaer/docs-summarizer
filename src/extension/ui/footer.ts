// src/extension/ui/footer.ts
import { PROMPT_VOICES } from "../prompts/voices";
import {
  AVAILABLE_REASONING_LEVELS,
  MAX_OUTPUT_TOKEN_OPTIONS,
} from "../constants";
import { getBlurEnabled, setBlurEnabled } from "./focusBlur";
import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export interface FooterElements {
  footer: HTMLDivElement;
  chatInput: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  summarizeBtn: HTMLButtonElement;
  clearHighlightsBtn: HTMLButtonElement;
  newWindowBtn: HTMLButtonElement;
  reasoningSelect: HTMLSelectElement;
  voiceSelect: HTMLSelectElement;
  maxTokensSelect: HTMLSelectElement;
  blurCheckbox: HTMLInputElement;
}

/**
 * Creates up arrow SVG icon pointing upward (for send button)
 */
function createUpArrowIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "14"); // Slightly smaller for 20px button
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  
  // Up arrow: vertical line with arrowhead pointing up
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  // Vertical line from bottom (y=19) to top (y=5), then arrowhead at top pointing up
  // Arrowhead: left point (7,9), center top (12,4), right point (17,9)
  path.setAttribute("d", "M12 19V5M7 9l5-5 5 5");
  svg.appendChild(path);
  
  return svg;
}

/**
 * Creates clear highlights icon (X in circle)
 */
function createClearIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  
  // X icon in circle (clear/remove highlights)
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  svg.appendChild(circle);
  
  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M9 9l6 6");
  svg.appendChild(path1);
  
  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M15 9l-6 6");
  svg.appendChild(path2);
  
  return svg;
}

/**
 * Creates new window icon (external link or window icon)
 */
function createNewWindowIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  
  // Window/external link icon
  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
  svg.appendChild(path1);
  
  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M15 3h6v6M10 14L21 3");
  svg.appendChild(path2);
  
  return svg;
}

/**
 * Creates a dropdown with label as first option (placeholder-like behavior)
 */
function createLabeledSelect(
  labelText: string,
  options: { id: string; label: string }[],
  maxWidth: string = "100px"
): HTMLSelectElement {
  const select = document.createElement("select");
  Object.assign(select.style, {
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.sm}`,
    borderRadius: CURSOR_BORDERS.radius.sm,
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.inputBorder}`,
    background: CURSOR_COLORS.inputBackground,
    color: CURSOR_COLORS.textPrimary,
    maxWidth: maxWidth,
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    cursor: "pointer",
    transition: "border-color 0.2s",
  } as CSSStyleDeclaration);

  // Add label as first option (disabled, acts as placeholder)
  const labelOption = document.createElement("option");
  labelOption.value = "";
  labelOption.textContent = labelText;
  labelOption.disabled = true;
  labelOption.selected = true;
  select.appendChild(labelOption);

  // Add actual options
  for (const opt of options) {
    const optionEl = document.createElement("option");
    optionEl.value = opt.id;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }

  select.addEventListener("focus", () => {
    select.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  select.addEventListener("blur", () => {
    select.style.borderColor = CURSOR_COLORS.inputBorder;
  });

  return select;
}

function createLabeledCheckbox(labelText: string): {
  container: HTMLLabelElement;
  checkbox: HTMLInputElement;
} {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "flex",
    alignItems: "center",
    gap: CURSOR_SPACING.xs,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
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

export function createFooter(): FooterElements {
  const footer = document.createElement("div");
  Object.assign(footer.style, {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
  } as CSSStyleDeclaration);

  // Container for input and all controls (like Cursor's editor)
  const inputContainer = document.createElement("div");
  Object.assign(inputContainer.style, {
    display: "flex",
    flexDirection: "column",
    gap: CURSOR_SPACING.sm,
    padding: CURSOR_SPACING.md,
    borderRadius: CURSOR_BORDERS.radius.md,
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.inputBorder}`,
    background: CURSOR_COLORS.inputBackgroundContainer, // Lighter background to indicate clickable area
    boxSizing: "border-box",
    transition: "border-color 0.2s, background-color 0.2s",
  } as CSSStyleDeclaration);

  // Add hover effect to entire container
  inputContainer.addEventListener("mouseenter", () => {
    inputContainer.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  inputContainer.addEventListener("mouseleave", () => {
    inputContainer.style.borderColor = CURSOR_COLORS.inputBorder;
  });

  // Full-width textarea (no send button on the right)
  const chatInput = document.createElement("textarea") as HTMLTextAreaElement;
  Object.assign(chatInput.style, {
    width: "100%",
    minHeight: "40px",
    maxHeight: "120px",
    resize: "vertical",
    padding: `${CURSOR_SPACING.sm} ${CURSOR_SPACING.md}`,
    borderRadius: CURSOR_BORDERS.radius.sm,
    border: "none", // No border, container provides it
    background: "transparent", // Transparent, container provides background
    color: CURSOR_COLORS.textPrimary,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    boxSizing: "border-box",
    outline: "none", // Remove default focus outline
  } as CSSStyleDeclaration);
  chatInput.placeholder = "Ask a question about this page…";
  
  // Focus effect on container when input is focused
  chatInput.addEventListener("focus", () => {
    inputContainer.style.borderColor = CURSOR_COLORS.inputBorderHover;
    inputContainer.style.background = CURSOR_COLORS.inputBackground; // Slightly darker on focus
  });
  chatInput.addEventListener("blur", () => {
    inputContainer.style.borderColor = CURSOR_COLORS.inputBorder;
    inputContainer.style.background = CURSOR_COLORS.inputBackgroundContainer;
  });

  inputContainer.appendChild(chatInput);

  // Footer controls row: settings on left, buttons on right
  const controlsRow = document.createElement("div");
  Object.assign(controlsRow.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: CURSOR_SPACING.sm,
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  // Settings group (left side)
  const settingsGroup = document.createElement("div");
  Object.assign(settingsGroup.style, {
    display: "flex",
    alignItems: "center",
    gap: CURSOR_SPACING.sm,
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  // Action buttons group (right side) - send button + icon buttons
  const actionGroup = document.createElement("div");
  Object.assign(actionGroup.style, {
    display: "flex",
    alignItems: "center",
    gap: CURSOR_SPACING.sm,
    flexWrap: "wrap",
  } as CSSStyleDeclaration);

  // Send button (smaller than summarize, on the right) - muted grey/blue
  const sendBtn = document.createElement("button");
  sendBtn.appendChild(createUpArrowIcon());
  Object.assign(sendBtn.style, {
    width: "20px",
    height: "20px",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%", // Circular
    border: "none",
    background: CURSOR_COLORS.buttonPrimary, // Muted grey/blue
    color: "#ffffff",
    cursor: "pointer",
    flex: "0 0 auto",
    transition: "opacity 0.2s, background-color 0.2s",
  } as CSSStyleDeclaration);
  
  sendBtn.addEventListener("mouseenter", () => {
    sendBtn.style.background = CURSOR_COLORS.buttonPrimaryHover;
  });
  sendBtn.addEventListener("mouseleave", () => {
    sendBtn.style.background = CURSOR_COLORS.buttonPrimary;
  });

  // Summarize button (pill-shaped, subtle border, darker than send button)
  const summarizeBtn = document.createElement("button");
  summarizeBtn.textContent = "Summarize";
  Object.assign(summarizeBtn.style, {
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    borderRadius: "9999px", // Pill-shaped (very large radius)
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    background: "transparent", // No background, just border
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
  } as CSSStyleDeclaration);
  
  summarizeBtn.addEventListener("mouseenter", () => {
    summarizeBtn.style.background = "rgba(255, 255, 255, 0.05)"; // Subtle hover
    summarizeBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  summarizeBtn.addEventListener("mouseleave", () => {
    summarizeBtn.style.background = "transparent";
    summarizeBtn.style.borderColor = CURSOR_COLORS.border;
  });

  // Clear highlights button - icon only, no background
  const clearHighlightsBtn = document.createElement("button");
  clearHighlightsBtn.appendChild(createClearIcon());
  clearHighlightsBtn.title = "Clear Link Highlights";
  Object.assign(clearHighlightsBtn.style, {
    width: "20px",
    height: "20px",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0",
    border: "none",
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "opacity 0.2s",
    opacity: "0.7",
  } as CSSStyleDeclaration);
  
  clearHighlightsBtn.addEventListener("mouseenter", () => {
    clearHighlightsBtn.style.opacity = "1";
  });
  clearHighlightsBtn.addEventListener("mouseleave", () => {
    clearHighlightsBtn.style.opacity = "0.7";
  });

  // New window button - icon only, no background
  const newWindowBtn = document.createElement("button");
  newWindowBtn.appendChild(createNewWindowIcon());
  newWindowBtn.title = "Detach Window";
  Object.assign(newWindowBtn.style, {
    width: "20px",
    height: "20px",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0",
    border: "none",
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "opacity 0.2s",
    opacity: "0.7",
  } as CSSStyleDeclaration);
  
  newWindowBtn.addEventListener("mouseenter", () => {
    newWindowBtn.style.opacity = "1";
  });
  newWindowBtn.addEventListener("mouseleave", () => {
    newWindowBtn.style.opacity = "0.7";
  });

  actionGroup.appendChild(summarizeBtn);
  actionGroup.appendChild(clearHighlightsBtn);
  actionGroup.appendChild(newWindowBtn);
  actionGroup.appendChild(sendBtn);

  // Dropdowns with labels as default selected value (not as first option)
  const reasoningSelect = createLabeledSelect(
    "Reasoning",
    AVAILABLE_REASONING_LEVELS,
    "100px"
  );
  reasoningSelect.value = "";

  const voiceSelect = createLabeledSelect(
    "Voice",
    PROMPT_VOICES.map(v => ({ id: v.id, label: v.label })),
    "120px"
  );
  voiceSelect.value = "";

  const maxTokensSelect = createLabeledSelect(
    "Max Tokens",
    MAX_OUTPUT_TOKEN_OPTIONS.map(opt => ({ id: String(opt.id), label: opt.label })),
    "100px"
  );
  maxTokensSelect.value = "";

  // Blur checkbox with shorter label
  const {
    container: blurLabel,
    checkbox: blurCheckbox,
  } = createLabeledCheckbox("Blur page");

  // Initialize blur checkbox from current setting
  blurCheckbox.checked = getBlurEnabled();
  blurCheckbox.addEventListener("change", () => {
    setBlurEnabled(blurCheckbox.checked);
  });

  settingsGroup.appendChild(reasoningSelect);
  settingsGroup.appendChild(voiceSelect);
  settingsGroup.appendChild(maxTokensSelect);
  settingsGroup.appendChild(blurLabel);

  controlsRow.appendChild(settingsGroup);
  controlsRow.appendChild(actionGroup);

  inputContainer.appendChild(controlsRow);
  footer.appendChild(inputContainer);

  return {
    footer,
    chatInput,
    sendBtn,
    summarizeBtn,
    clearHighlightsBtn,
    newWindowBtn,
    reasoningSelect,
    voiceSelect,
    maxTokensSelect,
    blurCheckbox,
  };
}

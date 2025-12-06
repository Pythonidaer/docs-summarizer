
export interface InstructionsPanelElements {
  container: HTMLDivElement;
  textarea: HTMLTextAreaElement;
}

/**
 * Creates the custom instructions panel (container + textarea).
 * `onChange` is called whenever the textarea value changes.
 */
export function createInstructionsPanel(
  onChange: (value: string) => void
): InstructionsPanelElements {
  const container = document.createElement("div");
  Object.assign(container.style, {
    flex: "0 0 auto",
    display: "none", // toggled on when checkbox is checked
    marginBottom: "8px",
  } as CSSStyleDeclaration);

  const textarea = document.createElement("textarea") as HTMLTextAreaElement;
  Object.assign(textarea.style, {
    width: "100%",
    minHeight: "60px",
    maxHeight: "140px",
    resize: "vertical",
    padding: "6px 8px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#050505",
    color: "#f5f5f5",
    fontSize: "12px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);

  textarea.placeholder =
    "Optional: Add your own custom instructions.\n" +
    "These will override the system + voice style.\n" +
    "(Leave unchecked to rely only on the selected prompt voice.)";

  textarea.addEventListener("input", () => {
    onChange(textarea.value);
  });

  container.appendChild(textarea);

  return { container, textarea };
}

interface InstructionsToggleOptions {
  checkbox: HTMLInputElement;
  container: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  getUseCustomInstructions: () => boolean;
  setUseCustomInstructions: (value: boolean) => void;
  setCustomInstructions: (value: string) => void;
}

export function wireInstructionsToggle(opts: InstructionsToggleOptions): void {
  const {
    checkbox,
    container,
    textarea,
    getUseCustomInstructions,
    setUseCustomInstructions,
    setCustomInstructions,
  } = opts;

  checkbox.addEventListener("change", () => {
    const nextChecked = checkbox.checked;
    setUseCustomInstructions(nextChecked);

    if (nextChecked) {
      // If opened with an empty field, seed a friendly starter note.
      if (!textarea.value.trim()) {
        textarea.value =
          "// Add any stylistic or behavioral overrides you want.\n" +
          "// These instructions will be appended after system + voice.";
      }

      setCustomInstructions(textarea.value);
      container.style.display = "block";
    } else {
      container.style.display = "none";
      setCustomInstructions("");
    }
  });

    container.style.display = getUseCustomInstructions() ? "block" : "none";
}
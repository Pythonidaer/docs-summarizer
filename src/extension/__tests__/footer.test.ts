/** @jest-environment jsdom */

import { createFooter } from "../ui/footer";

describe("createFooter", () => {
  test("creates footer with chat input, send button, action buttons, and settings", () => {
    const { footer, chatInput, sendBtn, summarizeBtn, clearHighlightsBtn, newWindowBtn, reasoningSelect, voiceSelect, maxTokensSelect, blurCheckbox } = createFooter();

    expect(footer).toBeInstanceOf(HTMLDivElement);
    expect(chatInput).toBeInstanceOf(HTMLTextAreaElement);
    expect(sendBtn).toBeInstanceOf(HTMLButtonElement);
    expect(summarizeBtn).toBeInstanceOf(HTMLButtonElement);
    expect(clearHighlightsBtn).toBeInstanceOf(HTMLButtonElement);
    expect(newWindowBtn).toBeInstanceOf(HTMLButtonElement);
    expect(footer.contains(chatInput)).toBe(true);
    expect(footer.contains(sendBtn)).toBe(true);
    expect(footer.contains(summarizeBtn)).toBe(true);
    expect(footer.contains(clearHighlightsBtn)).toBe(true);
    expect(footer.contains(newWindowBtn)).toBe(true);
    expect(footer.contains(reasoningSelect)).toBe(true);
    expect(footer.contains(voiceSelect)).toBe(true);
    expect(footer.contains(maxTokensSelect)).toBe(true);
    expect(footer.contains(blurCheckbox.parentElement!)).toBe(true);
  });

  test("footer has correct layout styling", () => {
    const { footer } = createFooter();

    expect(footer.style.display).toBe("flex");
    expect(footer.style.flexDirection).toBe("column");
    // Footer no longer has gap, inputContainer handles spacing
  });

  test("textarea is full width", () => {
    const { chatInput } = createFooter();

    expect(chatInput.style.width).toBe("100%");
  });

  test("chat input has correct styling and placeholder", () => {
    const { chatInput, footer } = createFooter();

    expect(chatInput.placeholder).toBe("Ask a question about this page…");
    expect(chatInput.style.minHeight).toBe("40px");
    expect(chatInput.style.maxHeight).toBe("120px");
    expect(chatInput.style.resize).toBe("vertical");
    expect(chatInput.style.padding).toBe("6px 8px");
    expect(chatInput.style.borderRadius).toBe("4px"); // Smaller radius now
    expect(chatInput.style.background === "transparent" || chatInput.style.background === "rgba(0, 0, 0, 0)").toBe(true); // Transparent, container provides background
    expect(chatInput.style.border === "none" || chatInput.style.border === "" || chatInput.style.border === "0px").toBe(true); // No border, container provides it
    expect(chatInput.style.color).toBe("rgb(240, 238, 233)"); // CURSOR_COLORS.textPrimary (#F0EEE9)
    expect(chatInput.style.fontSize).toBe("13px");
    
    // Input should be inside a container
    const inputContainer = footer.querySelector("div");
    expect(inputContainer).not.toBeNull();
    expect(inputContainer?.contains(chatInput)).toBe(true);
  });

  test("send button has circular up arrow icon and is smaller", () => {
    const { sendBtn } = createFooter();

    // Should contain SVG arrow icon pointing UP, not text
    expect(sendBtn.textContent).toBe("");
    const svg = sendBtn.querySelector("svg");
    expect(svg).not.toBeNull();
    // Should be circular and 20px (reduced from 24px)
    expect(sendBtn.style.borderRadius).toBe("50%");
    expect(sendBtn.style.width).toBe("20px");
    expect(sendBtn.style.height).toBe("20px");
    expect(sendBtn.style.cursor).toBe("pointer");
    // Should use muted grey/blue color
    expect(sendBtn.style.background).toBe("rgb(74, 85, 104)"); // #4a5568
    
    // Check that arrow points up (path should have upward direction)
    const path = svg?.querySelector("path");
    expect(path).not.toBeNull();
    const pathD = path?.getAttribute("d") || "";
    // Up arrow typically has vertical line or upward-pointing path
    expect(pathD.length).toBeGreaterThan(0);
  });

  test("summarize button is pill-shaped, icon buttons are borderless with tooltips", () => {
    const { summarizeBtn, clearHighlightsBtn, newWindowBtn } = createFooter();

    expect(summarizeBtn.textContent).toBe("Summarize");
    // Should be pill-shaped (very large border-radius)
    expect(summarizeBtn.style.borderRadius).toBe("9999px");
    
    // Clear and New Window should have SVG icons, not text, and no background
    expect(clearHighlightsBtn.textContent).toBe("");
    expect(newWindowBtn.textContent).toBe("");
    
    const clearSvg = clearHighlightsBtn.querySelector("svg");
    const newWindowSvg = newWindowBtn.querySelector("svg");
    expect(clearSvg).not.toBeNull();
    expect(newWindowSvg).not.toBeNull();
    
    // Should have transparent backgrounds and no borders
    expect(clearHighlightsBtn.style.background).toBe("transparent");
    expect(clearHighlightsBtn.style.border === "none" || clearHighlightsBtn.style.border === "" || clearHighlightsBtn.style.border === "0px").toBe(true);
    expect(newWindowBtn.style.background).toBe("transparent");
    expect(newWindowBtn.style.border === "none" || newWindowBtn.style.border === "" || newWindowBtn.style.border === "0px").toBe(true);
    
    // Should have tooltips
    expect(clearHighlightsBtn.title).toBe("Clear Link Highlights");
    expect(newWindowBtn.title).toBe("Detach Window");
    
    // Should have opacity for hover effects
    expect(clearHighlightsBtn.style.opacity).toBe("0.7");
    expect(newWindowBtn.style.opacity).toBe("0.7");
  });

  test("dropdowns show labels as default selected value", () => {
    const { reasoningSelect, voiceSelect, maxTokensSelect } = createFooter();

    // First option should be the label (disabled, acts as placeholder)
    expect(reasoningSelect.options[0]?.textContent).toBe("Reasoning");
    expect(reasoningSelect.options[0]?.disabled).toBe(true);
    expect(voiceSelect.options[0]?.textContent).toBe("Voice");
    expect(voiceSelect.options[0]?.disabled).toBe(true);
    expect(maxTokensSelect.options[0]?.textContent).toBe("Max Tokens");
    expect(maxTokensSelect.options[0]?.disabled).toBe(true);
    
    // Labels should be selected by default (empty value)
    expect(reasoningSelect.value).toBe("");
    expect(voiceSelect.value).toBe("");
    expect(maxTokensSelect.value).toBe("");
    
    // Should have actual options after the label
    expect(reasoningSelect.options.length).toBeGreaterThan(1);
    expect(voiceSelect.options.length).toBeGreaterThan(1);
    expect(maxTokensSelect.options.length).toBeGreaterThan(1);
  });

  test("blur checkbox has shorter label", () => {
    const { blurCheckbox } = createFooter();

    expect(blurCheckbox.parentElement?.textContent).toContain("Blur page");
    expect(blurCheckbox.parentElement?.textContent).not.toContain("Blur page when open");
  });

  test("chat input can receive text", () => {
    const { chatInput } = createFooter();

    chatInput.value = "Test question";
    expect(chatInput.value).toBe("Test question");
  });

  test("all buttons are clickable", () => {
    const { sendBtn, summarizeBtn, clearHighlightsBtn, newWindowBtn } = createFooter();
    
    const sendHandler = jest.fn();
    const summarizeHandler = jest.fn();
    const clearHandler = jest.fn();
    const newWindowHandler = jest.fn();

    sendBtn.addEventListener("click", sendHandler);
    summarizeBtn.addEventListener("click", summarizeHandler);
    clearHighlightsBtn.addEventListener("click", clearHandler);
    newWindowBtn.addEventListener("click", newWindowHandler);

    sendBtn.click();
    summarizeBtn.click();
    clearHighlightsBtn.click();
    newWindowBtn.click();

    expect(sendHandler).toHaveBeenCalledTimes(1);
    expect(summarizeHandler).toHaveBeenCalledTimes(1);
    expect(clearHandler).toHaveBeenCalledTimes(1);
    expect(newWindowHandler).toHaveBeenCalledTimes(1);
  });
});


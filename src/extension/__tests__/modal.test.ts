/** @jest-environment jsdom */

import { showAlert, showPrompt, showModal } from "../ui/modal";

describe("showAlert", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("creates and displays alert modal", async () => {
    const promise = showAlert("Test message");
    
    const modal = document.querySelector(".docs-summarizer-modal");
    expect(modal).toBeDefined();
    
    const message = modal?.querySelector(".docs-summarizer-modal-message");
    expect(message?.textContent).toBe("Test message");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("alert modal has title when provided", async () => {
    showAlert("Test message", "Test Title");
    
    const modal = document.querySelector(".docs-summarizer-modal");
    const title = modal?.querySelector(".docs-summarizer-modal-title");
    expect(title?.textContent).toBe("Test Title");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("alert modal has OK button", async () => {
    showAlert("Test message");
    
    const modal = document.querySelector(".docs-summarizer-modal");
    const button = modal?.querySelector(".docs-summarizer-modal-button");
    expect(button).toBeDefined();
    expect(button?.textContent).toContain("OK");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("alert modal closes when OK button is clicked", async () => {
    const promise = showAlert("Test message");
    
    // Wait for modal to render
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const overlay = document.getElementById("docs-summarizer-modal-overlay");
    expect(overlay).toBeDefined();
    
    // Find the OK button (should be the last button or the one with "OK" text)
    const buttons = overlay?.querySelectorAll(".docs-summarizer-modal-button");
    expect(buttons?.length).toBeGreaterThan(0);
    
    const okButton = Array.from(buttons || []).find(
      b => b.textContent?.trim() === "OK"
    ) as HTMLButtonElement;
    expect(okButton).toBeDefined();
    
    okButton.click();
    
    // Wait for promise to resolve
    await promise;
    
    // Wait for DOM cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Modal should be removed
    const modalAfter = document.getElementById("docs-summarizer-modal-overlay");
    expect(modalAfter).toBeNull();
  });
});

describe("showPrompt", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("creates prompt modal with input field", () => {
    showPrompt("Enter API key", "sk-...");
    
    const modal = document.querySelector(".docs-summarizer-modal");
    expect(modal).toBeDefined();
    
    const input = modal?.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input?.type).toBe("text");
    expect(input?.placeholder).toBe("sk-...");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("prompt modal has OK and Cancel buttons", () => {
    showPrompt("Enter API key");
    
    const modal = document.querySelector(".docs-summarizer-modal");
    const buttons = modal?.querySelectorAll(".docs-summarizer-modal-button");
    expect(buttons?.length).toBe(2);
    
    const buttonTexts = Array.from(buttons || []).map(b => b.textContent);
    expect(buttonTexts).toContain("OK");
    expect(buttonTexts).toContain("Cancel");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("prompt returns input value when OK is clicked", async () => {
    const promise = showPrompt("Enter API key");
    
    const input = document.querySelector("input") as HTMLInputElement;
    input.value = "sk-test123";
    
    const okButton = Array.from(document.querySelectorAll(".docs-summarizer-modal-button"))
      .find(b => b.textContent === "OK") as HTMLButtonElement;
    okButton?.click();
    
    const result = await promise;
    expect(result).toBe("sk-test123");
  });

  test("prompt returns null when Cancel is clicked", async () => {
    const promise = showPrompt("Enter API key");
    
    const cancelButton = Array.from(document.querySelectorAll(".docs-summarizer-modal-button"))
      .find(b => b.textContent === "Cancel") as HTMLButtonElement;
    cancelButton?.click();
    
    const result = await promise;
    expect(result).toBeNull();
  });

  test("prompt closes on ESC key", async () => {
    const promise = showPrompt("Enter API key");
    
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    expect(overlay).toBeDefined();
    
    const escEvent = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(escEvent);
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const modalAfter = document.querySelector(".docs-summarizer-modal");
    expect(modalAfter).toBeNull();
  });
});

describe("showModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("creates modal with custom options", () => {
    showModal({
      message: "Custom message",
      title: "Custom Title",
      type: "error",
      confirmText: "Confirm",
      cancelText: "Cancel",
    });
    
    const modal = document.querySelector(".docs-summarizer-modal");
    expect(modal).toBeDefined();
    
    const title = modal?.querySelector(".docs-summarizer-modal-title");
    expect(title?.textContent).toBe("Custom Title");
    
    const message = modal?.querySelector(".docs-summarizer-modal-message");
    expect(message?.textContent).toBe("Custom message");
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("calls onConfirm callback when confirm button is clicked", () => {
    const onConfirm = jest.fn();
    
    showModal({
      message: "Test",
      onConfirm,
    });
    
    const button = document.querySelector(".docs-summarizer-modal-button") as HTMLButtonElement;
    button?.click();
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });

  test("calls onCancel callback when cancel button is clicked", () => {
    const onCancel = jest.fn();
    
    showModal({
      message: "Test",
      onCancel,
    });
    
    const cancelButton = Array.from(document.querySelectorAll(".docs-summarizer-modal-button"))
      .find(b => b.textContent === "Cancel") as HTMLButtonElement;
    cancelButton?.click();
    
    expect(onCancel).toHaveBeenCalledTimes(1);
    
    // Clean up
    const overlay = document.querySelector(".docs-summarizer-modal-overlay");
    if (overlay) overlay.remove();
  });
});


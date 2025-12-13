// src/extension/ui/modal.ts
import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export interface ModalOptions {
  title?: string;
  message: string;
  type?: "alert" | "prompt" | "error";
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

const MODAL_OVERLAY_ID = "docs-summarizer-modal-overlay";

/**
 * Removes modal from DOM
 */
function removeModal(): void {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Creates and shows a modal dialog
 */
export function showModal(options: ModalOptions): void {
  // Remove any existing modal
  removeModal();

  const {
    title,
    message,
    type = "alert",
    inputPlaceholder,
    confirmText = "OK",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  } = options;

  // Create overlay (backdrop)
  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "1000000", // Above drawer
    animation: "fadeIn 0.2s ease-out",
  } as CSSStyleDeclaration);

  // Create modal container
  const modal = document.createElement("div");
  modal.className = "docs-summarizer-modal";
  Object.assign(modal.style, {
    background: CURSOR_COLORS.backgroundSecondary, // #252526
    borderRadius: CURSOR_BORDERS.radius.md, // 6px
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    padding: CURSOR_SPACING.xl, // 16px
    maxWidth: "400px",
    width: "90%",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    animation: "slideUp 0.2s ease-out",
  } as CSSStyleDeclaration);

  // Title (if provided)
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "docs-summarizer-modal-title";
    Object.assign(titleEl.style, {
      fontSize: CURSOR_TYPOGRAPHY.fontSize.lg, // 16px
      fontWeight: CURSOR_TYPOGRAPHY.fontWeight.medium, // 500
      color: CURSOR_COLORS.textPrimary,
      marginBottom: CURSOR_SPACING.md, // 8px
    } as CSSStyleDeclaration);
    titleEl.textContent = title;
    modal.appendChild(titleEl);
  }

  // Message
  const messageEl = document.createElement("div");
  messageEl.className = "docs-summarizer-modal-message";
  Object.assign(messageEl.style, {
    fontSize: CURSOR_TYPOGRAPHY.fontSize.base, // 13px
    color: CURSOR_COLORS.textPrimary,
    lineHeight: CURSOR_TYPOGRAPHY.lineHeight.normal, // 1.4
    marginBottom: type === "prompt" ? CURSOR_SPACING.lg : CURSOR_SPACING.xl, // 12px if prompt, 16px otherwise
    whiteSpace: "pre-wrap",
  } as CSSStyleDeclaration);
  messageEl.textContent = message;
  modal.appendChild(messageEl);

  // Input field (for prompt type)
  let inputEl: HTMLInputElement | null = null;
  if (type === "prompt") {
    inputEl = document.createElement("input");
    inputEl.type = "text";
    if (inputPlaceholder) {
      inputEl.placeholder = inputPlaceholder;
    }
    Object.assign(inputEl.style, {
      width: "100%",
      padding: `${CURSOR_SPACING.sm} ${CURSOR_SPACING.md}`,
      borderRadius: CURSOR_BORDERS.radius.sm,
      border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.inputBorder}`,
      background: CURSOR_COLORS.inputBackground,
      color: CURSOR_COLORS.textPrimary,
      fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
      fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
      marginBottom: CURSOR_SPACING.xl,
      boxSizing: "border-box",
      outline: "none",
      transition: "border-color 0.2s",
    } as CSSStyleDeclaration);

    inputEl.addEventListener("focus", () => {
      inputEl!.style.borderColor = CURSOR_COLORS.inputBorderHover;
    });
    inputEl.addEventListener("blur", () => {
      inputEl!.style.borderColor = CURSOR_COLORS.inputBorder;
    });

    modal.appendChild(inputEl);
  }

  // Buttons container
  const buttonsContainer = document.createElement("div");
  Object.assign(buttonsContainer.style, {
    display: "flex",
    gap: CURSOR_SPACING.sm,
    justifyContent: type === "prompt" ? "flex-end" : "center",
  } as CSSStyleDeclaration);

  // Cancel button (only for prompt or if onCancel provided)
  if (type === "prompt" || onCancel) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "docs-summarizer-modal-button";
    cancelBtn.textContent = cancelText;
    Object.assign(cancelBtn.style, {
      padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
      fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
      borderRadius: "9999px", // Pill-shaped
      border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
      background: "transparent",
      color: CURSOR_COLORS.textPrimary,
      cursor: "pointer",
      transition: "background-color 0.2s, border-color 0.2s",
      fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    } as CSSStyleDeclaration);

    cancelBtn.addEventListener("mouseenter", () => {
      cancelBtn.style.background = "rgba(255, 255, 255, 0.05)";
      cancelBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
    });
    cancelBtn.addEventListener("mouseleave", () => {
      cancelBtn.style.background = "transparent";
      cancelBtn.style.borderColor = CURSOR_COLORS.border;
    });

    cancelBtn.addEventListener("click", () => {
      if (onCancel) {
        onCancel();
      }
      removeModal();
    });

    buttonsContainer.appendChild(cancelBtn);
  }

  // Confirm/OK button
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "docs-summarizer-modal-button";
  confirmBtn.textContent = confirmText;
  Object.assign(confirmBtn.style, {
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    borderRadius: "9999px", // Pill-shaped
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
  } as CSSStyleDeclaration);

  confirmBtn.addEventListener("mouseenter", () => {
    confirmBtn.style.background = "rgba(255, 255, 255, 0.05)";
    confirmBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  confirmBtn.addEventListener("mouseleave", () => {
    confirmBtn.style.background = "transparent";
    confirmBtn.style.borderColor = CURSOR_COLORS.border;
  });

  confirmBtn.addEventListener("click", () => {
    const value = inputEl?.value || undefined;
    if (onConfirm) {
      onConfirm(value);
    }
    removeModal();
  });

  buttonsContainer.appendChild(confirmBtn);
  modal.appendChild(buttonsContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus input if present
  if (inputEl) {
    setTimeout(() => inputEl!.focus(), 0);
  } else {
    confirmBtn.focus();
  }

  // Close on ESC key
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (onCancel) {
        onCancel();
      }
      removeModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Close on overlay click (optional - only if no input)
  if (type !== "prompt") {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        if (onCancel) {
          onCancel();
        }
        removeModal();
      }
    });
  }
}

/**
 * Shows a simple alert modal
 */
export function showAlert(message: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    showModal({
      message,
      ...(title !== undefined && { title }),
      type: "alert",
      onConfirm: () => {
        resolve();
      },
    });
  });
}

/**
 * Shows a prompt modal with input field
 */
export function showPrompt(message: string, placeholder?: string): Promise<string | null> {
  return new Promise((resolve) => {
    showModal({
      message,
      type: "prompt",
      ...(placeholder !== undefined && { inputPlaceholder: placeholder }),
      onConfirm: (value) => {
        resolve(value || null);
      },
      onCancel: () => {
        resolve(null);
      },
    });
  });
}


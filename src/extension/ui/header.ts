import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS } from "./design";

export function createHeader(): {
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
} {
  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end", // Align close button to the right
    marginBottom: "10px",
    paddingBottom: "6px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  } as CSSStyleDeclaration);

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  Object.assign(closeButton.style, {
    marginLeft: "auto", // Push to the right
    border: "none",
    background: CURSOR_COLORS.buttonSecondary, // Circular background (always visible)
    color: CURSOR_COLORS.textPrimary,
    fontSize: "18px",
    cursor: "pointer",
    width: "24px", // Fixed width for circle
    height: "24px", // Fixed height for circle (equal to width)
    padding: "0", // No padding, use fixed dimensions
    borderRadius: "50%", // Perfect circle
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s",
  } as CSSStyleDeclaration);

  // Hover effect: lighter background
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.background = CURSOR_COLORS.buttonSecondaryHover; // Lighter on hover
  });
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.background = CURSOR_COLORS.buttonSecondary; // Return to default
  });

  header.appendChild(closeButton);

  return { header, closeButton };
}

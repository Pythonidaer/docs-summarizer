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
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    fontSize: "18px",
    cursor: "pointer",
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`, // Cubic padding (4px vertical, 8px horizontal)
    borderRadius: CURSOR_BORDERS.radius.sm, // Rounded corners
    lineHeight: "1",
    transition: "background-color 0.2s",
  } as CSSStyleDeclaration);

  // Hover effect: show rounded rectangle background
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.background = CURSOR_COLORS.buttonSecondary; // Dark grey background
  });
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.background = "transparent";
  });

  header.appendChild(closeButton);

  return { header, closeButton };
}

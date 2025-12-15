import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export function createHeader(): {
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
  deleteKeyButton: HTMLButtonElement;
} {
  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between", // Space between delete key button and close button
    marginBottom: "10px",
    paddingBottom: "6px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  } as CSSStyleDeclaration);

  // Delete Key button (left side) - red text and border, pill-shaped like Summarize button
  const deleteKeyButton = document.createElement("button");
  deleteKeyButton.textContent = "Delete Key";
  Object.assign(deleteKeyButton.style, {
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    borderRadius: "9999px", // Pill-shaped (very large radius) - same as Summarize button
    border: `${CURSOR_BORDERS.width.thin} solid #ef4444`, // Red border
    background: "transparent", // No background, just border
    color: "#ef4444", // Red text
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
  } as CSSStyleDeclaration);
  
  deleteKeyButton.addEventListener("mouseenter", () => {
    deleteKeyButton.style.background = "rgba(239, 68, 68, 0.1)"; // Subtle red hover
    deleteKeyButton.style.borderColor = "#dc2626"; // Darker red on hover
  });
  deleteKeyButton.addEventListener("mouseleave", () => {
    deleteKeyButton.style.background = "transparent";
    deleteKeyButton.style.borderColor = "#ef4444"; // Return to default red
  });

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  Object.assign(closeButton.style, {
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

  header.appendChild(deleteKeyButton);
  header.appendChild(closeButton);

  return { header, closeButton, deleteKeyButton };
}

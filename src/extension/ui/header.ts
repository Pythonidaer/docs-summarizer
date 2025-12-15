import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export function createHeader(): {
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
  deleteKeyButton: HTMLButtonElement;
  infoButton: HTMLButtonElement;
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

  // Container for Delete Key button and Info icon (left side)
  const leftContainer = document.createElement("div");
  Object.assign(leftContainer.style, {
    display: "flex",
    alignItems: "center",
    gap: CURSOR_SPACING.sm, // Gap between Delete Key and Info icon
  } as CSSStyleDeclaration);

  // Delete Key button - red text and border, pill-shaped like Summarize button
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

  // Info icon button (to the right of Delete Key)
  const infoButton = document.createElement("button");
  infoButton.title = "Security & Privacy Information";
  Object.assign(infoButton.style, {
    border: "none",
    background: "transparent",
    color: CURSOR_COLORS.textPrimary, // Brighter/lighter for better visibility
    cursor: "pointer",
    width: "20px",
    height: "20px",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s",
    opacity: "0.9", // Slightly brighter
  } as CSSStyleDeclaration);

  // Create info icon SVG (circle with "i")
  const infoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  infoSvg.setAttribute("width", "16");
  infoSvg.setAttribute("height", "16");
  infoSvg.setAttribute("viewBox", "0 0 24 24");
  infoSvg.setAttribute("fill", "none");
  infoSvg.setAttribute("stroke", "currentColor");
  infoSvg.setAttribute("stroke-width", "2");
  infoSvg.setAttribute("stroke-linecap", "round");
  infoSvg.setAttribute("stroke-linejoin", "round");
  
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "12");
  line1.setAttribute("y1", "16");
  line1.setAttribute("x2", "12");
  line1.setAttribute("y2", "12");
  
  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "12");
  line2.setAttribute("y1", "8");
  line2.setAttribute("x2", "12.01");
  line2.setAttribute("y2", "8");
  
  infoSvg.appendChild(circle);
  infoSvg.appendChild(line1);
  infoSvg.appendChild(line2);
  infoButton.appendChild(infoSvg);

  infoButton.addEventListener("mouseenter", () => {
    infoButton.style.color = CURSOR_COLORS.textPrimary;
    infoButton.style.opacity = "1";
  });
  infoButton.addEventListener("mouseleave", () => {
    infoButton.style.color = CURSOR_COLORS.textPrimary;
    infoButton.style.opacity = "0.9";
  });

  leftContainer.appendChild(deleteKeyButton);
  leftContainer.appendChild(infoButton);

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

  header.appendChild(leftContainer);
  header.appendChild(closeButton);

  return { header, closeButton, deleteKeyButton, infoButton };
}

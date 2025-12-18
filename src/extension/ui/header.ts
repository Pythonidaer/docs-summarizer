import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export function createHeader(): {
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
  deleteKeyButton: HTMLButtonElement;
  infoButton: HTMLButtonElement;
  donateButton: HTMLButtonElement;
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

  // Container for Donate and Close buttons (right side)
  const rightContainer = document.createElement("div");
  Object.assign(rightContainer.style, {
    display: "flex",
    alignItems: "center",
    gap: CURSOR_SPACING.sm, // Gap between Donate and Close buttons
  } as CSSStyleDeclaration);

  // Money bag icon button (donate) - expands on hover to show "Donate" text
  const donateButton = document.createElement("button");
  donateButton.title = "Support & Connect";
  
  // Emoji is always on the right, fixed position
  const donateEmoji = document.createElement("span");
  donateEmoji.textContent = "💰";
  donateEmoji.className = "donate-icon";
  Object.assign(donateEmoji.style, {
    fontSize: "16px",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    flexShrink: "0",
    flexGrow: "0",
    position: "absolute",
    right: "0",
  } as CSSStyleDeclaration);
  
  // Text appears on the left when expanding (completely hidden initially)
  const donateText = document.createElement("span");
  donateText.textContent = "Donate";
  donateText.className = "donate-text";
  Object.assign(donateText.style, {
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    whiteSpace: "nowrap",
    paddingRight: "4px", // Space between text and emoji
    paddingLeft: "0",
    opacity: "0", // Start invisible
    display: "flex", // Use flex for better centering
    alignItems: "center",
    margin: "0",
    marginLeft: "0", // Will be centered using flexbox
    transition: "opacity 0.3s ease-out",
    pointerEvents: "none", // Don't interfere with button clicks when invisible
    flex: "1", // Take up available space
    justifyContent: "center", // Center text within its space
  } as CSSStyleDeclaration);
  
  // Add text first (left), then emoji (right) - emoji is absolutely positioned on right
  donateButton.appendChild(donateText);
  donateButton.appendChild(donateEmoji);
  
  Object.assign(donateButton.style, {
    border: "none",
    background: CURSOR_COLORS.buttonSecondary,
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    height: "24px", // Same height as close button
    width: "24px", // Fixed width to match close button exactly
    borderRadius: "50%", // Perfect circle initially
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center", // Center emoji initially (since it's the only visible element)
    overflow: "hidden",
    transition: "background-color 0.2s, width 0.4s ease-out, border-radius 0.4s ease-out", // Slower animation
    padding: "0",
    position: "relative",
  } as CSSStyleDeclaration);

  let hoverTimeout: NodeJS.Timeout | null = null;

  // Hover effect - expand to show "Donate" text on the left, emoji stays on right
  donateButton.addEventListener("mouseenter", () => {
    // Clear any pending hide timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    // Expand button first, then fade in text
    donateButton.style.background = CURSOR_COLORS.buttonSecondaryHover;
    donateButton.style.width = "90px"; // Narrower - just enough for text + emoji + padding
    donateButton.style.borderRadius = "9999px"; // Pill-shaped when expanded
    donateButton.style.paddingLeft = "0"; // No padding on button
    donateButton.style.justifyContent = "flex-start"; // Align to start
    
    // Use flexbox to center text: text takes flex: 1, emoji has fixed width
    // This will automatically center the text in the remaining space
    donateText.style.marginLeft = "0"; // No margin needed, flexbox handles centering
    
    // Fade in text after button starts expanding (small delay)
    setTimeout(() => {
      donateText.style.opacity = "1";
      donateText.style.pointerEvents = "auto";
    }, 50);
  });
  
  donateButton.addEventListener("mouseleave", () => {
    // Clear any pending show timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Fade out text first
    donateText.style.opacity = "0";
    donateText.style.pointerEvents = "none";
    
    // Then shrink button after fade completes
    hoverTimeout = setTimeout(() => {
      donateButton.style.background = CURSOR_COLORS.buttonSecondary;
      donateButton.style.width = "24px"; // Back to circle size
      donateButton.style.borderRadius = "50%"; // Back to circle
      donateButton.style.justifyContent = "center"; // Center emoji when collapsed
      donateText.style.marginLeft = "0"; // Reset margin when collapsed
      hoverTimeout = null;
    }, 300); // Wait for fade transition to complete (0.3s)
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

  rightContainer.appendChild(donateButton);
  rightContainer.appendChild(closeButton);

  header.appendChild(leftContainer);
  header.appendChild(rightContainer);

  return { header, closeButton, deleteKeyButton, infoButton, donateButton };
}

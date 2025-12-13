import {
    DRAWER_ROOT_ID,
    DRAWER_PANEL_ID,
    DRAWER_HANDLE_ID,
} from "../constants";
import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS } from "./design";

export interface DrawerShell {
  root: HTMLDivElement;
  shadow: ShadowRoot;
  handle: HTMLDivElement;
  drawer: HTMLDivElement;
  content: HTMLDivElement;
}

export function createDrawerShell(drawerWidthPx: number): DrawerShell {
  const root = document.createElement("div");
  root.id = DRAWER_ROOT_ID;
  Object.assign(root.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100%",
    width: "0",
    zIndex: "999999",
    pointerEvents: "none",
  } as CSSStyleDeclaration);

  const shadow = root.attachShadow({ mode: "open" });

  const handle = document.createElement("div");
  handle.id = DRAWER_HANDLE_ID;
  handle.title = "Open Chat Window"; // Tooltip
  
  // Perfect half-circle shape that expands on hover (like a bubble)
  // Width needs to be wider initially to ensure perfect roundness (not flat in middle)
  const initialHeight = 60;
  const initialWidth = 28; // Wider to ensure perfect half-circle appearance (not flat)
  // Use a very large border-radius value to ensure perfect half-circle
  // (larger than any possible height to guarantee perfect semicircle)
  const halfCircleRadius = "999px";
  
  // Create left arrow SVG icon (drawer is closed, arrow points left to open)
  const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrowSvg.setAttribute("viewBox", "0 0 24 24");
  arrowSvg.setAttribute("fill", "none");
  arrowSvg.setAttribute("stroke", "currentColor");
  arrowSvg.setAttribute("stroke-width", "2.5"); // Thicker stroke for better visibility (primary affordance)
  arrowSvg.setAttribute("stroke-linecap", "round");
  arrowSvg.setAttribute("stroke-linejoin", "round");
  // Set initial size via CSS for smooth transitions
  // Nudge arrow right for visual centering (since only half-circle is visible)
  Object.assign(arrowSvg.style, {
    display: "block",
    width: "16px", // Slightly larger for primary affordance
    height: "16px",
    margin: "auto",
    transform: "translateX(4px)", // Nudge right for visual centering within visible half-circle
    transition: "width 0.3s ease-out, height 0.3s ease-out, transform 0.3s ease-out", // Smooth size and position transition
  } as CSSStyleDeclaration);
  
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M19 12H5M12 19l-7-7 7-7");
  arrowSvg.appendChild(arrowPath);
  handle.appendChild(arrowSvg);
  
  Object.assign(handle.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    width: `${initialWidth}px`, // Initially thin (oval width)
    height: `${initialHeight}px`, // Taller than wide (oval height)
    padding: "0",
    borderRadius: `${halfCircleRadius} 0 0 ${halfCircleRadius}`, // Perfect half-circle on left (very large radius), flat on right
    background: CURSOR_COLORS.background, // Match drawer background
    color: CURSOR_COLORS.textPrimary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    pointerEvents: "auto",
    userSelect: "none",
    boxShadow: "-2px 0 6px rgba(0,0,0,0.25)", // Soft shadow to make it feel intentional, not truncated
    transition: "right 0.2s ease-out, transform 0.2s ease-out, width 0.3s ease-out, height 0.3s ease-out, background-color 0.2s, border-radius 0.3s ease-out, box-shadow 0.3s ease-out",
    zIndex: "999999", // Ensure handle stays visible
  } as CSSStyleDeclaration);
  
  // Hover effect: expand like a bubble and lighter background
  handle.addEventListener("mouseenter", () => {
    const expandedHeight = 80;
    const expandedWidth = 40; // Wider when expanded
    
    handle.style.width = `${expandedWidth}px`; // Expand width on hover
    handle.style.height = `${expandedHeight}px`; // Expand height on hover
    handle.style.borderRadius = `${halfCircleRadius} 0 0 ${halfCircleRadius}`; // Perfect half-circle on left (very large radius)
    handle.style.background = CURSOR_COLORS.inputBackgroundContainer; // Lighter background
    handle.style.boxShadow = "-2px 0 8px rgba(0,0,0,0.3)"; // Slightly stronger shadow on hover
    
    // Make arrow bigger but keep visual centering (smooth size transition only)
    Object.assign(arrowSvg.style, {
      width: "22px", // Bigger arrow on hover (~10-15% increase from 16px)
      height: "22px",
      transform: "translateX(4px)", // Keep same rightward nudge for visual centering
    } as CSSStyleDeclaration);
  });
  handle.addEventListener("mouseleave", () => {
    handle.style.width = `${initialWidth}px`; // Return to thin
    handle.style.height = `${initialHeight}px`; // Return to original height
    handle.style.borderRadius = `${halfCircleRadius} 0 0 ${halfCircleRadius}`; // Perfect half-circle on left (very large radius)
    handle.style.background = CURSOR_COLORS.background; // Return to drawer background
    handle.style.boxShadow = "-2px 0 6px rgba(0,0,0,0.25)"; // Return to original shadow
    
    // Return arrow to smaller size, keep visual centering (smooth size transition only)
    Object.assign(arrowSvg.style, {
      width: "16px", // Smaller arrow when not hovered
      height: "16px",
      transform: "translateX(4px)", // Keep same rightward nudge
    } as CSSStyleDeclaration);
  });

  const drawer = document.createElement("div");
  drawer.id = DRAWER_PANEL_ID;
  Object.assign(drawer.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100%",
    width: `${drawerWidthPx}px`,
    maxWidth: "80vw",
    background: "#1e1e1e",
    color: "#cccccc",
    boxShadow: "0 0 16px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    padding: "12px",
    boxSizing: "border-box",
    transform: "translateX(100%)",
    transition: "transform 0.2s ease-out",
    pointerEvents: "auto",
    fontFamily:
      "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontSize: "14px",
  } as CSSStyleDeclaration);

  const content = document.createElement("div");
  Object.assign(content.style, {
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    margin: "0",
    display: "flex",
    flexDirection: "column",
  } as CSSStyleDeclaration);

  drawer.appendChild(content);
  shadow.appendChild(handle);
  shadow.appendChild(drawer);
  document.body.appendChild(root);

  return { root, shadow, handle, drawer, content };
}

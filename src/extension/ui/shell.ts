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
  
  // Create left arrow SVG icon (drawer is closed, arrow points left to open)
  const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrowSvg.setAttribute("width", "20"); // Bigger SVG icon
  arrowSvg.setAttribute("height", "20");
  arrowSvg.setAttribute("viewBox", "0 0 24 24");
  arrowSvg.setAttribute("fill", "none");
  arrowSvg.setAttribute("stroke", "currentColor");
  arrowSvg.setAttribute("stroke-width", "2");
  arrowSvg.setAttribute("stroke-linecap", "round");
  arrowSvg.setAttribute("stroke-linejoin", "round");
  
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M19 12H5M12 19l-7-7 7-7");
  arrowSvg.appendChild(arrowPath);
  handle.appendChild(arrowSvg);
  
  // Rounded rectangle shape (cubic - equal width and height)
  // Border radius only on left side to connect with drawer
  Object.assign(handle.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    width: "32px", // Bigger cubic shape: equal width and height
    height: "32px",
    padding: "0", // No padding, use fixed dimensions for cubic shape
    borderRadius: `${CURSOR_BORDERS.radius.sm} 0 0 ${CURSOR_BORDERS.radius.sm}`, // Rounded corners only on left side
    background: CURSOR_COLORS.background, // Match drawer background
    color: CURSOR_COLORS.textPrimary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    pointerEvents: "auto",
    userSelect: "none",
    transition: "right 0.2s ease-out, transform 0.2s ease-out, background-color 0.2s",
    zIndex: "999999", // Ensure handle stays visible
  } as CSSStyleDeclaration);
  
  // Hover effect: slightly lighter background (like input area container)
  handle.addEventListener("mouseenter", () => {
    handle.style.background = CURSOR_COLORS.inputBackgroundContainer; // rgb(45, 45, 48) - matches text area background
  });
  handle.addEventListener("mouseleave", () => {
    handle.style.background = CURSOR_COLORS.background; // Return to drawer background
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

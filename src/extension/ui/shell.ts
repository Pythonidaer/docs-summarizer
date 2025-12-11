import {
    DRAWER_ROOT_ID,
    DRAWER_PANEL_ID,
    DRAWER_HANDLE_ID,
} from "../constants";

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
  handle.textContent = "<";
  Object.assign(handle.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    width: "24px",
    height: "80px",
    background: "#1a1a1a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px 0 0 8px",
    boxShadow: "0 0 6px rgba(0,0,0,0.4)",
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: "18px",
    userSelect: "none",
    transition: "right 0.2s ease-out, transform 0.2s ease-out",
  } as CSSStyleDeclaration);

  const drawer = document.createElement("div");
  drawer.id = DRAWER_PANEL_ID;
  Object.assign(drawer.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100%",
    width: `${drawerWidthPx}px`,
    maxWidth: "80vw",
    background: "#121212",
    color: "#f5f5f5",
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

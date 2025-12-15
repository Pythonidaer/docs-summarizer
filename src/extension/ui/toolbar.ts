// src/extension/ui/toolbar.ts
// Toolbar (currently empty, but structure kept for future use)

export interface ToolbarElements {
  toolbar: HTMLDivElement;
}

export function createToolbar(): ToolbarElements {
  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  } as CSSStyleDeclaration);

  // Toolbar is currently empty - bookmarks are accessed via --bookmarks command
  // This structure is kept for future toolbar items

  return {
    toolbar,
  };
}

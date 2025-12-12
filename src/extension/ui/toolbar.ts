// src/extension/ui/toolbar.ts
// Toolbar is now minimal - dropdowns and controls moved to footer
// This file kept for backward compatibility but returns empty/minimal toolbar

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

  // Toolbar is now empty - all controls moved to footer
  return {
    toolbar,
  };
}

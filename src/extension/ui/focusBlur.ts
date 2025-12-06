// src/extension/ui/focusBlur.ts
import { DRAWER_ROOT_ID } from "../constants";

const OVERLAY_ID_TOP = "docs-summarizer-blur-top";
const OVERLAY_ID_BOTTOM = "docs-summarizer-blur-bottom";

let blurEnabled = false;

export function injectBlurStyles(): void {
  if (document.getElementById("docs-summarizer-blur-style")) return;

  const style = document.createElement("style");
  style.id = "docs-summarizer-blur-style";
  style.textContent = `
    #${OVERLAY_ID_TOP},
    #${OVERLAY_ID_BOTTOM} {
      position: fixed;
      left: 0;
      right: 0;
      z-index: 999998; /* below the drawer (999999 in shell.ts) */
      pointer-events: none;
      backdrop-filter: blur(6px) brightness(0.6);
      background: rgba(15, 23, 42, 0.85); /* darker slate-like overlay */
      transition: opacity 150ms ease-out;
      opacity: 0;
    }

    #${OVERLAY_ID_TOP} {
      top: 0;
      height: 33vh;
    }

    #${OVERLAY_ID_BOTTOM} {
      bottom: 0;
      height: 33vh;
    }
  `;
  document.head.appendChild(style);
}

export function setBlurEnabled(enabled: boolean): void {
  blurEnabled = enabled;
  if (!enabled) {
    setPageBlur(false);
  }
}

export function getBlurEnabled(): boolean {
  return blurEnabled;
}

function ensureOverlays(): { top: HTMLDivElement; bottom: HTMLDivElement } {
  let top = document.getElementById(OVERLAY_ID_TOP) as HTMLDivElement | null;
  let bottom = document.getElementById(
    OVERLAY_ID_BOTTOM
  ) as HTMLDivElement | null;

  if (!top) {
    top = document.createElement("div");
    top.id = OVERLAY_ID_TOP;
    document.body.appendChild(top);
  }

  if (!bottom) {
    bottom = document.createElement("div");
    bottom.id = OVERLAY_ID_BOTTOM;
    document.body.appendChild(bottom);
  }

  return { top, bottom };
}

export function setPageBlur(active: boolean): void {
  // If feature disabled, always hide overlays
  if (!blurEnabled || !active) {
    const top = document.getElementById(OVERLAY_ID_TOP) as HTMLDivElement | null;
    const bottom = document.getElementById(
      OVERLAY_ID_BOTTOM
    ) as HTMLDivElement | null;

    if (top) top.style.opacity = "0";
    if (bottom) bottom.style.opacity = "0";
    return;
  }

  const { top, bottom } = ensureOverlays();

  // Make sure we do not accidentally blur the drawer root itself
  const drawerRoot = document.getElementById(DRAWER_ROOT_ID);
  if (drawerRoot) {
    drawerRoot.style.zIndex = "999999";
  }

  top.style.opacity = "1";
  bottom.style.opacity = "1";
}

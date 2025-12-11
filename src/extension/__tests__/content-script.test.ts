/** @jest-environment jsdom */

// Mock chrome API before importing content-script
(global as any).chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

import { setDrawerOpen } from "../content-script";
import { DRAWER_WIDTH_PX } from "../constants";

describe("setDrawerOpen", () => {
  let root: HTMLElement;
  let drawer: HTMLElement;
  let handle: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    
    root = document.createElement("div");
    drawer = document.createElement("div");
    handle = document.createElement("div");
    
    // Set up drawer with maxWidth constraint (like in shell.ts)
    Object.assign(drawer.style, {
      position: "fixed",
      right: "0",
      width: `${DRAWER_WIDTH_PX}px`,
      maxWidth: "80vw",
    } as CSSStyleDeclaration);
    
    document.body.appendChild(root);
    document.body.appendChild(drawer);
    document.body.appendChild(handle);
  });

  test("positions handle at right: 0 when drawer is closed", () => {
    setDrawerOpen(root, drawer, handle, false);

    expect(handle.style.right).toBe("0px");
    expect(handle.textContent).toBe("<");
    expect(root.classList.contains("docs-summarizer--open")).toBe(false);
  });

  test("positions handle based on drawer's actual rendered width when open", () => {
    // Set viewport to a size where drawer would be full width
    Object.assign(drawer.style, {
      width: `${DRAWER_WIDTH_PX}px`,
      maxWidth: "80vw",
    });
    
    // Force layout calculation
    drawer.getBoundingClientRect();
    
    setDrawerOpen(root, drawer, handle, true);

    const drawerRect = drawer.getBoundingClientRect();
    const actualDrawerWidth = drawerRect.width;
    
    expect(handle.style.right).toBe(`${actualDrawerWidth}px`);
    expect(handle.textContent).toBe(">");
    expect(root.classList.contains("docs-summarizer--open")).toBe(true);
  });

  test("positions handle correctly when drawer is constrained by maxWidth", () => {
    // Simulate narrow viewport (like split-screen)
    // Set viewport width to 600px (80vw = 480px, less than 800px)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 600,
    });
    
    Object.assign(drawer.style, {
      width: `${DRAWER_WIDTH_PX}px`,
      maxWidth: "80vw",
    });
    
    // Force layout calculation
    const drawerRect = drawer.getBoundingClientRect();
    
    setDrawerOpen(root, drawer, handle, true);

    const actualDrawerWidth = drawer.getBoundingClientRect().width;
    
    // Handle should be positioned at the actual drawer width, not the fixed 800px
    expect(handle.style.right).toBe(`${actualDrawerWidth}px`);
    // In a 600px viewport, drawer should be 480px (80vw), not 800px
    expect(parseFloat(handle.style.right)).toBeLessThan(DRAWER_WIDTH_PX);
  });

  test("sets drawer transform correctly when opening", () => {
    setDrawerOpen(root, drawer, handle, true);

    expect(drawer.style.transform).toBe("translateX(0)");
  });

  test("sets drawer transform correctly when closing", () => {
    setDrawerOpen(root, drawer, handle, false);

    expect(drawer.style.transform).toBe("translateX(100%)");
  });

  test("updates handle text content correctly", () => {
    setDrawerOpen(root, drawer, handle, true);
    expect(handle.textContent).toBe(">");

    setDrawerOpen(root, drawer, handle, false);
    expect(handle.textContent).toBe("<");
  });

  test("adds and removes root class correctly", () => {
    setDrawerOpen(root, drawer, handle, true);
    expect(root.classList.contains("docs-summarizer--open")).toBe(true);

    setDrawerOpen(root, drawer, handle, false);
    expect(root.classList.contains("docs-summarizer--open")).toBe(false);
  });

  test("handles rapid open/close transitions", () => {
    setDrawerOpen(root, drawer, handle, true);
    const widthWhenOpen = parseFloat(handle.style.right);
    
    setDrawerOpen(root, drawer, handle, false);
    expect(handle.style.right).toBe("0px");
    
    setDrawerOpen(root, drawer, handle, true);
    const widthWhenReopened = parseFloat(handle.style.right);
    
    // Width should be consistent
    expect(widthWhenReopened).toBe(widthWhenOpen);
  });
});


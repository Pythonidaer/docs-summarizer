/** @jest-environment jsdom */

// Mock chrome API before importing content-script
(global as any).chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

import { setDrawerOpen, extractPageTextFromDoc } from "../content-script";
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
    handle.title = "Open Chat Window"; // Initial tooltip
    
    // Create SVG arrow icon in handle (as createDrawerShell does)
    const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowSvg.setAttribute("width", "16");
    arrowSvg.setAttribute("height", "16");
    arrowSvg.setAttribute("viewBox", "0 0 24 24");
    arrowSvg.setAttribute("fill", "none");
    arrowSvg.setAttribute("stroke", "currentColor");
    arrowSvg.setAttribute("stroke-width", "2");
    arrowSvg.setAttribute("stroke-linecap", "round");
    arrowSvg.setAttribute("stroke-linejoin", "round");
    
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M19 12H5M12 19l-7-7 7-7"); // Left arrow (default closed state)
    arrowSvg.appendChild(arrowPath);
    handle.appendChild(arrowSvg);
    
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
    // Should have SVG arrow icon pointing left (closed state)
    expect(handle.textContent).toBe("");
    const closedSvg = handle.querySelector("svg");
    expect(closedSvg).not.toBeNull();
    const closedPath = closedSvg?.querySelector("path");
    expect(closedPath?.getAttribute("d")).toContain("M19 12H5"); // Left arrow
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
    // Should have SVG arrow icon pointing right (open state)
    expect(handle.textContent).toBe("");
    const openSvg = handle.querySelector("svg");
    expect(openSvg).not.toBeNull();
    const openPath = openSvg?.querySelector("path");
    expect(openPath?.getAttribute("d")).toContain("M5 12h14"); // Right arrow
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

  test("updates handle text content and tooltip correctly", () => {
    setDrawerOpen(root, drawer, handle, true);
    // Should have SVG arrow icon pointing right (open state)
    expect(handle.textContent).toBe("");
    expect(handle.title).toBe("Close Chat Window"); // Tooltip updates when open
    const openSvg2 = handle.querySelector("svg");
    expect(openSvg2).not.toBeNull();
    const openPath2 = openSvg2?.querySelector("path");
    expect(openPath2?.getAttribute("d")).toContain("M5 12h14"); // Right arrow

    setDrawerOpen(root, drawer, handle, false);
    // Should have SVG arrow icon pointing left (closed state)
    expect(handle.textContent).toBe("");
    expect(handle.title).toBe("Open Chat Window"); // Tooltip updates when closed
    const closedSvg2 = handle.querySelector("svg");
    expect(closedSvg2).not.toBeNull();
    const closedPath2 = closedSvg2?.querySelector("path");
    expect(closedPath2?.getAttribute("d")).toContain("M19 12H5"); // Left arrow
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

describe("extractPageTextFromDoc", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("extracts text from document body", () => {
    document.body.innerHTML = `
      <h1>Title</h1>
      <p>This is a paragraph with some text.</p>
      <p>Another paragraph here.</p>
    `;

    const text = extractPageTextFromDoc(document);

    expect(text).toContain("Title");
    expect(text).toContain("This is a paragraph");
    expect(text).toContain("Another paragraph");
  });

  test("removes script and style tags", () => {
    document.body.innerHTML = `
      <p>Visible text</p>
      <script>console.log('hidden');</script>
      <style>.hidden { display: none; }</style>
      <p>More visible text</p>
    `;

    const text = extractPageTextFromDoc(document);

    expect(text).toContain("Visible text");
    expect(text).toContain("More visible text");
    expect(text).not.toContain("console.log");
    expect(text).not.toContain(".hidden");
  });

  test("normalizes whitespace", () => {
    document.body.innerHTML = `
      <p>Text    with    multiple    spaces</p>
      <p>Text
      
      with
      
      newlines</p>
    `;

    const text = extractPageTextFromDoc(document);

    // Should collapse multiple spaces and newlines
    expect(text).not.toContain("    ");
    expect(text).toContain("Text with multiple spaces");
  });

  test("returns empty string for empty body", () => {
    document.body.innerHTML = "";

    const text = extractPageTextFromDoc(document);

    expect(text).toBe("");
  });

  test("handles body with only script/style tags", () => {
    document.body.innerHTML = `
      <script>const x = 1;</script>
      <style>body { margin: 0; }</style>
    `;

    const text = extractPageTextFromDoc(document);

    expect(text.trim()).toBe("");
  });

  test("handles nested elements", () => {
    document.body.innerHTML = `
      <div>
        <h1>Title</h1>
        <div>
          <p>Nested paragraph</p>
        </div>
      </div>
    `;

    const text = extractPageTextFromDoc(document);

    expect(text).toContain("Title");
    expect(text).toContain("Nested paragraph");
  });

  test("preserves text content order", () => {
    document.body.innerHTML = `
      <p>First</p>
      <p>Second</p>
      <p>Third</p>
    `;

    const text = extractPageTextFromDoc(document);

    const firstIndex = text.indexOf("First");
    const secondIndex = text.indexOf("Second");
    const thirdIndex = text.indexOf("Third");

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });
});


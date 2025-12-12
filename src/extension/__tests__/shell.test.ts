/** @jest-environment jsdom */

import { createDrawerShell } from "../ui/shell";
import { DRAWER_ROOT_ID, DRAWER_PANEL_ID, DRAWER_HANDLE_ID } from "../constants";

describe("createDrawerShell", () => {
  test("creates drawer shell with all required elements", () => {
    const { root, shadow, handle, drawer, content } = createDrawerShell(800);

    expect(root).toBeInstanceOf(HTMLDivElement);
    expect(shadow).toBeInstanceOf(ShadowRoot);
    expect(handle).toBeInstanceOf(HTMLDivElement);
    expect(drawer).toBeInstanceOf(HTMLDivElement);
    expect(content).toBeInstanceOf(HTMLDivElement);
  });

  test("root element has correct ID and styling", () => {
    const { root } = createDrawerShell(800);

    expect(root.id).toBe(DRAWER_ROOT_ID);
    expect(root.style.position).toBe("fixed");
    expect(root.style.top).toBe("0px"); // Browser normalizes to "0px"
    expect(root.style.right).toBe("0px"); // Browser normalizes to "0px"
    expect(root.style.height).toBe("100%");
    expect(root.style.width).toBe("0px"); // Browser normalizes to "0px"
    expect(root.style.zIndex).toBe("999999");
    expect(root.style.pointerEvents).toBe("none");
  });

  test("root is attached to document body", () => {
    const { root } = createDrawerShell(800);

    expect(document.body.contains(root)).toBe(true);
  });

  test("handle has correct ID and styling", () => {
    const { handle } = createDrawerShell(800);

    expect(handle.id).toBe(DRAWER_HANDLE_ID);
    expect(handle.title).toBe("Open Chat Window"); // Tooltip
    // Should have SVG arrow icon, not text
    expect(handle.textContent).toBe("");
    const svg = handle.querySelector("svg");
    expect(svg).not.toBeNull();
    // SVG should be bigger
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
    expect(handle.style.position).toBe("fixed");
    expect(handle.style.top).toBe("50%");
    expect(handle.style.right).toBe("0px"); // Browser normalizes to "0px"
    // Should be cubic shape (equal width and height), bigger
    expect(handle.style.width).toBe("32px");
    expect(handle.style.height).toBe("32px");
    expect(handle.style.padding).toBe("0px"); // No padding, fixed dimensions
    expect(handle.style.borderRadius).toBe("4px 0 0 4px"); // Rounded corners only on left side (browser normalizes 0px to 0)
    expect(handle.style.clipPath === "" || handle.style.clipPath === "none" || !handle.style.clipPath).toBe(true); // No clip-path
    // Arrow should be centered
    expect(handle.style.justifyContent).toBe("center");
    expect(handle.style.background).toBe("rgb(30, 30, 30)"); // CURSOR_COLORS.background (matches drawer)
    expect(handle.style.color).toBe("rgb(204, 204, 204)"); // CURSOR_COLORS.textPrimary
    expect(handle.style.cursor).toBe("pointer");
    expect(handle.style.pointerEvents).toBe("auto");
    expect(handle.style.zIndex).toBe("999999"); // Ensure visibility
  });

  test("drawer has correct ID and styling", () => {
    const { drawer } = createDrawerShell(800);

    expect(drawer.id).toBe(DRAWER_PANEL_ID);
    expect(drawer.style.position).toBe("fixed");
    expect(drawer.style.top).toBe("0px"); // Browser normalizes to "0px"
    expect(drawer.style.right).toBe("0px"); // Browser normalizes to "0px"
    expect(drawer.style.height).toBe("100%");
    expect(drawer.style.width).toBe("800px");
    expect(drawer.style.maxWidth).toBe("80vw");
    expect(drawer.style.background).toBe("rgb(30, 30, 30)");
    expect(drawer.style.color).toBe("rgb(204, 204, 204)");
    expect(drawer.style.transform).toBe("translateX(100%)");
  });

  test("drawer width respects parameter", () => {
    const { drawer } = createDrawerShell(600);

    expect(drawer.style.width).toBe("600px");
  });

  test("content has correct styling", () => {
    const { content } = createDrawerShell(800);

    expect(content.style.height).toBe("100%");
    expect(content.style.width).toBe("100%");
    expect(content.style.maxWidth).toBe("100%");
    expect(content.style.display).toBe("flex");
    expect(content.style.flexDirection).toBe("column");
  });

  test("elements are properly nested", () => {
    const { shadow, handle, drawer, content } = createDrawerShell(800);

    expect(shadow.contains(handle)).toBe(true);
    expect(shadow.contains(drawer)).toBe(true);
    expect(drawer.contains(content)).toBe(true);
  });

  test("handle is clickable", () => {
    const { handle } = createDrawerShell(800);
    const clickHandler = jest.fn();
    handle.addEventListener("click", clickHandler);

    handle.click();

    expect(clickHandler).toHaveBeenCalledTimes(1);
  });
});


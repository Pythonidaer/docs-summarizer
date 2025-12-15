/** @jest-environment jsdom */

import { createHeader } from "../ui/header";

describe("createHeader", () => {
  test("creates header with delete key button and close button", () => {
    const { header, closeButton, deleteKeyButton } = createHeader();

    expect(header).toBeInstanceOf(HTMLDivElement);
    expect(closeButton).toBeInstanceOf(HTMLButtonElement);
    expect(deleteKeyButton).toBeInstanceOf(HTMLButtonElement);
    expect(header.contains(closeButton)).toBe(true);
    expect(header.contains(deleteKeyButton)).toBe(true);
  });

  test("header has correct styling", () => {
    const { header } = createHeader();

    expect(header.style.display).toBe("flex");
    expect(header.style.alignItems).toBe("center");
    expect(header.style.justifyContent).toBe("space-between"); // Changed to space-between for delete key button
    expect(header.style.marginBottom).toBe("10px");
    expect(header.style.paddingBottom).toBe("6px");
    // Border may have spaces normalized, so check for the rgba value
    expect(header.style.borderBottom).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.12\)/);
  });

  test("header contains delete key button and close button", () => {
    const { header, deleteKeyButton, closeButton } = createHeader();

    // Should have both buttons
    expect(header.children.length).toBe(2);
    expect(header.contains(deleteKeyButton)).toBe(true);
    expect(header.contains(closeButton)).toBe(true);
    // Delete key button should be first (left side)
    expect(header.children[0]).toBe(deleteKeyButton);
    // Close button should be second (right side)
    expect(header.children[1]).toBe(closeButton);
  });

  test("close button has correct styling and text", () => {
    const { closeButton } = createHeader();

    expect(closeButton.textContent).toBe("×");
    // Border may be "none" or empty string depending on browser normalization
    expect(closeButton.style.border === "none" || closeButton.style.border === "").toBe(true);
    // Close button now has circular background (always visible)
    expect(closeButton.style.background).toBe("rgb(60, 60, 60)"); // CURSOR_COLORS.buttonSecondary
    expect(closeButton.style.color).toBe("rgb(204, 204, 204)"); // CURSOR_COLORS.textPrimary
    expect(closeButton.style.cursor).toBe("pointer");
    expect(closeButton.style.fontSize).toBe("18px");
    // marginLeft removed since we use space-between layout
    expect(closeButton.style.width).toBe("24px"); // Circular button (fixed width)
    expect(closeButton.style.height).toBe("24px"); // Circular button (fixed height)
    expect(closeButton.style.padding).toBe("0px"); // No padding, fixed dimensions
    expect(closeButton.style.borderRadius).toBe("50%"); // Perfect circle
    expect(closeButton.style.transition).toBe("background-color 0.2s");
  });

  test("delete key button has correct styling and text", () => {
    const { deleteKeyButton } = createHeader();

    expect(deleteKeyButton.textContent).toBe("Delete Key");
    expect(deleteKeyButton.style.color).toBe("rgb(239, 68, 68)"); // Red text (#ef4444)
    expect(deleteKeyButton.style.border).toContain("rgb(239, 68, 68)"); // Red border
    expect(deleteKeyButton.style.borderRadius).toBe("9999px"); // Pill-shaped like Summarize button
    expect(deleteKeyButton.style.cursor).toBe("pointer");
    expect(deleteKeyButton.style.background).toBe("transparent");
  });

  test("close button is clickable", () => {
    const { closeButton } = createHeader();
    const clickHandler = jest.fn();
    closeButton.addEventListener("click", clickHandler);

    closeButton.click();

    expect(clickHandler).toHaveBeenCalledTimes(1);
  });
});


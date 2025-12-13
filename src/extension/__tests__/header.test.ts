/** @jest-environment jsdom */

import { createHeader } from "../ui/header";

describe("createHeader", () => {
  test("creates header with title and close button", () => {
    const { header, closeButton } = createHeader();

    expect(header).toBeInstanceOf(HTMLDivElement);
    expect(closeButton).toBeInstanceOf(HTMLButtonElement);
    expect(header.contains(closeButton)).toBe(true);
  });

  test("header has correct styling", () => {
    const { header } = createHeader();

    expect(header.style.display).toBe("flex");
    expect(header.style.alignItems).toBe("center");
    expect(header.style.justifyContent).toBe("flex-end");
    expect(header.style.marginBottom).toBe("10px");
    expect(header.style.paddingBottom).toBe("6px");
    // Border may have spaces normalized, so check for the rgba value
    expect(header.style.borderBottom).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.12\)/);
  });

  test("header contains only close button (no title)", () => {
    const { header } = createHeader();

    // Should not have a title div
    const title = header.querySelector("div");
    expect(title).toBeNull();
    
    // Should only have the close button
    expect(header.children.length).toBe(1);
    expect(header.querySelector("button")).toBe(header.children[0]);
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
    expect(closeButton.style.marginLeft).toBe("auto");
    expect(closeButton.style.width).toBe("24px"); // Circular button (fixed width)
    expect(closeButton.style.height).toBe("24px"); // Circular button (fixed height)
    expect(closeButton.style.padding).toBe("0px"); // No padding, fixed dimensions
    expect(closeButton.style.borderRadius).toBe("50%"); // Perfect circle
    expect(closeButton.style.transition).toBe("background-color 0.2s");
  });

  test("close button is clickable", () => {
    const { closeButton } = createHeader();
    const clickHandler = jest.fn();
    closeButton.addEventListener("click", clickHandler);

    closeButton.click();

    expect(clickHandler).toHaveBeenCalledTimes(1);
  });
});


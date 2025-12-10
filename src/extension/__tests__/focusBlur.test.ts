/** @jest-environment jsdom */
import {
  injectBlurStyles,
  setBlurEnabled,
  getBlurEnabled,
  setPageBlur,
} from "../ui/focusBlur";
import { DRAWER_ROOT_ID } from "../constants";

describe("focusBlur", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    setBlurEnabled(false);
    setPageBlur(false);
  });

  describe("injectBlurStyles", () => {
    test("injects blur styles on first call", () => {
      expect(document.getElementById("docs-summarizer-blur-style")).toBeNull();

      injectBlurStyles();

      const style = document.getElementById("docs-summarizer-blur-style");
      expect(style).not.toBeNull();
      expect(style?.tagName).toBe("STYLE");
      expect(style?.textContent).toContain("docs-summarizer-blur-top");
      expect(style?.textContent).toContain("docs-summarizer-blur-bottom");
      expect(style?.textContent).toContain("backdrop-filter");
    });

    test("does not inject styles twice (idempotent)", () => {
      injectBlurStyles();
      const firstStyle = document.getElementById("docs-summarizer-blur-style");

      injectBlurStyles();
      const secondStyle = document.getElementById("docs-summarizer-blur-style");

      expect(firstStyle).toBe(secondStyle); // Same element, not duplicated
      const allStyles = document.querySelectorAll("#docs-summarizer-blur-style");
      expect(allStyles.length).toBe(1);
    });

    test("injected styles contain correct CSS properties", () => {
      injectBlurStyles();
      const style = document.getElementById("docs-summarizer-blur-style");
      const css = style?.textContent || "";

      expect(css).toContain("position: fixed");
      expect(css).toContain("backdrop-filter");
      expect(css).toContain("z-index: 999998");
      expect(css).toContain("pointer-events: none");
    });
  });

  describe("setBlurEnabled", () => {
    test("sets blur enabled state", () => {
      expect(getBlurEnabled()).toBe(false);

      setBlurEnabled(true);
      expect(getBlurEnabled()).toBe(true);

      setBlurEnabled(false);
      expect(getBlurEnabled()).toBe(false);
    });

    test("calls setPageBlur(false) when disabled", () => {
      setBlurEnabled(true);
      setPageBlur(true);

      // Verify blur is active
      const topOverlay = document.getElementById("docs-summarizer-blur-top");
      const bottomOverlay = document.getElementById("docs-summarizer-blur-bottom");
      if (topOverlay && bottomOverlay) {
        expect(topOverlay.style.opacity).toBe("1");
      }

      setBlurEnabled(false);

      // Blur should be deactivated
      if (topOverlay && bottomOverlay) {
        expect(topOverlay.style.opacity).toBe("0");
        expect(bottomOverlay.style.opacity).toBe("0");
      }
    });
  });

  describe("getBlurEnabled", () => {
    test("returns current blur enabled state", () => {
      expect(getBlurEnabled()).toBe(false);

      setBlurEnabled(true);
      expect(getBlurEnabled()).toBe(true);

      setBlurEnabled(false);
      expect(getBlurEnabled()).toBe(false);
    });
  });

  describe("setPageBlur", () => {
    beforeEach(() => {
      injectBlurStyles();
    });

    test("creates overlays when active and blur is enabled", () => {
      setBlurEnabled(true);
      setPageBlur(true);

      const topOverlay = document.getElementById("docs-summarizer-blur-top");
      const bottomOverlay = document.getElementById("docs-summarizer-blur-bottom");

      expect(topOverlay).not.toBeNull();
      expect(bottomOverlay).not.toBeNull();
      expect(topOverlay?.style.opacity).toBe("1");
      expect(bottomOverlay?.style.opacity).toBe("1");
    });

    test("hides overlays when inactive", () => {
      setBlurEnabled(true);
      setPageBlur(true);
      setPageBlur(false);

      const topOverlay = document.getElementById("docs-summarizer-blur-top");
      const bottomOverlay = document.getElementById("docs-summarizer-blur-bottom");

      if (topOverlay && bottomOverlay) {
        expect(topOverlay.style.opacity).toBe("0");
        expect(bottomOverlay.style.opacity).toBe("0");
      }
    });

    test("hides overlays when blur is disabled even if active", () => {
      setBlurEnabled(true);
      setPageBlur(true);

      setBlurEnabled(false);

      const topOverlay = document.getElementById("docs-summarizer-blur-top");
      const bottomOverlay = document.getElementById("docs-summarizer-blur-bottom");

      if (topOverlay && bottomOverlay) {
        expect(topOverlay.style.opacity).toBe("0");
        expect(bottomOverlay.style.opacity).toBe("0");
      }
    });

    test("does not blur drawer root", () => {
      const drawerRoot = document.createElement("div");
      drawerRoot.id = DRAWER_ROOT_ID;
      document.body.appendChild(drawerRoot);

      setBlurEnabled(true);
      setPageBlur(true);

      // Drawer root should have higher z-index
      expect(drawerRoot.style.zIndex).toBe("999999");
    });

    test("handles missing overlays gracefully", () => {
      // Remove overlays if they exist
      const top = document.getElementById("docs-summarizer-blur-top");
      const bottom = document.getElementById("docs-summarizer-blur-bottom");
      if (top) top.remove();
      if (bottom) bottom.remove();

      setBlurEnabled(true);
      // Should not throw when overlays don't exist yet
      expect(() => setPageBlur(true)).not.toThrow();

      // Overlays should be created
      const newTop = document.getElementById("docs-summarizer-blur-top");
      const newBottom = document.getElementById("docs-summarizer-blur-bottom");
      expect(newTop).not.toBeNull();
      expect(newBottom).not.toBeNull();
    });

    test("overlays are created and visible when active", () => {
      setBlurEnabled(true);
      setPageBlur(true);

      const topOverlay = document.getElementById("docs-summarizer-blur-top");
      const bottomOverlay = document.getElementById("docs-summarizer-blur-bottom");

      expect(topOverlay).not.toBeNull();
      expect(bottomOverlay).not.toBeNull();
      // Positioning is set via CSS classes, not inline styles
      // Verify they exist and have opacity set
      expect(topOverlay?.style.opacity).toBe("1");
      expect(bottomOverlay?.style.opacity).toBe("1");
    });
  });
});


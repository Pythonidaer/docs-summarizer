/** @jest-environment jsdom */

import {
  createInstructionsPanel,
  wireInstructionsToggle,
} from "../ui/instructionsPanel";

describe("createInstructionsPanel", () => {
  test("creates panel with container and textarea", () => {
    const onChange = jest.fn();
    const { container, textarea } = createInstructionsPanel(onChange);

    expect(container).toBeInstanceOf(HTMLDivElement);
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(container.contains(textarea)).toBe(true);
  });

  test("container is hidden by default", () => {
    const onChange = jest.fn();
    const { container } = createInstructionsPanel(onChange);

    expect(container.style.display).toBe("none");
  });

  test("textarea has correct styling and placeholder", () => {
    const onChange = jest.fn();
    const { textarea } = createInstructionsPanel(onChange);

    expect(textarea.style.width).toBe("100%");
    expect(textarea.style.minHeight).toBe("60px");
    expect(textarea.style.maxHeight).toBe("140px");
    expect(textarea.style.resize).toBe("vertical");
    expect(textarea.style.padding).toBe("6px 8px");
    expect(textarea.style.borderRadius).toBe("4px");
    expect(textarea.style.background).toBe("rgb(5, 5, 5)");
    expect(textarea.style.color).toBe("rgb(245, 245, 245)");
    expect(textarea.style.fontSize).toBe("12px");
    expect(textarea.placeholder).toContain("Optional: Add your own custom instructions");
  });

  test("textarea calls onChange when input changes", () => {
    const onChange = jest.fn();
    const { textarea } = createInstructionsPanel(onChange);

    textarea.value = "Test instructions";
    textarea.dispatchEvent(new Event("input"));

    expect(onChange).toHaveBeenCalledWith("Test instructions");
  });

  test("textarea can receive and display text", () => {
    const onChange = jest.fn();
    const { textarea } = createInstructionsPanel(onChange);

    textarea.value = "Custom instruction text";
    expect(textarea.value).toBe("Custom instruction text");
  });
});

describe("wireInstructionsToggle", () => {
  test("shows panel when checkbox is checked", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const container = document.createElement("div");
    container.style.display = "none";
    const textarea = document.createElement("textarea");

    let useCustom = false;
    let customInstructions = "";

    wireInstructionsToggle({
      checkbox,
      container,
      textarea,
      getUseCustomInstructions: () => useCustom,
      setUseCustomInstructions: (value) => {
        useCustom = value;
      },
      setCustomInstructions: (value) => {
        customInstructions = value;
      },
    });

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(container.style.display).toBe("block");
    expect(useCustom).toBe(true);
  });

  test("hides panel when checkbox is unchecked", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    const container = document.createElement("div");
    container.style.display = "block";
    const textarea = document.createElement("textarea");

    let useCustom = true;
    let customInstructions = "Some instructions";

    wireInstructionsToggle({
      checkbox,
      container,
      textarea,
      getUseCustomInstructions: () => useCustom,
      setUseCustomInstructions: (value) => {
        useCustom = value;
      },
      setCustomInstructions: (value) => {
        customInstructions = value;
      },
    });

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));

    expect(container.style.display).toBe("none");
    expect(useCustom).toBe(false);
    expect(customInstructions).toBe("");
  });

  test("seeds starter text when opening with empty textarea", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const container = document.createElement("div");
    container.style.display = "none";
    const textarea = document.createElement("textarea");
    textarea.value = "";

    let customInstructions = "";

    wireInstructionsToggle({
      checkbox,
      container,
      textarea,
      getUseCustomInstructions: () => false,
      setUseCustomInstructions: () => {},
      setCustomInstructions: (value) => {
        customInstructions = value;
      },
    });

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(textarea.value).toContain("// Add any stylistic");
    expect(customInstructions).toContain("// Add any stylistic");
  });

  test("preserves existing text when opening", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const container = document.createElement("div");
    container.style.display = "none";
    const textarea = document.createElement("textarea");
    textarea.value = "Existing instructions";

    let customInstructions = "";

    wireInstructionsToggle({
      checkbox,
      container,
      textarea,
      getUseCustomInstructions: () => false,
      setUseCustomInstructions: () => {},
      setCustomInstructions: (value) => {
        customInstructions = value;
      },
    });

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(textarea.value).toBe("Existing instructions");
    expect(customInstructions).toBe("Existing instructions");
  });

  test("respects initial state from getUseCustomInstructions", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    const container = document.createElement("div");
    container.style.display = "none";
    const textarea = document.createElement("textarea");

    wireInstructionsToggle({
      checkbox,
      container,
      textarea,
      getUseCustomInstructions: () => true,
      setUseCustomInstructions: () => {},
      setCustomInstructions: () => {},
    });

    // Should show panel if getUseCustomInstructions returns true
    expect(container.style.display).toBe("block");
  });
});


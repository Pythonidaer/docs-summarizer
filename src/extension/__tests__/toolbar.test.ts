/** @jest-environment jsdom */

import { createToolbar } from "../ui/toolbar";
import { DEFAULT_MODEL_SETTINGS } from "../constants";

describe("createToolbar", () => {
  test("toolbar is now empty or minimal (dropdowns moved to footer)", () => {
    const { toolbar } = createToolbar();

    expect(toolbar).toBeInstanceOf(HTMLDivElement);
    // Toolbar may be empty or contain minimal structure
  });

});


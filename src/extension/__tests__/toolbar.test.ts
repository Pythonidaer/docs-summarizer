/** @jest-environment jsdom */

import { createToolbar } from "../ui/toolbar";

describe("createToolbar", () => {
  test("creates toolbar element", () => {
    const { toolbar } = createToolbar();

    expect(toolbar).toBeInstanceOf(HTMLDivElement);
  });

  test("toolbar is empty by default (bookmarks accessed via --bookmarks command)", () => {
    const { toolbar } = createToolbar();

    expect(toolbar.children.length).toBe(0);
  });
});


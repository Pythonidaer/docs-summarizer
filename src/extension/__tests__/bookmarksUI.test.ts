/** @jest-environment jsdom */
import { createBookmarksPanel, showBookmarksPanel } from "../ui/bookmarks";
import * as bookmarksStorage from "../storage/bookmarks";

// Mock bookmarks storage
jest.mock("../storage/bookmarks", () => ({
  getBookmarksWithPaths: jest.fn(),
  getFaviconUrl: jest.fn((url: string) => `https://favicon.example.com/${url}`),
  hasBookmarksPermission: jest.fn(),
  requestBookmarksPermission: jest.fn(),
}));

const mockGetBookmarksWithPaths = bookmarksStorage.getBookmarksWithPaths as jest.MockedFunction<
  typeof bookmarksStorage.getBookmarksWithPaths
>;
const mockHasBookmarksPermission = bookmarksStorage.hasBookmarksPermission as jest.MockedFunction<
  typeof bookmarksStorage.hasBookmarksPermission
>;

describe("createBookmarksPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
    // Default: permission granted
    mockHasBookmarksPermission.mockResolvedValue(true);
  });

  test("creates panel with header and close button", () => {
    mockGetBookmarksWithPaths.mockResolvedValue([]);
    
    const { panel, closeButton } = createBookmarksPanel();
    
    expect(panel).toBeInstanceOf(HTMLDivElement);
    expect(closeButton).toBeInstanceOf(HTMLButtonElement);
    
    const title = panel.querySelector("div");
    expect(title?.textContent).toContain("Bookmarks");
  });

  test("close button removes panel", () => {
    mockGetBookmarksWithPaths.mockResolvedValue([]);
    
    const { panel, closeButton } = createBookmarksPanel();
    document.body.appendChild(panel);
    
    expect(document.body.contains(panel)).toBe(true);
    closeButton.click();
    expect(document.body.contains(panel)).toBe(false);
  });

  test("closes on ESC key", () => {
    mockGetBookmarksWithPaths.mockResolvedValue([]);
    
    const { panel } = createBookmarksPanel();
    document.body.appendChild(panel);
    
    expect(document.body.contains(panel)).toBe(true);
    
    const escEvent = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(escEvent);
    
    expect(document.body.contains(panel)).toBe(false);
  });

  test("closes on overlay click", () => {
    mockGetBookmarksWithPaths.mockResolvedValue([]);
    
    const { panel } = createBookmarksPanel();
    document.body.appendChild(panel);
    
    expect(document.body.contains(panel)).toBe(true);
    
    // Click on the panel itself (overlay)
    panel.click();
    
    expect(document.body.contains(panel)).toBe(false);
  });

  test("loads and displays bookmarks", async () => {
    const mockBookmarks = [
      {
        id: "1",
        title: "Test Bookmark",
        url: "https://example.com",
        folderPath: ["Test Folder"],
      },
    ];
    
    mockHasBookmarksPermission.mockResolvedValue(true);
    mockGetBookmarksWithPaths.mockResolvedValue(mockBookmarks as any);
    
    const { panel } = createBookmarksPanel();
    document.body.appendChild(panel);
    
    // Wait for async loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    expect(mockHasBookmarksPermission).toHaveBeenCalled();
    expect(mockGetBookmarksWithPaths).toHaveBeenCalled();
    
    // Check if bookmark is rendered
    const content = panel.querySelector("div[style*='overflow']");
    expect(content?.textContent).toContain("Test Bookmark");
  });

  test("displays error message on load failure", async () => {
    mockHasBookmarksPermission.mockResolvedValue(true);
    mockGetBookmarksWithPaths.mockRejectedValue(new Error("Load failed"));
    
    const { panel } = createBookmarksPanel();
    document.body.appendChild(panel);
    
    // Wait for async loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    const content = panel.querySelector("div[style*='overflow']");
    expect(content?.textContent).toContain("Error");
  });
});

describe("showBookmarksPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("adds panel to document body", () => {
    mockGetBookmarksWithPaths.mockResolvedValue([]);
    
    showBookmarksPanel();
    
    const panel = document.body.querySelector("div[style*='position: fixed']");
    expect(panel).toBeInstanceOf(HTMLDivElement);
  });
});

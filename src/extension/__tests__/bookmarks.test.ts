/** @jest-environment jsdom */
import {
  getAllBookmarks,
  getBookmarksWithPaths,
  getBookmarksByFolderPath,
  getUrlsFromFolder,
  getFaviconUrl,
  searchBookmarks,
} from "../storage/bookmarks";
import type { BookmarkInfo } from "../storage/bookmarks";

// Mock chrome.bookmarks API
const mockBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: "0",
    title: "",
    syncing: false,
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        syncing: false,
        children: [
          {
            id: "10",
            title: "technologies",
            syncing: false,
            children: [
              {
                id: "11",
                title: "Ruby",
                syncing: false,
                children: [
                  {
                    id: "12",
                    title: "Ruby Docs",
                    url: "https://ruby-doc.org",
                    syncing: false,
                  },
                  {
                    id: "13",
                    title: "RSpec",
                    url: "https://rspec.info",
                    syncing: false,
                  },
                ],
              },
              {
                id: "14",
                title: "JavaScript",
                syncing: false,
                children: [
                  {
                    id: "15",
                    title: "MDN",
                    url: "https://developer.mozilla.org",
                    syncing: false,
                  },
                ],
              },
            ],
          },
          {
            id: "20",
            title: "Direct Bookmark",
            url: "https://example.com",
            syncing: false,
          },
        ],
      },
    ],
  },
];

const mockChromeBookmarks = {
  getTree: jest.fn((callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
    callback(mockBookmarks);
  }),
  search: jest.fn((query: string, callback: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
    // Simple search mock - find bookmarks containing query in title
    const results: chrome.bookmarks.BookmarkTreeNode[] = [];
    function searchNode(node: chrome.bookmarks.BookmarkTreeNode): void {
      if (node.title?.toLowerCase().includes(query.toLowerCase())) {
        results.push(node);
      }
      if (node.children) {
        node.children.forEach(searchNode);
      }
    }
    mockBookmarks.forEach(searchNode);
    callback(results);
  }),
};

beforeAll(() => {
  (global as any).chrome = {
    bookmarks: mockChromeBookmarks,
    runtime: {
      lastError: undefined,
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAllBookmarks", () => {
  test("returns bookmark tree", async () => {
    const result = await getAllBookmarks();
    expect(result).toEqual(mockBookmarks);
    expect(mockChromeBookmarks.getTree).toHaveBeenCalledTimes(1);
  });
});

describe("getBookmarksWithPaths", () => {
  test("flattens bookmarks with folder paths", async () => {
    const result = await getBookmarksWithPaths();
    
    expect(result.length).toBeGreaterThan(0);
    
    // Check for Ruby folder
    const rubyFolder = result.find((b) => b.title === "Ruby");
    expect(rubyFolder).toBeDefined();
    expect(rubyFolder?.folderPath).toEqual(["technologies", "Ruby"]);
    expect(rubyFolder?.children).toBeDefined();
    expect(rubyFolder?.children?.length).toBe(2);
    
    // Check for Ruby Docs bookmark
    const rubyDocs = result.find((b) => b.title === "Ruby Docs");
    expect(rubyDocs).toBeDefined();
    expect(rubyDocs?.url).toBe("https://ruby-doc.org");
    expect(rubyDocs?.folderPath).toEqual(["technologies", "Ruby"]);
    
    // Check for direct bookmark
    const direct = result.find((b) => b.title === "Direct Bookmark");
    expect(direct).toBeDefined();
    expect(direct?.url).toBe("https://example.com");
    expect(direct?.folderPath).toEqual(["Direct Bookmark"]);
  });

  test("skips root nodes", async () => {
    const result = await getBookmarksWithPaths();
    
    // Should not include root nodes (id "0", "1", "2")
    const rootNodes = result.filter((b) => b.id === "0" || b.id === "1" || b.id === "2");
    expect(rootNodes.length).toBe(0);
  });
});

describe("getBookmarksByFolderPath", () => {
  test("finds bookmarks in specific folder path", async () => {
    const result = await getBookmarksByFolderPath(["technologies", "Ruby"]);
    
    expect(result.length).toBeGreaterThan(0);
    
    // Should include Ruby folder and its children
    const rubyFolder = result.find((b) => b.title === "Ruby");
    expect(rubyFolder).toBeDefined();
    
    const rubyDocs = result.find((b) => b.title === "Ruby Docs");
    expect(rubyDocs).toBeDefined();
    
    const rspec = result.find((b) => b.title === "RSpec");
    expect(rspec).toBeDefined();
  });

  test("returns empty array for non-existent folder", async () => {
    const result = await getBookmarksByFolderPath(["nonexistent", "folder"]);
    expect(result.length).toBe(0);
  });

  test("finds bookmarks in top-level folder", async () => {
    const result = await getBookmarksByFolderPath(["technologies"]);
    
    expect(result.length).toBeGreaterThan(0);
    
    // Should include Ruby and JavaScript folders
    const ruby = result.find((b) => b.title === "Ruby");
    expect(ruby).toBeDefined();
    
    const js = result.find((b) => b.title === "JavaScript");
    expect(js).toBeDefined();
  });
});

describe("getUrlsFromFolder", () => {
  test("extracts all URLs from folder path", async () => {
    const urls = await getUrlsFromFolder(["technologies", "Ruby"]);
    
    expect(urls).toContain("https://ruby-doc.org");
    expect(urls).toContain("https://rspec.info");
    expect(urls.length).toBe(2);
  });

  test("returns empty array for folder with no URLs", async () => {
    const urls = await getUrlsFromFolder(["nonexistent"]);
    expect(urls).toEqual([]);
  });

  test("includes nested URLs", async () => {
    const urls = await getUrlsFromFolder(["technologies"]);
    
    // Should include URLs from Ruby and JavaScript subfolders
    expect(urls).toContain("https://ruby-doc.org");
    expect(urls).toContain("https://rspec.info");
    expect(urls).toContain("https://developer.mozilla.org");
  });
});

describe("getFaviconUrl", () => {
  test("generates favicon URL for valid URL", () => {
    const url = "https://example.com/page";
    const favicon = getFaviconUrl(url);
    
    expect(favicon).toBe("https://www.google.com/s2/favicons?domain=example.com&sz=16");
  });

  test("handles invalid URL gracefully", () => {
    const favicon = getFaviconUrl("not-a-url");
    expect(favicon).toBe("");
  });
});

describe("searchBookmarks", () => {
  test("searches bookmarks by query", async () => {
    const results = await searchBookmarks("Ruby");
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title?.includes("Ruby"))).toBe(true);
  });

  test("returns empty array for no matches", async () => {
    const results = await searchBookmarks("nonexistent12345");
    expect(results.length).toBe(0);
  });
});

// src/extension/storage/bookmarks.ts
// Chrome Bookmarks API utilities

export interface BookmarkInfo {
  id: string;
  title: string;
  url?: string;
  folderPath: string[];
  children?: BookmarkInfo[];
}

/**
 * Check if bookmarks permission is granted
 */
export function hasBookmarksPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    // Try direct API first (works in background/service worker)
    if (chrome.permissions) {
      chrome.permissions.contains({ permissions: ["bookmarks"] }, (result) => {
        resolve(result === true);
      });
      return;
    }
    
    // Fallback: check via background script (for content scripts)
    chrome.runtime.sendMessage(
      { type: "CHECK_BOOKMARKS_PERMISSION" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Docs Summarizer] Failed to check permission:", chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response?.hasPermission === true);
        }
      }
    );
  });
}

/**
 * Request bookmarks permission from user
 * Must be called from a user gesture (button click)
 */
export function requestBookmarksPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    // Always route through background script for consistency
    // The background script has better access to the permissions API
    console.log("[Docs Summarizer] Sending permission request to background script");
    chrome.runtime.sendMessage(
      { type: "REQUEST_BOOKMARKS_PERMISSION" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Docs Summarizer] Failed to send permission request:", chrome.runtime.lastError);
          resolve(false);
        } else if (response?.error) {
          console.error("[Docs Summarizer] Permission request error:", response.error);
          resolve(false);
        } else {
          console.log("[Docs Summarizer] Permission request response:", response);
          resolve(response?.granted === true);
        }
      }
    );
  });
}

/**
 * Get all bookmarks as a tree structure
 * Routes through background script since chrome.bookmarks API is not available in content scripts
 */
export function getAllBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    // Try direct API first (works in background/service worker)
    if (chrome.bookmarks && chrome.bookmarks.getTree) {
      chrome.bookmarks.getTree((tree) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tree);
        }
      });
      return;
    }
    
    // Fallback: route through background script (required for content scripts)
    chrome.runtime.sendMessage(
      { type: "GET_ALL_BOOKMARKS" },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response?.bookmarks || []);
        }
      }
    );
  });
}

/**
 * Flatten bookmark tree and build folder paths
 * Returns a flat list where all items are at the top level, but they maintain
 * their folderPath and optional children for nested structure
 */
function flattenBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  path: string[] = [],
  flatResult: BookmarkInfo[] = []
): BookmarkInfo[] {
  for (const node of nodes) {
    // Skip root "Bookmarks Bar" and "Other Bookmarks" - they're just containers
    if (node.id === "0" || node.id === "1" || node.id === "2") {
      if (node.children) {
        flattenBookmarks(node.children, path, flatResult);
      }
      continue;
    }

    // For folders: include folder name in path
    // For bookmarks: use parent folder path (without bookmark's own title)
    // Exception: if path is empty (root level bookmark), use the bookmark's title as folderPath
    const isBookmark = !!node.url;
    const folderPath = isBookmark 
      ? (path.length === 0 && node.title ? [node.title] : path)
      : (node.title ? [...path, node.title] : path);
    // For processing children, use the folder's full path (which includes the folder name for folders)
    const pathForChildren = node.title && !isBookmark ? [...path, node.title] : path;
    
    const bookmark: BookmarkInfo = {
      id: node.id,
      title: node.title || "Untitled",
      ...(node.url && { url: node.url }),
      folderPath: folderPath,
    };

    // Add this bookmark to the flat result
    flatResult.push(bookmark);

    // Process children and add them to flat result too
    if (node.children && node.children.length > 0) {
      flattenBookmarks(node.children, pathForChildren, flatResult);
      // Also store direct children on the parent for nested access
      if (!isBookmark) {
        // For folders, find direct children:
        // - Bookmarks: folderPath should match the folder's path exactly
        // - Nested folders: folderPath should be one level deeper
        bookmark.children = flatResult.filter((child) => {
          // Skip the parent itself
          if (child.id === bookmark.id) return false;
          // For bookmarks: folderPath matches exactly
          if (child.url && child.folderPath.length === folderPath.length) {
            return folderPath.every((seg, i) => child.folderPath[i] === seg);
          }
          // For nested folders: folderPath is one level deeper
          if (!child.url && child.folderPath.length === folderPath.length + 1) {
            return folderPath.every((seg, i) => child.folderPath[i] === seg);
          }
          return false;
        });
      }
    }
  }

  return flatResult;
}

/**
 * Get all bookmarks with folder paths
 */
export async function getBookmarksWithPaths(): Promise<BookmarkInfo[]> {
  const tree = await getAllBookmarks();
  return flattenBookmarks(tree);
}

/**
 * Find bookmarks by folder path (e.g., ["technologies", "Ruby"])
 * Returns all bookmarks (including nested folders) within that path
 */
export async function getBookmarksByFolderPath(
  folderPath: string[]
): Promise<BookmarkInfo[]> {
  const allBookmarks = await getBookmarksWithPaths();
  const result: BookmarkInfo[] = [];

  for (const bookmark of allBookmarks) {
    // Check if bookmark's path matches the target path exactly or is nested within it
    // For exact match: ["technologies", "Ruby"] should match ["technologies", "Ruby"]
    // For nested: ["technologies", "Ruby"] should match ["technologies", "Ruby", "Ruby Docs"]
    if (bookmark.folderPath.length >= folderPath.length) {
      const matches = folderPath.every(
        (segment, index) => bookmark.folderPath[index] === segment
      );
      if (matches) {
        result.push(bookmark);
      }
    }
  }

  return result;
}

/**
 * Get all URLs from a specific folder path
 * Returns URLs from the specified folder and all nested subfolders
 */
export async function getUrlsFromFolder(
  folderPath: string[]
): Promise<string[]> {
  const allBookmarks = await getBookmarksWithPaths();
  const urls: string[] = [];

  // Collect all URLs that are within the specified folder path
  // This includes direct children and nested items
  for (const bookmark of allBookmarks) {
    if (bookmark.url && bookmark.folderPath.length >= folderPath.length) {
      const matches = folderPath.every(
        (seg, index) => bookmark.folderPath[index] === seg
      );
      if (matches) {
        urls.push(bookmark.url);
      }
    }
  }

  return urls;
}

/**
 * Get favicon URL for a bookmark
 * Chrome doesn't provide direct favicon API, but we can construct it
 */
export function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Chrome's favicon service
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
  } catch {
    // Fallback for invalid URLs
    return "";
  }
}

/**
 * Search bookmarks by title or URL
 * Routes through background script since chrome.bookmarks API is not available in content scripts
 */
export async function searchBookmarks(
  query: string
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    // Try direct API first (works in background/service worker)
    if (chrome.bookmarks && chrome.bookmarks.search) {
      chrome.bookmarks.search(query, (results) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results);
        }
      });
      return;
    }
    
    // For content scripts, we'd need to add a background message handler
    // For now, just reject with helpful message
    reject(new Error(
      "Bookmark search is not available in content scripts. " +
      "This feature requires the bookmarks API which is only available in background scripts."
    ));
  });
}

// src/extension/bookmarksCommand.ts
// Bookmark command parser and formatter for chat

import {
  getBookmarksWithPaths,
  getBookmarksByFolderPath,
  getUrlsFromFolder,
  hasBookmarksPermission,
  requestBookmarksPermission,
  type BookmarkInfo,
} from "./storage/bookmarks";

export interface BookmarksCommandResult {
  success: boolean;
  message: string;
  needsPermission?: boolean;
  bookmarks?: BookmarkInfo[]; // Include bookmarks data for collapsible tree
}

/**
 * Parses user input to check if it's a bookmark command.
 * Returns a marker string if it's a bookmark command, null otherwise.
 */
export function parseBookmarksCommand(input: string): string | null {
  const trimmed = input.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Check if it's a bookmark command
  if (lowerTrimmed.startsWith("--bookmarks") || 
      lowerTrimmed.startsWith("-bookmarks") ||
      lowerTrimmed === "bookmarks" ||
      lowerTrimmed.startsWith("bookmarks ") ||
      lowerTrimmed.startsWith("show bookmarks") ||
      lowerTrimmed.startsWith("list bookmarks")) {
    return "BOOKMARKS_COMMAND"; // Return a marker, actual content will be fetched async
  }

  return null;
}

/**
 * Formats bookmarks as a code-tree structure
 * Returns markdown with a special marker that will be replaced with interactive HTML
 */
function formatBookmarksAsCodeTree(bookmarks: BookmarkInfo[]): string {
  if (bookmarks.length === 0) {
    return "No bookmarks found.";
  }

  // Return a simple markdown header with a special marker
  // The actual tree will be built as HTML after rendering
  return "## Bookmarks\n\n<BOOKMARKS_TREE_DATA>";
}

/**
 * Builds a tree structure from flat bookmark list
 */
function buildBookmarkTree(bookmarks: BookmarkInfo[]): Map<string, BookmarkInfo> {
  const tree = new Map<string, BookmarkInfo>();

  for (const bookmark of bookmarks) {
    if (bookmark.folderPath.length === 0) continue;

    const topLevel = bookmark.folderPath[0];
    if (!topLevel) continue;
    
    if (!tree.has(topLevel)) {
      tree.set(topLevel, {
        id: `folder-${topLevel}`,
        title: topLevel,
        folderPath: [topLevel],
        children: [],
      });
    }

    const folder = tree.get(topLevel);
    if (!folder) continue;
    if (!folder.children) {
      folder.children = [];
    }

    // If bookmark is directly in top-level folder
    if (bookmark.folderPath.length === 1 && bookmark.url) {
      folder.children!.push(bookmark);
    } else if (bookmark.folderPath.length > 1) {
      // Nested structure - find or create parent
      let current = folder;
      for (let i = 1; i < bookmark.folderPath.length; i++) {
        const segment = bookmark.folderPath[i];
        if (!segment) continue;
        
        if (!current.children) {
          current.children = [];
        }

        let child = current.children.find((c) => c.title === segment);
        if (!child) {
          child = {
            id: `folder-${bookmark.folderPath.slice(0, i + 1).join("/")}`,
            title: segment,
            folderPath: bookmark.folderPath.slice(0, i + 1),
            children: [],
          };
          current.children.push(child);
        }
        current = child;
      }

      if (!current.children) {
        current.children = [];
      }
      current.children.push(bookmark);
    }
  }

  return tree;
}

/**
 * Handles bookmark command execution
 * Returns formatted markdown response or error message
 */
export async function executeBookmarksCommand(
  input: string
): Promise<BookmarksCommandResult> {
  try {
    // Check permission first
    const hasPermission = await hasBookmarksPermission();
    
    if (!hasPermission) {
      return {
        success: false,
        message: `## Bookmarks Permission Required\n\n` +
          `To view your bookmarks, the extension needs permission to access them.\n\n` +
          `**To grant permission:**\n` +
          `1. Click the button below (if available)\n` +
          `2. Or manually enable it:\n` +
          `   - Go to \`chrome://extensions\`\n` +
          `   - Find "Docs Summarizer POC" and click **Details**\n` +
          `   - Under "Site access" or "Permissions", enable **Bookmarks**\n` +
          `   - Come back and try the command again\n\n` +
          `After granting permission, type \`--bookmarks\` again to view your bookmarks.`,
        needsPermission: true,
      };
    }

    // Parse folder path if specified (e.g., "--bookmarks technologies/Ruby" or "bookmarks technologies Ruby")
    const trimmed = input.trim();
    let folderPath: string[] | null = null;
    
    // Remove command prefix to get remaining text
    let remaining = trimmed;
    if (remaining.toLowerCase().startsWith("--bookmarks")) {
      remaining = remaining.slice(11).trim();
    } else if (remaining.toLowerCase().startsWith("-bookmarks")) {
      remaining = remaining.slice(10).trim();
    } else if (remaining.toLowerCase().startsWith("show bookmarks")) {
      remaining = remaining.slice(14).trim();
    } else if (remaining.toLowerCase().startsWith("list bookmarks")) {
      remaining = remaining.slice(14).trim();
    } else if (remaining.toLowerCase().startsWith("bookmarks")) {
      remaining = remaining.slice(9).trim();
    }
    
    if (remaining.length > 0) {
      // Try to parse as folder path (e.g., "technologies/Ruby" or "technologies Ruby")
      if (remaining.includes("/")) {
        folderPath = remaining.split("/").map(p => p.trim()).filter(p => p.length > 0);
      } else {
        folderPath = remaining.split(/\s+/).filter(p => p.length > 0);
      }
    }

    let bookmarks: BookmarkInfo[];
    
    if (folderPath && folderPath.length > 0) {
      // Get bookmarks from specific folder
      bookmarks = await getBookmarksByFolderPath(folderPath);
      
      if (bookmarks.length === 0) {
        return {
          success: true,
          message: `No bookmarks found in folder: \`${folderPath.join("/")}\`\n\n` +
            `Try \`--bookmarks\` to see all bookmarks, or check the folder path.`,
        };
      }
    } else {
      // Get all bookmarks
      bookmarks = await getBookmarksWithPaths();
    }

    const formatted = formatBookmarksAsCodeTree(bookmarks);
    
    return {
      success: true,
      message: formatted,
      bookmarks: bookmarks, // Pass bookmarks data for collapsible tree
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Error loading bookmarks: ${errorMessage}\n\n` +
        `If this is a permission error, try granting the bookmarks permission first.`,
      needsPermission: errorMessage.includes("permission") || errorMessage.includes("not available"),
    };
  }
}

/**
 * Attempts to request bookmarks permission
 * Returns true if granted, false otherwise
 */
export async function tryRequestBookmarksPermission(): Promise<boolean> {
  try {
    return await requestBookmarksPermission();
  } catch (error) {
    console.error("[Docs Summarizer] Error requesting bookmarks permission:", error);
    return false;
  }
}

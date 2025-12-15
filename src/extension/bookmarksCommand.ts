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
  folderPath?: string[]; // The folder path that was queried (for nested folder queries)
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

    // Parse folder path if specified (e.g., "--bookmarks technologies/Ruby" or "--bookmarks 'Data Analytics'")
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
      // Check if the remaining text contains "/" (nested path)
      // Always prioritize "/" splitting for nested paths, even if quoted
      if (remaining.includes("/")) {
        // Handle nested paths - split by "/" and trim each part
        // This handles both "Data Analytics/BigQuery" and "Data Analytics/BigQuery/Nested"
        // Also handles quoted nested paths like '"Data Analytics"/BigQuery' or '"Data Analytics/BigQuery"'
        let pathToSplit = remaining;
        
        // If the entire path is quoted, remove outer quotes first
        if ((remaining.startsWith('"') && remaining.endsWith('"')) ||
            (remaining.startsWith("'") && remaining.endsWith("'"))) {
          pathToSplit = remaining.slice(1, -1).trim();
        }
        
        // Split by "/" and trim each part, handling individual quoted segments
        folderPath = pathToSplit.split("/").map(p => {
          // Remove quotes from individual segments if present
          const trimmed = p.trim();
          if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
              (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.slice(1, -1).trim();
          }
          return trimmed;
        }).filter(p => p.length > 0);
      } else {
        // No "/" found - check if quoted (single folder with spaces)
        if ((remaining.startsWith('"') && remaining.endsWith('"')) ||
            (remaining.startsWith("'") && remaining.endsWith("'"))) {
          // Remove quotes and treat as single folder name
          const folderName = remaining.slice(1, -1).trim();
          if (folderName.length > 0) {
            folderPath = [folderName];
          }
        } else {
          // Try to match folder names intelligently
          // For multi-word folder names, treat the whole thing as a single folder name
          // This handles "Data Analytics" as one folder instead of ["Data", "Analytics"]
          const spaceSplit = remaining.split(/\s+/).filter(p => p.length > 0);
          
          if (spaceSplit.length > 1) {
            // Multiple words - treat as single folder name (handles spaces)
            folderPath = [remaining];
          } else {
            // Single word - use as-is
            folderPath = spaceSplit;
          }
        }
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
    
    const result: BookmarksCommandResult = {
      success: true,
      message: formatted,
      bookmarks: bookmarks, // Pass bookmarks data for collapsible tree
    };
    
    // Only include folderPath if it exists (for nested folder queries)
    if (folderPath && folderPath.length > 0) {
      result.folderPath = folderPath;
    }
    
    return result;
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

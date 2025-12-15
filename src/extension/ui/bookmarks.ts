// src/extension/ui/bookmarks.ts
// Bookmarks tree visualization UI

import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";
import {
  getBookmarksWithPaths,
  getFaviconUrl,
  hasBookmarksPermission,
  requestBookmarksPermission,
  type BookmarkInfo,
} from "../storage/bookmarks";

export interface BookmarksPanelElements {
  panel: HTMLDivElement;
  closeButton: HTMLButtonElement;
}

/**
 * Creates a bookmarks panel with tree structure visualization
 */
export function createBookmarksPanel(): BookmarksPanelElements {
  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "1000000",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
  } as CSSStyleDeclaration);

  const container = document.createElement("div");
  Object.assign(container.style, {
    background: CURSOR_COLORS.backgroundSecondary,
    borderRadius: CURSOR_BORDERS.radius.md,
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    width: "80%",
    maxWidth: "800px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  } as CSSStyleDeclaration);

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: CURSOR_SPACING.xl,
    borderBottom: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
  } as CSSStyleDeclaration);

  const title = document.createElement("div");
  title.textContent = "Bookmarks";
  Object.assign(title.style, {
    fontSize: CURSOR_TYPOGRAPHY.fontSize.lg,
    fontWeight: CURSOR_TYPOGRAPHY.fontWeight.semibold,
    color: CURSOR_COLORS.textPrimary,
  } as CSSStyleDeclaration);

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.title = "Close";
  Object.assign(closeButton.style, {
    background: "transparent",
    border: "none",
    color: CURSOR_COLORS.textPrimary,
    fontSize: "24px",
    cursor: "pointer",
    padding: "0",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
  } as CSSStyleDeclaration);

  closeButton.addEventListener("click", () => {
    panel.remove();
  });

  header.appendChild(title);
  header.appendChild(closeButton);

  // Content area
  const content = document.createElement("div");
  Object.assign(content.style, {
    padding: CURSOR_SPACING.xl,
    overflowY: "auto",
    flex: "1",
  } as CSSStyleDeclaration);

  // Loading state
  const loading = document.createElement("div");
  loading.textContent = "Loading bookmarks...";
  Object.assign(loading.style, {
    color: CURSOR_COLORS.textSecondary,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
  } as CSSStyleDeclaration);
  content.appendChild(loading);

  container.appendChild(header);
  container.appendChild(content);
  panel.appendChild(container);

  // Load and render bookmarks
  loadAndRenderBookmarks(content);

  // Close on ESC
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      panel.remove();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Close on overlay click
  panel.addEventListener("click", (e) => {
    if (e.target === panel) {
      panel.remove();
    }
  });

  return { panel, closeButton };
}

/**
 * Loads bookmarks and renders them in tree format
 */
async function loadAndRenderBookmarks(container: HTMLElement): Promise<void> {
  try {
    // Check if we have permission first
    const hasPermission = await hasBookmarksPermission();
    
    if (!hasPermission) {
      container.innerHTML = "";
      const permissionDiv = document.createElement("div");
      permissionDiv.innerHTML = `
        <div style="padding: ${CURSOR_SPACING.xl};">
          <div style="margin-bottom: ${CURSOR_SPACING.lg}; color: ${CURSOR_COLORS.textPrimary}; font-size: ${CURSOR_TYPOGRAPHY.fontSize.base}; text-align: center;">
            Bookmarks permission is required to view your bookmarks.
          </div>
          <div style="text-align: center; margin-bottom: ${CURSOR_SPACING.lg};">
            <button id="request-bookmarks-permission" style="
              padding: ${CURSOR_SPACING.md} ${CURSOR_SPACING.xl};
              font-size: ${CURSOR_TYPOGRAPHY.fontSize.base};
              border-radius: ${CURSOR_BORDERS.radius.md};
              border: ${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border};
              background: ${CURSOR_COLORS.buttonPrimary};
              color: ${CURSOR_COLORS.textPrimary};
              cursor: pointer;
              transition: background-color 0.2s;
              font-family: ${CURSOR_TYPOGRAPHY.fontFamily};
            ">
              Grant Bookmarks Permission
            </button>
          </div>
          <div style="
            padding: ${CURSOR_SPACING.md};
            background: ${CURSOR_COLORS.backgroundTertiary};
            border-radius: ${CURSOR_BORDERS.radius.sm};
            font-size: ${CURSOR_TYPOGRAPHY.fontSize.sm};
            color: ${CURSOR_COLORS.textSecondary};
            line-height: ${CURSOR_TYPOGRAPHY.lineHeight.relaxed};
          ">
            <strong>If the permission dialog doesn't appear:</strong><br>
            1. Go to <code style="background: ${CURSOR_COLORS.backgroundSecondary}; padding: 2px 4px; border-radius: 3px;">chrome://extensions</code><br>
            2. Find "Docs Summarizer POC" and click <strong>Details</strong><br>
            3. Under "Site access" or "Permissions", enable <strong>Bookmarks</strong><br>
            4. Come back and try again
          </div>
        </div>
      `;
      container.appendChild(permissionDiv);

      const requestBtn = document.getElementById("request-bookmarks-permission");
      if (requestBtn) {
        let isRequesting = false;
        requestBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (isRequesting) return; // Prevent double-clicks
          isRequesting = true;
          
          console.log("[Docs Summarizer] Permission request button clicked");
          
          // Update button text
          (requestBtn as HTMLElement).textContent = "Requesting...";
          (requestBtn as HTMLElement).style.opacity = "0.6";
          (requestBtn as HTMLElement).style.cursor = "not-allowed";
          
          try {
            // Small delay to ensure user gesture is captured
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const granted = await requestBookmarksPermission();
            console.log("[Docs Summarizer] Permission granted:", granted);
            
            if (granted) {
              // Reload bookmarks
              await loadAndRenderBookmarks(container);
            } else {
              // Remove any existing error messages
              const existingError = container.querySelector(".permission-error");
              if (existingError) existingError.remove();
              
              const errorMsg = document.createElement("div");
              errorMsg.className = "permission-error";
              errorMsg.innerHTML = `
                <div style="color: #ff6b6b; margin-bottom: ${CURSOR_SPACING.sm};">
                  Permission was denied or not granted.
                </div>
                <div style="color: ${CURSOR_COLORS.textSecondary}; font-size: ${CURSOR_TYPOGRAPHY.fontSize.sm};">
                  You can manually grant the permission by:<br>
                  1. Going to <code>chrome://extensions</code><br>
                  2. Finding this extension<br>
                  3. Clicking "Details"<br>
                  4. Enabling "Bookmarks" under Site access
                </div>
              `;
              Object.assign(errorMsg.style, {
                marginTop: CURSOR_SPACING.md,
                fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
                padding: CURSOR_SPACING.md,
                background: CURSOR_COLORS.backgroundTertiary,
                borderRadius: CURSOR_BORDERS.radius.sm,
                lineHeight: CURSOR_TYPOGRAPHY.lineHeight.relaxed,
              } as CSSStyleDeclaration);
              container.appendChild(errorMsg);
              
              // Reset button
              (requestBtn as HTMLElement).textContent = "Try Again";
              (requestBtn as HTMLElement).style.opacity = "1";
              (requestBtn as HTMLElement).style.cursor = "pointer";
            }
          } catch (error) {
            console.error("[Docs Summarizer] Error requesting permission:", error);
            const errorMsg = document.createElement("div");
            errorMsg.className = "permission-error";
            errorMsg.textContent = `Error: ${error instanceof Error ? error.message : String(error)}. Check the console for details.`;
            Object.assign(errorMsg.style, {
              color: "#ff6b6b",
              marginTop: CURSOR_SPACING.md,
              fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
              padding: CURSOR_SPACING.md,
            } as CSSStyleDeclaration);
            container.appendChild(errorMsg);
            
            // Reset button
            (requestBtn as HTMLElement).textContent = "Try Again";
            (requestBtn as HTMLElement).style.opacity = "1";
            (requestBtn as HTMLElement).style.cursor = "pointer";
          } finally {
            isRequesting = false;
          }
        });

        // Add hover effect
        requestBtn.addEventListener("mouseenter", () => {
          (requestBtn as HTMLElement).style.background = CURSOR_COLORS.buttonPrimaryHover;
        });
        requestBtn.addEventListener("mouseleave", () => {
          (requestBtn as HTMLElement).style.background = CURSOR_COLORS.buttonPrimary;
        });
      }
      return;
    }

    const bookmarks = await getBookmarksWithPaths();
    container.innerHTML = "";

    if (bookmarks.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No bookmarks found";
      Object.assign(empty.style, {
        color: CURSOR_COLORS.textSecondary,
        fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
      } as CSSStyleDeclaration);
      container.appendChild(empty);
      return;
    }

    // Group by top-level folder
    const tree = buildTree(bookmarks);
    renderTree(container, tree, 0);
  } catch (error) {
    container.innerHTML = "";
    const errorDiv = document.createElement("div");
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorDiv.textContent = `Error loading bookmarks: ${errorMessage}`;
    Object.assign(errorDiv.style, {
      color: "#ff6b6b",
      fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
      padding: CURSOR_SPACING.md,
      lineHeight: CURSOR_TYPOGRAPHY.lineHeight.relaxed,
    } as CSSStyleDeclaration);
    container.appendChild(errorDiv);

    // Check if it's a permission error and offer to request it
    if (errorMessage.includes("permission") || errorMessage.includes("not available")) {
      const requestBtn = document.createElement("button");
      requestBtn.textContent = "Request Bookmarks Permission";
      Object.assign(requestBtn.style, {
        marginTop: CURSOR_SPACING.md,
        padding: `${CURSOR_SPACING.sm} ${CURSOR_SPACING.md}`,
        fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
        borderRadius: CURSOR_BORDERS.radius.md,
        border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
        background: CURSOR_COLORS.buttonPrimary,
        color: CURSOR_COLORS.textPrimary,
        cursor: "pointer",
        fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
      } as CSSStyleDeclaration);
      
      let isRequesting = false;
      requestBtn.addEventListener("click", async () => {
        if (isRequesting) return;
        isRequesting = true;
        
        requestBtn.textContent = "Requesting...";
        (requestBtn as HTMLElement).style.opacity = "0.6";
        (requestBtn as HTMLElement).style.cursor = "not-allowed";
        
        try {
          const granted = await requestBookmarksPermission();
          if (granted) {
            await loadAndRenderBookmarks(container);
          } else {
            errorDiv.textContent = "Permission was denied. Please grant the bookmarks permission to use this feature.";
            requestBtn.textContent = "Request Bookmarks Permission";
            (requestBtn as HTMLElement).style.opacity = "1";
            (requestBtn as HTMLElement).style.cursor = "pointer";
          }
        } catch (error) {
          errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
          requestBtn.textContent = "Request Bookmarks Permission";
          (requestBtn as HTMLElement).style.opacity = "1";
          (requestBtn as HTMLElement).style.cursor = "pointer";
        } finally {
          isRequesting = false;
        }
      });
      
      container.appendChild(requestBtn);
    }
  }
}

/**
 * Builds a tree structure from flat bookmark list
 */
function buildTree(bookmarks: BookmarkInfo[]): Map<string, BookmarkInfo> {
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
 * Renders bookmark tree in code-style format
 */
function renderTree(
  container: HTMLElement,
  tree: Map<string, BookmarkInfo>,
  indent: number
): void {
  const entries = Array.from(tree.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [key, node] of entries) {
    const line = document.createElement("div");
    Object.assign(line.style, {
      display: "flex",
      alignItems: "center",
      padding: `${CURSOR_SPACING.xs} 0`,
      paddingLeft: `${indent * 16}px`,
      fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
      fontFamily: "monospace",
      color: CURSOR_COLORS.textPrimary,
      cursor: node.url ? "pointer" : "default",
    } as CSSStyleDeclaration);

    // Folder/File icon
    const icon = document.createElement("span");
    if (node.url) {
      // It's a bookmark (file)
      const favicon = document.createElement("img");
      favicon.src = getFaviconUrl(node.url);
      favicon.alt = "";
      Object.assign(favicon.style, {
        width: "16px",
        height: "16px",
        marginRight: CURSOR_SPACING.sm,
      } as CSSStyleDeclaration);
      icon.appendChild(favicon);
    } else {
      // It's a folder
      icon.textContent = "📁";
      Object.assign(icon.style, {
        marginRight: CURSOR_SPACING.sm,
      } as CSSStyleDeclaration);
    }

    // Name
    const name = document.createElement("span");
    name.textContent = node.title;
    if (node.url) {
      Object.assign(name.style, {
        color: "#93c5fd", // Link color
      } as CSSStyleDeclaration);
      const url = node.url; // Store in const for closure
      name.addEventListener("click", () => {
        window.open(url, "_blank");
      });
    }

    line.appendChild(icon);
    line.appendChild(name);

    // Show URL if it's a bookmark
    if (node.url) {
      const urlSpan = document.createElement("span");
      urlSpan.textContent = `  // ${node.url}`;
      Object.assign(urlSpan.style, {
        color: CURSOR_COLORS.textMuted,
        marginLeft: CURSOR_SPACING.sm,
        fontSize: CURSOR_TYPOGRAPHY.fontSize.xs,
      } as CSSStyleDeclaration);
      line.appendChild(urlSpan);
    }

    container.appendChild(line);

    // Render children
    if (node.children && node.children.length > 0) {
      const childrenMap = new Map<string, BookmarkInfo>();
      for (const child of node.children) {
        const childKey =
          child.folderPath[child.folderPath.length - 1] || child.title;
        childrenMap.set(childKey, child);
      }
      renderTree(container, childrenMap, indent + 1);
    }
  }
}

/**
 * Shows the bookmarks panel
 */
export function showBookmarksPanel(): void {
  const { panel } = createBookmarksPanel();
  document.body.appendChild(panel);
}

// src/extension/ui/bookmarks.ts
// Utilities for rendering bookmarks in messages

import type { BookmarkInfo } from "../storage/bookmarks";

/**
 * @deprecated This function is no longer used. Bookmarks are now rendered inline in messages.
 * Kept for backward compatibility with tests.
 */
export function createBookmarksPanel(): { panel: HTMLDivElement; closeButton: HTMLButtonElement } {
  const panel = document.createElement("div");
  const closeButton = document.createElement("button");
  return { panel, closeButton };
}

/**
 * @deprecated This function is no longer used. Bookmarks are now rendered inline in messages.
 * Kept for backward compatibility with tests.
 */
export function showBookmarksPanel(): void {
  // No-op: functionality moved to inline message rendering
}

/**
 * Builds a tree structure from bookmarks for collapsible rendering
 * @param bookmarks - List of bookmarks to build tree from
 * @param basePath - Optional base path representing the queried folder (shows folder itself, not just contents)
 */
function buildBookmarkTreeForCollapsible(bookmarks: BookmarkInfo[], basePath: string[] = []): Map<string, BookmarkInfo> {
  const tree = new Map<string, BookmarkInfo>();

  // If a basePath is provided, we want to show the folder itself as a collapsible node
  // All matching bookmarks become children of that folder
  if (basePath.length > 0) {
    const folderName = basePath[basePath.length - 1]!;
    const folderNode: BookmarkInfo = {
      id: `folder-${basePath.join("/")}`,
      title: folderName,
      folderPath: basePath,
      children: [],
    };

    // Process all bookmarks that match the base path
    for (const bookmark of bookmarks) {
      // Skip folder nodes (nodes without URLs)
      if (!bookmark.url) continue;
      
      // Check if the bookmark's path starts with the base path
      if (bookmark.folderPath.length >= basePath.length) {
        const matchesBase = basePath.every((seg, i) => bookmark.folderPath[i] === seg);
        if (matchesBase) {
          // Strip the base path to get relative path within the folder
          const relativePath = bookmark.folderPath.slice(basePath.length);
          
          // If relative path is empty, bookmark is directly in the queried folder
          if (relativePath.length === 0) {
            if (!folderNode.children) {
              folderNode.children = [];
            }
            folderNode.children.push(bookmark);
          } else {
            // Bookmark is in a subfolder - build nested structure
            // The relativePath represents the folder structure, but the bookmark itself
            // is directly in the folder at that path, so we need to create folders for all segments
            if (!folderNode.children) {
              folderNode.children = [];
            }
            
            let current = folderNode;
            // Create folders for all segments in the relative path
            for (let i = 0; i < relativePath.length; i++) {
              const segment = relativePath[i];
              if (!segment) continue;
              
              if (!current.children) {
                current.children = [];
              }

              // Look for existing folder node with matching title
              let child = current.children.find((c) => !c.url && c.title === segment);
              if (!child) {
                // Create new folder node
                const fullPath = [...basePath, ...relativePath.slice(0, i + 1)];
                child = {
                  id: `folder-${fullPath.join("/")}`,
                  title: segment,
                  folderPath: fullPath,
                  children: [],
                };
                current.children.push(child);
              }
              current = child;
            }
            
            // Add bookmark to the deepest folder (the folder it's directly in)
            if (!current.children) {
              current.children = [];
            }
            current.children.push(bookmark);
          }
        }
      }
    }

    // Add the folder node to the tree
    tree.set(folderName, folderNode);
  } else {
    // No base path - build tree from all bookmarks (original behavior)
    for (const bookmark of bookmarks) {
      // Skip folder nodes (nodes without URLs)
      if (!bookmark.url) continue;
      
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
      if (bookmark.folderPath.length === 1) {
        folder.children!.push(bookmark);
      } else if (bookmark.folderPath.length > 1) {
        // Nested structure - find or create parent folders
        let current = folder;
        for (let i = 1; i < bookmark.folderPath.length; i++) {
          const segment = bookmark.folderPath[i];
          if (!segment) continue;
          
          if (!current.children) {
            current.children = [];
          }

          // Look for existing folder node (no URL) with matching title
          let child = current.children.find((c) => !c.url && c.title === segment);
          if (!child) {
            // Create new folder node
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
        // Add the bookmark to the final folder
        current.children.push(bookmark);
      }
    }
  }

  return tree;
}

/**
 * Makes bookmarks tree collapsible by building HTML directly from bookmarks data
 * @param messageId - ID of the message to render bookmarks in
 * @param main - Main container element
 * @param bookmarks - List of bookmarks to render
 * @param basePath - Optional base path to strip from folder paths (for nested folder queries)
 */
export function makeBookmarksCollapsible(messageId: string, main: HTMLElement, bookmarks: BookmarkInfo[], basePath: string[] = []): void {
  const messageBubble = main.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
  if (!messageBubble) return;

  // Check if bookmarks tree has already been rendered (prevent duplicate rendering)
  const existingTree = messageBubble.querySelector(".bookmarks-tree-collapsible");
  if (existingTree) {
    return; // Already rendered, don't render again
  }

  // Find and remove the marker text
  const walker = document.createTreeWalker(
    messageBubble,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );

  let markerNode: Node | null = null;
  let node: Node | null;

  // Find the marker
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("BOOKMARKS_TREE_DATA")) {
      markerNode = node;
      break;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.textContent?.includes("BOOKMARKS_TREE_DATA")) {
        markerNode = element;
        break;
      }
    }
  }

  // Build tree structure from bookmarks, stripping the base path if provided
  const tree = buildBookmarkTreeForCollapsible(bookmarks, basePath);

  // Create collapsible tree container
  const treeContainer = document.createElement("div");
  treeContainer.className = "bookmarks-tree-collapsible";
  Object.assign(treeContainer.style, {
    fontFamily: "monospace",
    fontSize: "13px",
    lineHeight: "1.6",
    marginTop: "8px",
  } as CSSStyleDeclaration);

  // Render tree as collapsible HTML
  const renderNode = (node: BookmarkInfo, parentElement: HTMLElement, indent: number = 0, isExpanded: boolean = false): void => {
    if (!node.url) {
      // It's a folder
      const folderDiv = document.createElement("div");
      folderDiv.className = "bookmark-folder";
      Object.assign(folderDiv.style, {
        paddingLeft: `${indent * 16}px`,
        marginTop: "2px",
        cursor: "pointer",
        userSelect: "none",
      } as CSSStyleDeclaration);

      const toggle = document.createElement("span");
      toggle.textContent = isExpanded ? "▼ " : "▶ ";
      toggle.className = "folder-toggle";
      Object.assign(toggle.style, {
        display: "inline-block",
        width: "12px",
        color: "#9ca3af",
        fontSize: "10px",
        marginRight: "4px",
        transition: "transform 0.2s",
      } as CSSStyleDeclaration);

      const icon = document.createElement("span");
      icon.textContent = "📁 ";
      icon.style.marginRight = "4px";

      const name = document.createElement("span");
      name.textContent = node.title;
      name.style.color = "#e5e7eb";

      folderDiv.appendChild(toggle);
      folderDiv.appendChild(icon);
      folderDiv.appendChild(name);

      // Children container (expanded if isExpanded is true)
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "folder-children";
      childrenContainer.style.display = isExpanded ? "block" : "none";
      Object.assign(childrenContainer.style, {
        marginLeft: "16px",
      } as CSSStyleDeclaration);

      // Render children
      if (node.children) {
        // Sort children: folders first, then bookmarks
        const sorted = [...node.children].sort((a, b) => {
          if (a.url && !b.url) return 1; // Bookmarks after folders
          if (!a.url && b.url) return -1; // Folders before bookmarks
          return a.title.localeCompare(b.title);
        });
        
        for (const child of sorted) {
          renderNode(child, childrenContainer, 0, false); // Don't add extra indent, childrenContainer handles it
        }
      }

      folderDiv.appendChild(childrenContainer);
      parentElement.appendChild(folderDiv);

      // Toggle on click
      folderDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        const isExpanded = childrenContainer.style.display !== "none";
        childrenContainer.style.display = isExpanded ? "none" : "block";
        toggle.textContent = isExpanded ? "▶ " : "▼ ";
      });
    } else {
      // Bookmark link
      const linkDiv = document.createElement("div");
      linkDiv.className = "bookmark-link";
      Object.assign(linkDiv.style, {
        paddingLeft: `${indent * 16}px`,
        marginTop: "2px",
      } as CSSStyleDeclaration);

      const icon = document.createElement("span");
      icon.textContent = "🔗 ";
      icon.style.marginRight = "4px";

      const link = document.createElement("a");
      link.href = node.url || "#";
      link.textContent = node.title;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      Object.assign(link.style, {
        color: "#93c5fd",
        textDecoration: "underline",
        cursor: "pointer",
      } as CSSStyleDeclaration);

      linkDiv.appendChild(icon);
      linkDiv.appendChild(link);
      parentElement.appendChild(linkDiv);
    }
  };

        // Render all root nodes (sorted)
        // If basePath is provided, we have a single root folder that should be expanded by default
        const entries = Array.from(tree.entries()).sort((a, b) =>
          a[0].localeCompare(b[0])
        );
        
        // If basePath is provided, expand the root folder by default (it's the queried folder)
        const shouldExpandRoot = basePath.length > 0;
        
        for (const [, node] of entries) {
          renderNode(node, treeContainer, 0, shouldExpandRoot);
        }

  // Replace marker with collapsible tree
  if (markerNode && markerNode.parentNode) {
    const parent = markerNode.parentNode;
    
    // Remove the marker node
    if (markerNode.nodeType === Node.TEXT_NODE) {
      // If it's a text node, replace its content
      const textNode = markerNode as Text;
      const parentElement = textNode.parentElement;
      if (parentElement) {
        textNode.remove();
        parentElement.appendChild(treeContainer);
      }
    } else {
      // If it's an element, replace it
      parent.replaceChild(treeContainer, markerNode);
    }
  } else {
    // Fallback: append after heading
    const heading = messageBubble.querySelector("h2");
    if (heading && heading.parentElement) {
      heading.parentElement.insertBefore(treeContainer, heading.nextSibling);
    } else {
      messageBubble.appendChild(treeContainer);
    }
  }
}

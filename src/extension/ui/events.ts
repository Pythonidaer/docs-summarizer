// src/extension/ui/events.ts
import { chatWithOpenAI, summarizeWithOpenAI } from "../openai";
import { renderMessages } from "./messages";
import type { Message, ModelSettings } from "../types";
import type { PromptVoiceId } from "../prompts/voices";
import { extractPageTextFromDoc } from "../content-script";
import { extractPageStructure, serializePageStructureForModel } from "../pageStructure";
import { setPageTextForLinks } from "../pageText";
import { showAlert } from "./modal";
import { parseHelpCommand } from "../help";
import { parseStyleCommands } from "../styleCommands";
import { parseBookmarksCommand, executeBookmarksCommand, tryRequestBookmarksPermission } from "../bookmarksCommand";
import type { BookmarkInfo } from "../storage/bookmarks";

/**
 * Makes bookmarks tree collapsible by building HTML directly from bookmarks data
 */
function makeBookmarksCollapsible(messageId: string, main: HTMLElement, bookmarks: BookmarkInfo[]): void {
  const messageBubble = main.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
  if (!messageBubble) return;

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

  // Build tree structure from bookmarks
  const tree = buildBookmarkTreeForCollapsible(bookmarks);

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
  const renderNode = (node: BookmarkInfo, parentElement: HTMLElement, indent: number = 0): void => {
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
      toggle.textContent = "▶ ";
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

      // Children container (collapsed by default)
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "folder-children";
      childrenContainer.style.display = "none";
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
          renderNode(child, childrenContainer, 0); // Don't add extra indent, childrenContainer handles it
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
  const entries = Array.from(tree.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  
  for (const [, node] of entries) {
    renderNode(node, treeContainer, 0);
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

/**
 * Builds a tree structure from bookmarks for collapsible rendering
 */
function buildBookmarkTreeForCollapsible(bookmarks: BookmarkInfo[]): Map<string, BookmarkInfo> {
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

        let child = current.children.find((c) => c.title === segment && !c.url);
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

export interface WireDrawerEventsArgs {
  root: HTMLDivElement;
  drawer: HTMLDivElement;
  handle: HTMLDivElement;
  closeButton: HTMLButtonElement;
  chatInput: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  summarizeBtn: HTMLButtonElement;
  main: HTMLDivElement;
  pageText: string;
  pageStructureSummary: string;
  messages: Message[];
  setDrawerOpen: (
    root: HTMLDivElement,
    drawer: HTMLDivElement,
    handle: HTMLDivElement,
    isOpen: boolean
  ) => void;
  getUseCustomInstructions: () => boolean;
  getCustomInstructions: () => string;
  getPromptVoiceId: () => PromptVoiceId;
  getModelSettings: () => ModelSettings;
}

export function wireDrawerEvents({
  root,
  drawer,
  handle,
  closeButton,
  chatInput,
  sendBtn,
  summarizeBtn,
  main,
  pageText,
  messages,
  pageStructureSummary,
  setDrawerOpen,
  getUseCustomInstructions,
  getCustomInstructions,
  getPromptVoiceId,
  getModelSettings,
}: WireDrawerEventsArgs): void {
  let isOpen = false;

  const handleSend = async () => {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Check for bookmark commands first (more specific, async but no API call)
    const bookmarkCommand = parseBookmarksCommand(userText);
    if (bookmarkCommand) {
      messages.push({
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
      });
      
      // Add loading message
      const loadingId = `loading-${Date.now()}`;
      messages.push({
        id: loadingId,
        role: "assistant",
        text: "",
        loading: true,
      });
      renderMessages(main, messages);
      chatInput.value = "";

      try {
        sendBtn.disabled = true;
        sendBtn.style.opacity = "0.5";

        const result = await executeBookmarksCommand(userText);
        
        // Remove loading message
        const loadingIndex = messages.findIndex(m => m.id === loadingId);
        if (loadingIndex !== -1) {
          messages.splice(loadingIndex, 1);
        }

        // Add response message
        const messageId = `assistant-${Date.now()}`;
        messages.push({
          id: messageId,
          role: "assistant",
          text: result.message,
          voiceId: getPromptVoiceId(),
        });

        renderMessages(main, messages);

        // Make bookmarks collapsible if this is a bookmarks message
        if (result.success && result.bookmarks) {
          makeBookmarksCollapsible(messageId, main, result.bookmarks);
        }

        // If permission is needed, add a button after rendering
        if (result.needsPermission) {
          // Find the message bubble we just rendered
          const targetBubble = main.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
          
          if (targetBubble) {
            const buttonContainer = document.createElement("div");
            Object.assign(buttonContainer.style, {
              marginTop: "12px",
            } as CSSStyleDeclaration);
            
            const btn = document.createElement("button");
            btn.textContent = "Grant Bookmarks Permission";
            btn.id = `request-bookmarks-permission-btn-${messageId}`;
            Object.assign(btn.style, {
              padding: "8px 16px",
              fontSize: "14px",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(59, 130, 246, 0.2)",
              color: "#93c5fd",
              cursor: "pointer",
              transition: "background-color 0.2s",
              fontFamily: "inherit",
            } as CSSStyleDeclaration);
            
            let isRequesting = false;
            btn.addEventListener("click", async () => {
              if (isRequesting) return;
              isRequesting = true;
              
              btn.textContent = "Requesting...";
              btn.style.opacity = "0.6";
              btn.style.cursor = "not-allowed";
              
              const granted = await tryRequestBookmarksPermission();
              
              if (granted) {
                btn.textContent = "Permission Granted! Try --bookmarks again.";
                btn.style.background = "rgba(34, 197, 94, 0.2)";
                btn.style.color = "#86efac";
              } else {
                btn.textContent = "Permission Denied. See instructions above.";
                btn.style.background = "rgba(239, 68, 68, 0.2)";
                btn.style.color = "#fca5a5";
              }
              
              isRequesting = false;
            });
            
            buttonContainer.appendChild(btn);
            targetBubble.appendChild(buttonContainer);
          }
        }
      } catch (error) {
        // Remove loading message
        const loadingIndex = messages.findIndex(m => m.id === loadingId);
        if (loadingIndex !== -1) {
          messages.splice(loadingIndex, 1);
        }

        messages.push({
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          voiceId: getPromptVoiceId(),
        });

        renderMessages(main, messages);
      } finally {
        sendBtn.disabled = false;
        sendBtn.style.opacity = "1";
      }
      
      return; // Don't call OpenAI for bookmark commands
    }

    // Check for help commands (deterministic, no API call)
    const helpResponse = parseHelpCommand(userText);
    if (helpResponse) {
      messages.push({
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
      });
      
      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: helpResponse,
        voiceId: getPromptVoiceId(),
      });
      
      renderMessages(main, messages);
      chatInput.value = "";
      return; // Don't call OpenAI for help commands
    }

    // Parse style commands from user input
    const { text: cleanText, styleCommands } = parseStyleCommands(userText);

    messages.push({
      id: `user-${Date.now()}`,
      role: "user",
      text: userText, // Store original text with commands for display
    });
    
    // Add loading message immediately
    const loadingId = `loading-${Date.now()}`;
    messages.push({
      id: loadingId,
      role: "assistant",
      text: "",
      loading: true,
    });
    renderMessages(main, messages);
    chatInput.value = "";

    try {
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.5";

      // Update the last message (user message) with cleaned text for API call if commands were parsed
      const lastUserMessage = messages.filter(m => !m.loading && m.role === "user").pop();
      let originalText: string | undefined;
      if (lastUserMessage && cleanText !== userText) {
        // Temporarily update the message text for the API call
        originalText = lastUserMessage.text;
        lastUserMessage.text = cleanText;
      }

      const result = await chatWithOpenAI(
        pageText,
        messages.filter(m => !m.loading), // Exclude loading message from API call
        getUseCustomInstructions(),
        getCustomInstructions(),
        getPromptVoiceId(),
        getModelSettings(),
        styleCommands.length > 0 ? styleCommands : undefined
      );
      
      // Restore original text for display if we modified it
      if (lastUserMessage && originalText !== undefined) {
        lastUserMessage.text = originalText;
      }

      // Remove loading message and add actual response
      const loadingIndex = messages.findIndex(m => m.id === loadingId);
      if (loadingIndex !== -1) {
        messages.splice(loadingIndex, 1);
      }
      
      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: result.text,
        responseTime: result.responseTime,
        tokenUsage: result.tokenUsage,
        voiceId: getPromptVoiceId(), // Include voiceId for metadata display
      });
      renderMessages(main, messages);

      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    } catch (err: any) {
      console.error("[Docs Summarizer] Chat error:", err);
      
      // Remove loading message on error
      const loadingIndex = messages.findIndex(m => m.id === loadingId);
      if (loadingIndex !== -1) {
        messages.splice(loadingIndex, 1);
        renderMessages(main, messages);
      }
      
      // Check if this is a content_filter error and show user-friendly message
      const errorMessage = err?.message ?? String(err);
      const isContentFilter = errorMessage.includes("content_filter") || 
                             errorMessage.includes('"reason":"content_filter"');
      
      if (isContentFilter) {
        await showAlert(
          "OpenAI's safety system blocked this response because it detected potentially sensitive content.\n\n" +
          "Try rephrasing your prompt with different wording, or break your request into smaller questions.\n\n" +
          "Hint: Sometimes refreshing the page or summarizing the content first can help. OpenAI's content filter isn't entirely consistent.",
          "Content Filtered"
        );
      } else {
        await showAlert(`Docs Summarizer chat error: ${errorMessage}`, "Chat Error");
      }
      
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  };

  sendBtn.addEventListener("click", () => {
    void handleSend();
  });

  chatInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  });

  const toggle = () => {
    isOpen = !isOpen;
    setDrawerOpen(root, drawer, handle, isOpen);
  };

  handle.addEventListener("click", toggle);

  closeButton.addEventListener("click", () => {
    if (!isOpen) return;
    isOpen = false;
    setDrawerOpen(root, drawer, handle, isOpen);
  });

  summarizeBtn.addEventListener("click", async () => {
    // Add user message to show the summarize action in the chat
    const userMessageId = `user-${Date.now()}`;
    messages.push({
      id: userMessageId,
      role: "user",
      text: "Summarize",
    });
    
    // Add loading message immediately
    const loadingId = `loading-${Date.now()}`;
    messages.push({
      id: loadingId,
      role: "assistant",
      text: "",
      loading: true,
    });
    renderMessages(main, messages);

    try {
      // Re-extract text if empty (handles SPAs that load content dynamically)
      let currentPageText = pageText;
      let currentPageStructureSummary = pageStructureSummary;
      
      if (!currentPageText || currentPageText.trim().length === 0) {
      summarizeBtn.disabled = true;
      const previousLabel = summarizeBtn.textContent;
      summarizeBtn.textContent = "Loading…";
        
        // Try extracting immediately
        currentPageText = extractPageTextFromDoc(document);
        
        // If still empty, wait a bit and retry (for SPAs that load content asynchronously)
        if (!currentPageText || currentPageText.trim().length === 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          currentPageText = extractPageTextFromDoc(document);
        }
        
        // If still empty after retry, wait a bit more
        if (!currentPageText || currentPageText.trim().length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait another 1s
          currentPageText = extractPageTextFromDoc(document);
        }
        
        // Re-extract structure if we got new text
        if (currentPageText && currentPageText.trim().length > 0) {
          const structure = extractPageStructure(document);
          currentPageStructureSummary = serializePageStructureForModel(structure);
          setPageTextForLinks(currentPageText);
        }
        
        if (!currentPageText || currentPageText.trim().length === 0) {
          // Remove user message and loading message since summary failed
          const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
          if (userMessageIndex !== -1) {
            messages.splice(userMessageIndex, 1);
          }
          const loadingIndex = messages.findIndex(m => m.id === loadingId);
          if (loadingIndex !== -1) {
            messages.splice(loadingIndex, 1);
          }
          renderMessages(main, messages);
          
          await showAlert(
            "Docs Summarizer: No text found on this page.\n\n" +
            "This may be because:\n" +
            "• The page content hasn't loaded yet (try waiting a moment and clicking again)\n" +
            "• The page uses a format we can't extract text from\n" +
            "• The page is empty or contains only images/media",
            "No Text Found"
          );
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = "Summarize"; // Always restore to this text
            return;
          }
          
          summarizeBtn.textContent = "Summarizing…";
        }

        summarizeBtn.disabled = true;
        summarizeBtn.textContent = "Summarizing…";

      const result = await summarizeWithOpenAI(
        currentPageText,
        currentPageStructureSummary,
        false, // Don't use custom instructions for summarize button
        "", // No custom instructions for summarize
        getPromptVoiceId(),
        getModelSettings()
      );

      // Remove loading message and add actual response
      const loadingIndex = messages.findIndex(m => m.id === loadingId);
      if (loadingIndex !== -1) {
        messages.splice(loadingIndex, 1);
      }

      const voiceId = getPromptVoiceId();
      messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: result.text,
        voiceId, // Include voiceId so it can be displayed in the message
        responseTime: result.responseTime,
        tokenUsage: result.tokenUsage ?? null, // Keep null as null, convert undefined to null
      });
      renderMessages(main, messages);

      summarizeBtn.textContent = "Summarize"; // Always restore to this text
      summarizeBtn.disabled = false;
    } catch (err: any) {
      // Remove loading message on error
      const loadingIndex = messages.findIndex(m => m.id === loadingId);
      if (loadingIndex !== -1) {
        messages.splice(loadingIndex, 1);
      }
      
      // Remove user message since summary failed
      const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
      if (userMessageIndex !== -1) {
        messages.splice(userMessageIndex, 1);
      }
      
      renderMessages(main, messages);
      
      console.error("[Docs Summarizer] Error:", err);
      
      // Check if this is a content_filter error and show user-friendly message
      const errorMessage = err?.message ?? String(err);
      const isContentFilter = errorMessage.includes("content_filter") || 
                             errorMessage.includes('"reason":"content_filter"');
      
      if (isContentFilter) {
        await showAlert(
          "OpenAI's safety system blocked this response because it detected potentially sensitive content.\n\n" +
          "Try rephrasing your prompt with different wording, or break your request into smaller questions.\n\n" +
          "Hint: Sometimes refreshing the page or summarizing the content first can help. OpenAI's content filter isn't entirely consistent.",
          "Content Filtered"
        );
      } else {
        await showAlert(`Docs Summarizer error: ${errorMessage}`, "Error");
      }
      
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = "Summarize"; // Always restore to this text
    }
  });

  setDrawerOpen(root, drawer, handle, false);
}

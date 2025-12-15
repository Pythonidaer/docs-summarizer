import type { Message } from "../types";
import { renderMarkdownInto } from "../markdown";
import { PROMPT_VOICES } from "../prompts/voices";
import { exportMessageAsMarkdown, exportMessageAsPDF } from "../export";
import { makeBookmarksCollapsible } from "./bookmarks";

/**
 * Creates a loading indicator with three pulsing circles (like ChatGPT)
 */
function createLoadingIndicator(): HTMLElement {
    const container = document.createElement("div");
    container.className = "docs-summarizer-loading";
    Object.assign(container.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 0",
    } as CSSStyleDeclaration);

    // Create three pulsing circles
    for (let i = 0; i < 3; i++) {
        const circle = document.createElement("div");
        circle.className = "docs-summarizer-loading-dot";
        Object.assign(circle.style, {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#cccccc", // Match assistant text color
            animation: `docs-summarizer-pulse 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`, // Sequential animation
        } as CSSStyleDeclaration);
        container.appendChild(circle);
    }

    return container;
}

export function renderMessages(main: HTMLElement, msgs: Message[]): void {
    main.innerHTML = "";

    if (msgs.length === 0) {
        const placeholder = document.createElement("div");
        Object.assign(placeholder.style, {
            opacity: "0.7",
            fontSize: "13px"
        } as CSSStyleDeclaration);

        const p = document.createElement("p");
        p.textContent = `Click "Summarize" or send a question to get started. Type \`--help\` to see all commands.`;
        placeholder.appendChild(p);

        main.appendChild(placeholder);
        return;
    }

    for (const msg of msgs) {
        const row = document.createElement("div");
        Object.assign(row.style, {
            marginBottom: "8px",
            display: "flex",
            width: "100%",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
        } as CSSStyleDeclaration);

        const bubble = document.createElement("div");
        bubble.setAttribute("data-message-id", msg.id);
        const isLoading = msg.role === "assistant" && msg.loading === true;
        Object.assign(bubble.style, {
            maxWidth: "80%",
            padding: "8px",
            paddingBottom: msg.role === "assistant" && (msg.responseTime !== undefined || msg.tokenUsage) ? "48px" : "8px", // Extra padding for assistant messages with metadata
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
            lineHeight: "1.4",
            background: isLoading 
                ? "transparent" // Transparent background for loading messages
                : msg.role === "user" ? "#4a5568" : "#1d1d1d", // Muted grey/blue for user messages
            color: "#f5f5f5",
            border: isLoading 
                ? "none" // No border for loading messages
                : msg.role === "user"
                    ? "1px solid rgba(255,255,255,0.15)"
                    : "1px solid rgba(255,255,255,0.06)",
            fontSize: "13px",
            position: "relative" // For absolute positioning of metadata
        } as CSSStyleDeclaration);

        if (msg.role === "assistant") {
            // Check if this is a loading message
            if (msg.loading === true) {
                // Render loading indicator instead of text
                const loadingIndicator = createLoadingIndicator();
                bubble.appendChild(loadingIndicator);
            } else {
                // Render assistant messages with simple markdown formatting
                renderMarkdownInto(bubble, msg.text);
                
                // If this message has bookmarks data, make it collapsible
                // This ensures bookmarks persist when messages are re-rendered
                if (msg.bookmarks && msg.text.includes("BOOKMARKS_TREE_DATA")) {
                  // Use setTimeout to ensure DOM is fully rendered before processing
                  setTimeout(() => {
                    makeBookmarksCollapsible(msg.id, main, msg.bookmarks!, msg.bookmarksFolderPath || []);
                  }, 0);
                }
            }

            // Add metadata footer (response time, tokens, cost) in bottom-right
            // Don't show metadata for loading messages
            if (!msg.loading && (msg.responseTime !== undefined || msg.tokenUsage)) {
                const metadataContainer = document.createElement("div");
                Object.assign(metadataContainer.style, {
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    left: "8px", // Extend to left edge for full-width separator
                    fontSize: "10px",
                    color: "#f5f5f5",
                    whiteSpace: "nowrap",
                    paddingTop: "12px",
                    marginTop: "16px", // More space from content above
                    borderTop: "1px solid rgba(255,255,255,0.15)", // More visible border
                } as CSSStyleDeclaration);

                const metadata = document.createElement("span");
                Object.assign(metadata.style, {
                    cursor: msg.tokenUsage ? "help" : "default",
                    opacity: "0.7", // Apply opacity only to the text, not the container
                } as CSSStyleDeclaration);

                const parts: string[] = [];
                
                // Add voice label first if present
                if (msg.voiceId) {
                    const voice = PROMPT_VOICES.find(v => v.id === msg.voiceId);
                    const voiceLabel = voice?.label || msg.voiceId;
                    parts.push(voiceLabel);
                }
                
                if (msg.responseTime !== undefined) {
                    parts.push(`Response time: ${msg.responseTime.toFixed(1)}s`);
                }

                if (msg.tokenUsage) {
                    // Format cost with appropriate precision
                    const costStr = msg.tokenUsage.cost < 0.0001 
                        ? `$${msg.tokenUsage.cost.toFixed(6)}`
                        : `$${msg.tokenUsage.cost.toFixed(4)}`;
                    parts.push(`Tokens used: ${msg.tokenUsage.totalTokens.toLocaleString()} (${costStr})`);
                    
                    // Create custom tooltip that appears above
                    const tooltip = document.createElement("div");
                    Object.assign(tooltip.style, {
                        position: "absolute",
                        bottom: "100%",
                        right: "0",
                        marginBottom: "4px", // Closer to metadata
                        padding: "6px 8px",
                        fontSize: "11px",
                        background: "#1a1a1a",
                        color: "#f5f5f5",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        whiteSpace: "pre-line",
                        zIndex: "1000",
                        opacity: "0",
                        pointerEvents: "none",
                        transition: "opacity 0.2s",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    } as CSSStyleDeclaration);
                    
                    // Only show input and output breakdown (total and cost are already visible)
                    tooltip.textContent = `Input: ${msg.tokenUsage.inputTokens.toLocaleString()} tokens\nOutput: ${msg.tokenUsage.outputTokens.toLocaleString()} tokens`;
                    
                    metadataContainer.appendChild(tooltip);
                    
                    // Show tooltip on hover (fully opaque for readability)
                    metadata.addEventListener("mouseenter", () => {
                        tooltip.style.opacity = "1"; // Fully opaque when visible
                    });
                    
                    metadata.addEventListener("mouseleave", () => {
                        tooltip.style.opacity = "0";
                    });
                }

                // Create a flex container for metadata and export button (inline)
                const metadataRow = document.createElement("div");
                Object.assign(metadataRow.style, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "8px",
                } as CSSStyleDeclaration);

                // Join parts with separator, but style voice label differently if present
                if (msg.voiceId && parts.length > 0) {
                    const voiceLabel = parts[0];
                    const rest = parts.slice(1);
                    metadata.innerHTML = `<span style="font-weight: 500;">${voiceLabel}</span>${rest.length > 0 ? " • " + rest.join(" • ") : ""}`;
                } else {
                    metadata.textContent = parts.join(" • ");
                }
                // Align metadata text to the right
                Object.assign(metadata.style, {
                    textAlign: "right",
                    flex: "0 0 auto",
                } as CSSStyleDeclaration);
                metadataRow.appendChild(metadata);

                // Create download icon button (using SVG) - smaller and inline
                const exportBtn = document.createElement("button");
                exportBtn.title = "Export as Markdown or PDF";
                Object.assign(exportBtn.style, {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "3px",
                    padding: "3px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: "0.7",
                    transition: "all 0.2s",
                    flex: "0 0 auto",
                    width: "20px",
                    height: "20px",
                    marginLeft: "4px",
                } as CSSStyleDeclaration);

                // SVG download icon - smaller
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", "14");
                svg.setAttribute("height", "14");
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "currentColor");
                svg.setAttribute("stroke-width", "2");
                svg.setAttribute("stroke-linecap", "round");
                svg.setAttribute("stroke-linejoin", "round");
                svg.style.color = "#f5f5f5";

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3");
                svg.appendChild(path);
                exportBtn.appendChild(svg);

                // Hover effect
                exportBtn.addEventListener("mouseenter", () => {
                    exportBtn.style.opacity = "1";
                    exportBtn.style.background = "rgba(255,255,255,0.1)";
                    exportBtn.style.borderColor = "rgba(255,255,255,0.2)";
                });
                exportBtn.addEventListener("mouseleave", () => {
                    exportBtn.style.opacity = "0.7";
                    exportBtn.style.background = "rgba(255,255,255,0.05)";
                    exportBtn.style.borderColor = "rgba(255,255,255,0.1)";
                });

                // Create dropdown menu for export options
                let dropdown: HTMLDivElement | null = null;
                const showDropdown = () => {
                    // Remove existing dropdown if any
                    if (dropdown) {
                        dropdown.remove();
                        dropdown = null;
                        return;
                    }

                    dropdown = document.createElement("div");
                    Object.assign(dropdown.style, {
                        position: "absolute",
                        bottom: "100%",
                        right: "0",
                        marginBottom: "6px",
                        background: "#1a1a1a",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "6px",
                        padding: "4px",
                        zIndex: "1001",
                        minWidth: "140px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                    } as CSSStyleDeclaration);

                    // Common button styling
                    const createExportButton = (text: string, onClick: () => void) => {
                        const btn = document.createElement("button");
                        btn.textContent = text;
                        Object.assign(btn.style, {
                            width: "100%",
                            padding: "8px 10px",
                            background: "transparent",
                            border: "none",
                            color: "#f5f5f5",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "12px",
                            borderRadius: "4px",
                            transition: "background 0.15s",
                        } as CSSStyleDeclaration);
                        btn.addEventListener("mouseenter", () => {
                            btn.style.background = "rgba(255,255,255,0.12)";
                        });
                        btn.addEventListener("mouseleave", () => {
                            btn.style.background = "transparent";
                        });
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            onClick();
                            if (dropdown) {
                                dropdown.remove();
                                dropdown = null;
                            }
                        });
                        return btn;
                    };

                    const markdownOption = createExportButton("Export as Markdown", () => {
                        exportMessageAsMarkdown(msg);
                    });

                    const pdfOption = createExportButton("Export as PDF", () => {
                        exportMessageAsPDF(msg);
                    });

                    dropdown.appendChild(markdownOption);
                    dropdown.appendChild(pdfOption);
                    metadataRow.appendChild(dropdown);

                    // Close dropdown when clicking outside
                    const closeOnOutsideClick = (e: MouseEvent) => {
                        if (dropdown && !dropdown.contains(e.target as Node) && !exportBtn.contains(e.target as Node)) {
                            dropdown.remove();
                            dropdown = null;
                            document.removeEventListener("click", closeOnOutsideClick);
                        }
                    };
                    setTimeout(() => {
                        document.addEventListener("click", closeOnOutsideClick);
                    }, 0);
                };

                exportBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    showDropdown();
                });

                metadataRow.appendChild(exportBtn);
                metadataContainer.appendChild(metadataRow);
                bubble.appendChild(metadataContainer);
            }
        } else {
            // User messages stay as plain text
            bubble.textContent = msg.text;
        }

        row.appendChild(bubble);
        main.appendChild(row);
    }

    main.scrollTop = main.scrollHeight;
}
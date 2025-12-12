// src/extension/export.ts
import type { Message } from "./types";
import { PROMPT_VOICES } from "./prompts/voices";

/**
 * Exports a single assistant message as a Markdown file.
 */
export function exportMessageAsMarkdown(msg: Message): void {
  if (msg.role !== "assistant") {
    console.warn("[Docs Summarizer] Can only export assistant messages");
    return;
  }

  // Build the markdown content
  let content = "";

  // Add voice label if present
  if (msg.voiceId) {
    const voice = PROMPT_VOICES.find((v) => v.id === msg.voiceId);
    const voiceLabel = voice?.label || msg.voiceId;
    content += `# Summary (${voiceLabel})\n\n`;
  } else {
    content += `# Summary\n\n`;
  }

  // Add the main content
  content += msg.text;

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const voiceSuffix = msg.voiceId
    ? `-${msg.voiceId.replace(/_/g, "-")}`
    : "";
  const filename = `docs-summary${voiceSuffix}-${timestamp}.md`;

  // Create blob and download
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts markdown text to HTML, similar to how renderMarkdownInto works.
 * This ensures PDF output matches the rendered markdown in the UI.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  const flushCodeBlock = () => {
    if (inCodeBlock && codeBlockContent.length > 0) {
      const code = escapeHtml(codeBlockContent.join("\n"));
      html += `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 11pt; line-height: 1.5;"><code>${code}</code></pre>`;
      codeBlockContent = [];
      inCodeBlock = false;
    }
  };

  const flushList = () => {
    if (inList) {
      html += listType === "ul" ? "</ul>" : "</ol>";
      inList = false;
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const trimmed = line.trim();

    // Fenced code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Horizontal rules (--- or ----)
    if (/^-{3,}$/.test(trimmed)) {
      flushList();
      html += '<hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;" />';
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const [, hashes, content] = headingMatch;
      const level = (hashes || "").length;
      const contentText = content || "";
      const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const marginTop = level === 1 ? "20px" : level === 2 ? "16px" : "12px";
      const fontSize = level === 1 ? "18pt" : level === 2 ? "16pt" : "14pt";
      html += `<${tag} style="margin-top: ${marginTop}; margin-bottom: 8px; font-size: ${fontSize}; font-weight: 600;">${escapeHtml(contentText)}</${tag}>`;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s{0,3}[-*]\s+(.*)$/);
    if (ulMatch) {
      const [, itemText] = ulMatch;
      const itemTextSafe = itemText || "";
      if (!inList || listType !== "ul") {
        flushList();
        html += '<ul style="margin: 4px 0 4px 20px; padding-left: 20px;">';
        inList = true;
        listType = "ul";
      }
      html += `<li style="margin-bottom: 2px;">${processInlineMarkdown(itemTextSafe)}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s{0,3}(\d+)[\.\)]\s+(.*)$/);
    if (olMatch) {
      const [, , itemText] = olMatch;
      const itemTextSafe = itemText || "";
      if (!inList || listType !== "ol") {
        flushList();
        html += '<ol style="margin: 4px 0 4px 20px; padding-left: 20px;">';
        inList = true;
        listType = "ol";
      }
      html += `<li style="margin-bottom: 2px;">${processInlineMarkdown(itemTextSafe)}</li>`;
      continue;
    }

    // Regular paragraph
    flushList();
    html += `<p style="margin: 4px 0; font-size: 12pt; line-height: 1.5;">${processInlineMarkdown(trimmed)}</p>`;
  }

  flushCodeBlock();
  flushList();

  return html;
}

/**
 * Processes inline markdown (bold, italic, code, links).
 */
function processInlineMarkdown(text: string): string {
  // Escape HTML first
  let html = escapeHtml(text);

  // Convert bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic *text* (but not if it's part of **text**)
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  // Convert inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f5f5f5; padding: 2px 4px; border-radius: 2px; font-family: \'SF Mono\', Monaco, monospace; font-size: 10.5pt;">$1</code>');

  // Convert links [text](url) - remove scroll links, keep external links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    if (href.startsWith("#scroll:") || href.startsWith("scroll:")) {
      // Remove scroll links, just show the label
      return escapeHtml(label);
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return `<a href="${escapeHtml(href)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(label)}</a>`;
    }
    return escapeHtml(label);
  });

  return html;
}

/**
 * Exports a single assistant message as a PDF.
 * Uses the browser's print API to generate PDF.
 */
export function exportMessageAsPDF(msg: Message): void {
  if (msg.role !== "assistant") {
    console.warn("[Docs Summarizer] Can only export assistant messages");
    return;
  }

  // Build HTML content
  let html = "";

  // Add voice label if present
  if (msg.voiceId) {
    const voice = PROMPT_VOICES.find((v) => v.id === msg.voiceId);
    const voiceLabel = voice?.label || msg.voiceId;
    html += `<h1 style="margin-top: 0; margin-bottom: 16px; font-size: 20pt; font-weight: 600;">Summary (${escapeHtml(voiceLabel)})</h1>`;
  } else {
    html += `<h1 style="margin-top: 0; margin-bottom: 16px; font-size: 20pt; font-weight: 600;">Summary</h1>`;
  }

  // Convert markdown to HTML
  html += markdownToHtml(msg.text);

  // Use browser's print API to generate PDF
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    console.error("[Docs Summarizer] Could not open print window");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Docs Summary</title>
        <style>
          @media print {
            @page {
              margin: 1in;
            }
          }
          body {
            margin: 0;
            padding: 1in;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            background: #fff;
          }
          h1, h2, h3 {
            font-weight: 600;
            color: #000;
          }
          h1 {
            font-size: 20pt;
            margin-top: 0;
            margin-bottom: 16px;
          }
          h2 {
            font-size: 16pt;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          h3 {
            font-size: 14pt;
            margin-top: 12px;
            margin-bottom: 4px;
          }
          p {
            margin: 4px 0;
            line-height: 1.5;
          }
          ul, ol {
            margin: 4px 0 4px 20px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 2px;
          }
          pre {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 11pt;
            line-height: 1.5;
            border: 1px solid #e5e5e5;
          }
          code {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 2px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 10.5pt;
          }
          hr {
            margin: 12px 0;
            border: none;
            border-top: 1px solid #ddd;
          }
          a {
            color: #2563eb;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Clean up after a delay
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 250);
  };
}

/**
 * Helper function to escape HTML special characters.
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


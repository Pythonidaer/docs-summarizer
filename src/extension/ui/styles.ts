export const DRAWER_STYLE_CSS = `
#docs-summarizer-main h1 {
  margin-top: 20px;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 18px;
  color: #f9fafb;
}

#docs-summarizer-main h2 {
  margin-top: 18px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 16px;
  color: #f9fafb;
}

#docs-summarizer-main h3 {
  margin-top: 16px;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #f9fafb;
}

#docs-summarizer-main p {
  margin-top: 10px;
  margin-bottom: 10px;
  line-height: np1.5;
  color: #e5e7eb;
}

#docs-summarizer-main ul,
#docs-summarizer-main ol {
  margin: 10px 0;
  padding-left: 20px;
}

#docs-summarizer-main li {
  margin-bottom: 4px;
}

#docs-summarizer-main pre {
  margin: 12px 0;
  padding: 10px;
  background: #000;
  border-radius: 6px;
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.15);
  color: #f9fafb;
}

#docs-summarizer-main code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.45;
}
`;

export const GLOBAL_HIGHLIGHT_STYLE_CSS = `
  .docs-summarizer-page-highlight {
    outline: 2px solid #f97316 !important;
    background-color: rgba(249, 115, 22, 0.12) !important;
    transition: background-color 0.2s ease-out, outline-color 0.2s ease-out;
  }
`;

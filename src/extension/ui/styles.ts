import { CURSOR_COLORS, CURSOR_TYPOGRAPHY, CURSOR_BORDERS } from "./design";

// Generate CSS string with design constants
export const DRAWER_STYLE_CSS = `
#docs-summarizer-main h1 {
  margin-top: 20px;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 18px;
  color: ${CURSOR_COLORS.textPrimary};
}

#docs-summarizer-main h2 {
  margin-top: 18px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 16px;
  color: ${CURSOR_COLORS.textPrimary};
}

#docs-summarizer-main h3 {
  margin-top: 16px;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 14px;
  color: ${CURSOR_COLORS.textPrimary};
}

#docs-summarizer-main p {
  margin-top: 10px;
  margin-bottom: 10px;
  line-height: 1.5;
  color: ${CURSOR_COLORS.textPrimary};
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
  background: ${CURSOR_COLORS.backgroundTertiary};
  border-radius: ${CURSOR_BORDERS.radius.md};
  overflow-x: auto;
  border: ${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border};
  color: ${CURSOR_COLORS.textPrimary};
}

#docs-summarizer-main code {
  font-family: ${CURSOR_TYPOGRAPHY.fontFamily};
  font-size: 13px;
  line-height: 1.45;
}
`;

export const GLOBAL_HIGHLIGHT_STYLE_CSS = `
  .docs-summarizer-page-highlight {
    background-color: #FFF4CC !important;
    color: #1a1a1a !important;
    transition: background-color 0.2s ease-out, color 0.2s ease-out;
  }
`;

export const LOADING_ANIMATION_CSS = `
  @keyframes docs-summarizer-pulse {
    0%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
`;

export const MODAL_ANIMATION_CSS = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

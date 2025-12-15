// src/extension/ui/modal.ts
import { CURSOR_COLORS, CURSOR_SPACING, CURSOR_BORDERS, CURSOR_TYPOGRAPHY } from "./design";

export interface ModalOptions {
  title?: string;
  message: string;
  type?: "alert" | "prompt" | "error";
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

const MODAL_OVERLAY_ID = "docs-summarizer-modal-overlay";

/**
 * Removes modal from DOM
 */
function removeModal(): void {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Creates and shows a modal dialog
 */
export function showModal(options: ModalOptions): void {
  // Remove any existing modal
  removeModal();

  let {
    title,
    message,
    type = "alert",
    inputPlaceholder,
    confirmText = "OK",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  } = options;

  // Create overlay (backdrop)
  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;
  Object.assign(overlay.style, {
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
    zIndex: "1000000", // Above drawer
    animation: "fadeIn 0.2s ease-out",
  } as CSSStyleDeclaration);

  // Create modal container
  const modal = document.createElement("div");
  modal.className = "docs-summarizer-modal";
  Object.assign(modal.style, {
    background: CURSOR_COLORS.backgroundSecondary, // #252526
    borderRadius: CURSOR_BORDERS.radius.md, // 6px
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    padding: CURSOR_SPACING.xl, // 16px
    maxWidth: "400px",
    width: "90%",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    animation: "slideUp 0.2s ease-out",
  } as CSSStyleDeclaration);

  // Title (if provided)
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "docs-summarizer-modal-title";
    Object.assign(titleEl.style, {
      fontSize: CURSOR_TYPOGRAPHY.fontSize.lg, // 16px
      fontWeight: CURSOR_TYPOGRAPHY.fontWeight.medium, // 500
      color: CURSOR_COLORS.textPrimary,
      marginBottom: CURSOR_SPACING.md, // 8px
    } as CSSStyleDeclaration);
    titleEl.textContent = title;
    modal.appendChild(titleEl);
  }

  // Message
  const messageEl = document.createElement("div");
  messageEl.className = "docs-summarizer-modal-message";
  Object.assign(messageEl.style, {
    fontSize: type === "prompt" ? CURSOR_TYPOGRAPHY.fontSize.sm : CURSOR_TYPOGRAPHY.fontSize.base, // Smaller for prompt (12px), normal for others (13px)
    color: CURSOR_COLORS.textPrimary,
    lineHeight: CURSOR_TYPOGRAPHY.lineHeight.normal, // 1.4
    marginBottom: type === "prompt" ? CURSOR_SPACING.md : CURSOR_SPACING.xl, // Reduced spacing for prompt (8px), normal for others (16px)
    whiteSpace: "pre-wrap",
  } as CSSStyleDeclaration);
  
  // Parse message for markdown-like formatting (**bold**)
  const processedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  messageEl.innerHTML = processedMessage;
  
  // Style strong and em tags for bold/italic text
  const styleTag = document.createElement("style");
  styleTag.textContent = `
    .docs-summarizer-modal-message strong,
    .docs-summarizer-modal strong {
      font-weight: ${CURSOR_TYPOGRAPHY.fontWeight.bold};
      color: ${CURSOR_COLORS.textPrimary};
    }
    .docs-summarizer-modal-message em,
    .docs-summarizer-modal em {
      font-style: italic;
      color: ${CURSOR_COLORS.textPrimary};
    }
  `;
  if (!document.head.querySelector('style[data-modal-styles]')) {
    styleTag.setAttribute('data-modal-styles', 'true');
    document.head.appendChild(styleTag);
  }
  
  modal.appendChild(messageEl);

  // Input field (for prompt type)
  let inputEl: HTMLInputElement | null = null;
  let securityNoticeEl: HTMLDivElement | null = null;
  if (type === "prompt") {
    inputEl = document.createElement("input");
    inputEl.type = "text";
    if (inputPlaceholder) {
      inputEl.placeholder = inputPlaceholder;
    }
    Object.assign(inputEl.style, {
      width: "100%",
      padding: `${CURSOR_SPACING.sm} ${CURSOR_SPACING.md}`,
      borderRadius: CURSOR_BORDERS.radius.sm,
      border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.inputBorder}`,
      background: CURSOR_COLORS.inputBackground,
      color: CURSOR_COLORS.textPrimary,
      fontSize: CURSOR_TYPOGRAPHY.fontSize.base,
      fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
      marginTop: CURSOR_SPACING.sm, // Consistent spacing from message
      marginBottom: CURSOR_SPACING.lg, // More spacing before security notice (matches paragraph spacing)
      boxSizing: "border-box",
      outline: "none",
      transition: "border-color 0.2s",
    } as CSSStyleDeclaration);

    inputEl.addEventListener("focus", () => {
      inputEl!.style.borderColor = CURSOR_COLORS.inputBorderHover;
    });
    inputEl.addEventListener("blur", () => {
      inputEl!.style.borderColor = CURSOR_COLORS.inputBorder;
    });

    modal.appendChild(inputEl);

    // Check if message contains security notice marker
    if (message.includes("⚠️ **Security Notice**:")) {
      // Extract security notice from message
      const securityNoticeMatch = message.match(/⚠️ \*\*Security Notice\*\*: (.+)/);
      if (securityNoticeMatch && securityNoticeMatch[1]) {
        securityNoticeEl = document.createElement("div");
        Object.assign(securityNoticeEl.style, {
          fontSize: CURSOR_TYPOGRAPHY.fontSize.xs, // 11px - smaller text
          color: CURSOR_COLORS.textPrimary, // Brighter text for better visibility
          lineHeight: CURSOR_TYPOGRAPHY.lineHeight.normal,
          marginBottom: CURSOR_SPACING.xl,
          whiteSpace: "pre-wrap",
        } as CSSStyleDeclaration);
        
        // Parse bold formatting
        const noticeText = securityNoticeMatch[1].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        securityNoticeEl.innerHTML = `⚠️ <strong>Security Notice</strong>: ${noticeText}`;
        
        modal.appendChild(securityNoticeEl);
        
        // Remove security notice from main message
        message = message.replace(/\n\n⚠️ \*\*Security Notice\*\*: .+/, "");
        // Update messageEl with cleaned message
        const cleanedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        messageEl.innerHTML = cleanedMessage;
      }
    }
  }

  // Buttons container
  const buttonsContainer = document.createElement("div");
  Object.assign(buttonsContainer.style, {
    display: "flex",
    gap: CURSOR_SPACING.sm,
    justifyContent: type === "prompt" ? "flex-end" : "center",
  } as CSSStyleDeclaration);

  // Cancel button (only for prompt or if onCancel provided)
  if (type === "prompt" || onCancel) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "docs-summarizer-modal-button";
    cancelBtn.textContent = cancelText;
    Object.assign(cancelBtn.style, {
      padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
      fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
      borderRadius: "9999px", // Pill-shaped
      border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
      background: "transparent",
      color: CURSOR_COLORS.textPrimary,
      cursor: "pointer",
      transition: "background-color 0.2s, border-color 0.2s",
      fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    } as CSSStyleDeclaration);

    cancelBtn.addEventListener("mouseenter", () => {
      cancelBtn.style.background = "rgba(255, 255, 255, 0.05)";
      cancelBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
    });
    cancelBtn.addEventListener("mouseleave", () => {
      cancelBtn.style.background = "transparent";
      cancelBtn.style.borderColor = CURSOR_COLORS.border;
    });

    cancelBtn.addEventListener("click", () => {
      if (onCancel) {
        onCancel();
      }
      removeModal();
    });

    buttonsContainer.appendChild(cancelBtn);
  }

  // Confirm/OK button
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "docs-summarizer-modal-button";
  confirmBtn.textContent = confirmText;
  Object.assign(confirmBtn.style, {
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    borderRadius: "9999px", // Pill-shaped
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
  } as CSSStyleDeclaration);

  confirmBtn.addEventListener("mouseenter", () => {
    confirmBtn.style.background = "rgba(255, 255, 255, 0.05)";
    confirmBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  confirmBtn.addEventListener("mouseleave", () => {
    confirmBtn.style.background = "transparent";
    confirmBtn.style.borderColor = CURSOR_COLORS.border;
  });

  confirmBtn.addEventListener("click", () => {
    const value = inputEl?.value || undefined;
    if (onConfirm) {
      onConfirm(value);
    }
    removeModal();
  });

  buttonsContainer.appendChild(confirmBtn);
  modal.appendChild(buttonsContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus input if present
  if (inputEl) {
    setTimeout(() => inputEl!.focus(), 0);
  } else {
    confirmBtn.focus();
  }

  // Close on ESC key
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (onCancel) {
        onCancel();
      }
      removeModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Close on overlay click (optional - only if no input)
  if (type !== "prompt") {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        if (onCancel) {
          onCancel();
        }
        removeModal();
      }
    });
  }
}

/**
 * Shows a simple alert modal
 */
export function showAlert(message: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    showModal({
      message,
      ...(title !== undefined && { title }),
      type: "alert",
      onConfirm: () => {
        resolve();
      },
    });
  });
}

/**
 * Shows a prompt modal with input field
 */
export function showPrompt(message: string, placeholder?: string, title?: string): Promise<string | null> {
  return new Promise((resolve) => {
    showModal({
      message,
      type: "prompt",
      ...(title !== undefined && { title }),
      ...(placeholder !== undefined && { inputPlaceholder: placeholder }),
      onConfirm: (value) => {
        resolve(value || null);
      },
      onCancel: () => {
        resolve(null);
      },
    });
  });
}

/**
 * Shows a Security & Privacy FAQ modal with scrollable content
 */
export function showSecurityFAQ(): void {
  // Remove any existing modal
  removeModal();

  // Create overlay (backdrop)
  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;
  Object.assign(overlay.style, {
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
    animation: "fadeIn 0.2s ease-out",
  } as CSSStyleDeclaration);

  // Create modal container (moderate size, scrollable)
  const modal = document.createElement("div");
  modal.className = "docs-summarizer-modal";
  Object.assign(modal.style, {
    background: CURSOR_COLORS.backgroundSecondary,
    borderRadius: CURSOR_BORDERS.radius.md,
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    padding: CURSOR_SPACING.xl,
    maxWidth: "500px",
    maxHeight: "70vh", // Moderate height, allows scrolling
    width: "90%",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    animation: "slideUp 0.2s ease-out",
    display: "flex",
    flexDirection: "column",
  } as CSSStyleDeclaration);

  // Title - use inline style with !important to prevent page CSS overrides
  const titleEl = document.createElement("div");
  titleEl.className = "docs-summarizer-faq-title";
  titleEl.textContent = "Security & Privacy FAQ";
  // Use setAttribute with !important to override any page CSS
  titleEl.setAttribute("style", `font-size: ${CURSOR_TYPOGRAPHY.fontSize.lg + 4}px !important; font-weight: ${CURSOR_TYPOGRAPHY.fontWeight.bold} !important; color: ${CURSOR_COLORS.textPrimary} !important; margin-bottom: ${CURSOR_SPACING.lg}; flex-shrink: 0;`);
  modal.appendChild(titleEl);

  // Scrollable content area
  const contentArea = document.createElement("div");
  Object.assign(contentArea.style, {
    overflowY: "auto",
    flex: "1",
    paddingRight: CURSOR_SPACING.sm, // Space for scrollbar
    marginBottom: CURSOR_SPACING.lg,
  } as CSSStyleDeclaration);

  // Helper function to create FAQ section
  const createSection = (question: string, answer: string | HTMLElement) => {
    const section = document.createElement("div");
    Object.assign(section.style, {
      marginBottom: CURSOR_SPACING.xl, // Spacing between FAQ sections
      marginTop: CURSOR_SPACING.lg, // Additional top spacing for each section
    } as CSSStyleDeclaration);

    const questionEl = document.createElement("div");
    Object.assign(questionEl.style, {
      fontSize: CURSOR_TYPOGRAPHY.fontSize.base, // Slightly smaller than before (13px), but still bigger than body text
      fontWeight: CURSOR_TYPOGRAPHY.fontWeight.bold, // Make headings bold
      color: CURSOR_COLORS.textPrimary,
      marginBottom: CURSOR_SPACING.xs, // Reduced spacing between heading and content
    } as CSSStyleDeclaration);
    questionEl.textContent = question;
    section.appendChild(questionEl);

    const answerEl = document.createElement("div");
    Object.assign(answerEl.style, {
      fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
      color: CURSOR_COLORS.textPrimary, // Bright white/flavor of white like info icon for a11y
      lineHeight: CURSOR_TYPOGRAPHY.lineHeight.normal,
      whiteSpace: "pre-wrap",
      marginTop: CURSOR_SPACING.xs, // Small margin top for better spacing from heading
    } as CSSStyleDeclaration);

    if (typeof answer === "string") {
      // Process markdown-like formatting and reduce spacing between paragraphs and lists
      let processed = answer
        .replace(/\n\n•/g, "\n•") // Remove extra newline before bullet lists
        .replace(/\n\n\d+\./g, "\n$&") // Remove extra newline before numbered lists
        .replace(/\n\n\n/g, "\n\n"); // Normalize triple newlines
      
      // Convert numbered lists to bullet points
      processed = processed.replace(/^\d+\. /gm, "• ");
      
      // Process bold formatting (**text**)
      processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Process italic formatting (*text*) - but not if it's part of **bold**
      processed = processed.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      
      answerEl.innerHTML = processed;
    } else {
      // For HTML elements, process text content to convert numbered lists
      // Note: We preserve the HTML structure (links, etc.) but process text nodes
      const processTextNodes = (element: HTMLElement) => {
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        const textNodes: Text[] = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node as Text);
          }
        }
        
        // Process each text node - convert numbered lists to bullets
        textNodes.forEach(textNode => {
          if (textNode.textContent) {
            let text = textNode.textContent;
            // Convert numbered lists to bullets
            text = text.replace(/^\d+\. /gm, "• ");
            // Process bold (**text**)
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Process italic (*text*) - but not if part of **bold**
            text = text.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
            
            if (text !== textNode.textContent && textNode.parentNode) {
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = text;
              const fragment = document.createDocumentFragment();
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
              textNode.parentNode.replaceChild(fragment, textNode);
            }
          }
        });
      };
      
      processTextNodes(answer);
      answerEl.appendChild(answer);
    }
    section.appendChild(answerEl);

    return section;
  };

  // Helper to create clickable link
  const createLink = (url: string, text: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text;
    Object.assign(link.style, {
      color: "#60a5fa", // Blue link color
      textDecoration: "underline",
      cursor: "pointer",
    } as CSSStyleDeclaration);
    return link;
  };

  // FAQ Sections (single scrollable page)
  
  // How to sign up for OpenAI key (new section)
  const signupAnswer = document.createElement("div");
  signupAnswer.appendChild(document.createTextNode("To get an OpenAI API key:\n• Visit "));
  signupAnswer.appendChild(createLink("https://platform.openai.com/api-keys", "https://platform.openai.com/api-keys"));
  signupAnswer.appendChild(document.createTextNode("\n• Sign up or log in to your OpenAI account\n• Click \"Create new secret key\"\n• Copy the key (it starts with \"sk-\")\n• Paste it into this extension when prompted"));
  const firstSection = createSection(
    "How do I get an OpenAI API key?",
    signupAnswer
  );
  // Remove top margin from first section
  firstSection.style.marginTop = "0";
  contentArea.appendChild(firstSection);

  contentArea.appendChild(createSection(
    "Where is my API key stored?",
    "Your API key is stored locally in Chrome's local storage (`chrome.storage.local`). It is:\n• Only accessible by this extension\n• Not synced across devices\n• Not sent to any external servers except OpenAI's API\n• Stored on your computer only"
  ));

  contentArea.appendChild(createSection(
    "What risks are associated with providing my API Key?",
    "While we take security seriously, you should be aware of these risks:\n• If your computer is compromised, the key could be accessed\n• Anyone with access to your Chrome storage could use your key\n• The key has access to your OpenAI account and billing\n• The extension only sends the key to OpenAI's API (never to other servers)"
  ));

  contentArea.appendChild(createSection(
    "How can I delete my API key from storage?",
    "You can delete your API key in two ways:\n• Click the \"Delete Key\" button in the extension header\n• Manually: Chrome DevTools → Application → Storage → Local Storage → Extension ID → Delete `openaiApiKey`"
  ));

  const compromisedAnswer = document.createElement("div");
  compromisedAnswer.appendChild(document.createTextNode("If your computer gets compromised:\n• Immediately revoke the key in your OpenAI dashboard: "));
  compromisedAnswer.appendChild(createLink("https://platform.openai.com/api-keys", "https://platform.openai.com/api-keys"));
  compromisedAnswer.appendChild(document.createTextNode("\n• Create a new key if needed\n\n**If you want to be super cautious, consider using a throwaway API key with spending limits:**\n• Go to OpenAI dashboard → Billing → Set usage limits\n• Create a separate API key for this extension\n• Set a monthly spending cap"));
  contentArea.appendChild(createSection(
    "What happens if my computer gets compromised?",
    compromisedAnswer
  ));

  contentArea.appendChild(createSection(
    "Security Best Practices",
    "• Use a key with limited permissions/spending limits\n• Regularly rotate your keys\n• Never share your API key\n• Revoke keys immediately if compromised\n• Consider using a throwaway key with spending limits for this extension"
  ));

  // Donation/LinkedIn section (moved up)
  const supportAnswer = document.createElement("div");
  supportAnswer.appendChild(document.createTextNode("If this extension proves useful to you, please consider:\n• Donating via "));
  supportAnswer.appendChild(createLink("https://venmo.com/jonamichahammo", "Venmo: @jonamichahammo"));
  supportAnswer.appendChild(document.createTextNode("\n• Connecting on "));
  supportAnswer.appendChild(createLink("https://www.linkedin.com/in/jonamichahammo", "LinkedIn"));
  supportAnswer.appendChild(document.createTextNode(" (currently looking for work in the Massachusetts area)"));
  contentArea.appendChild(createSection(
    "Support This Extension",
    supportAnswer
  ));

  // Security & Privacy section
  const privacyAnswer = document.createElement("div");
  privacyAnswer.appendChild(document.createTextNode("This extension:\n• Stores your API key locally in Chrome storage only (`chrome.storage.local`)\n• Sends your API key ONLY to OpenAI's API ("));
  privacyAnswer.appendChild(createLink("https://api.openai.com", "https://api.openai.com"));
  privacyAnswer.appendChild(document.createTextNode(")\n• Never sends your key to any other servers\n• Never logs your API key\n• Processes page content locally before sending to OpenAI\n• Does not collect or store any personal data\n• Only injects content script when you click the extension icon (user-triggered)\n• Only sends page content to OpenAI when you explicitly trigger a request (Summarize or Chat)\n• No automatic data transmission\n• No data resale\n• No data retention (we don't store content)\n\n"));
  privacyAnswer.appendChild(document.createTextNode("*Important: The extension creator does NOT store your data. Your API key and all data are stored locally on your computer only. The extension creator has no access to your API key, your OpenAI account, or any data you process with this extension.*"));
  contentArea.appendChild(createSection(
    "Security & Privacy",
    privacyAnswer
  ));

  // About section
  const aboutAnswer = document.createElement("div");
  aboutAnswer.appendChild(document.createTextNode("Created by Johnny Hammond\n"));
  const githubLink = createLink("https://www.github.com/pythonidaer", "GitHub");
  const linkedInLink = createLink("https://www.linkedin.com/in/jonamichahammo", "LinkedIn");
  const venmoLink = createLink("https://venmo.com/jonamichahammo", "Venmo: @jonamichahammo");
  // Make links bold
  Object.assign(githubLink.style, { fontWeight: CURSOR_TYPOGRAPHY.fontWeight.bold });
  Object.assign(linkedInLink.style, { fontWeight: CURSOR_TYPOGRAPHY.fontWeight.bold });
  Object.assign(venmoLink.style, { fontWeight: CURSOR_TYPOGRAPHY.fontWeight.bold });
  aboutAnswer.appendChild(githubLink);
  aboutAnswer.appendChild(document.createTextNode(" | "));
  aboutAnswer.appendChild(linkedInLink);
  aboutAnswer.appendChild(document.createTextNode(" | "));
  aboutAnswer.appendChild(venmoLink);
  contentArea.appendChild(createSection(
    "About",
    aboutAnswer
  ));

  modal.appendChild(contentArea);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  Object.assign(closeBtn.style, {
    padding: `${CURSOR_SPACING.xs} ${CURSOR_SPACING.md}`,
    fontSize: CURSOR_TYPOGRAPHY.fontSize.sm,
    borderRadius: "9999px",
    border: `${CURSOR_BORDERS.width.thin} solid ${CURSOR_COLORS.border}`,
    background: "transparent",
    color: CURSOR_COLORS.textPrimary,
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    fontFamily: CURSOR_TYPOGRAPHY.fontFamily,
    alignSelf: "flex-end",
    flexShrink: "0",
  } as CSSStyleDeclaration);

  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "rgba(255, 255, 255, 0.05)";
    closeBtn.style.borderColor = CURSOR_COLORS.inputBorderHover;
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.borderColor = CURSOR_COLORS.border;
  });

  closeBtn.addEventListener("click", () => {
    removeModal();
  });

  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  closeBtn.focus();

  // Close on ESC key
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      removeModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      removeModal();
    }
  });
}


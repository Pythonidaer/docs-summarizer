// src/extension/ui/footer.ts
export interface FooterElements {
  footer: HTMLDivElement;
  chatInput: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
}

export function createFooter(): FooterElements {
  const footer = document.createElement("div");
  Object.assign(footer.style, {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  } as CSSStyleDeclaration);

  const chatRow = document.createElement("div");
  Object.assign(chatRow.style, {
    display: "flex",
    gap: "6px",
  } as CSSStyleDeclaration);

  const chatInput = document.createElement("textarea") as HTMLTextAreaElement;
  Object.assign(chatInput.style, {
    flex: "1 1 auto",
    minHeight: "40px",
    maxHeight: "120px",
    resize: "vertical",
    padding: "6px 8px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#050505",
    color: "#f5f5f5",
    fontSize: "13px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  } as CSSStyleDeclaration);
  chatInput.placeholder = "Ask a question about this page…";

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  Object.assign(sendBtn.style, {
    padding: "6px 10px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#1f6feb",
    color: "#ffffff",
    cursor: "pointer",
    flex: "0 0 auto",
  } as CSSStyleDeclaration);

  chatRow.appendChild(chatInput);
  chatRow.appendChild(sendBtn);
  footer.appendChild(chatRow);

  return { footer, chatInput, sendBtn };
}

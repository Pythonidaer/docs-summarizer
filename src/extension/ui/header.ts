export function createHeader(): {
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
} {
  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    paddingBottom: "6px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  } as CSSStyleDeclaration);

  const title = document.createElement("div");
  title.textContent = "Docs Summarizer";
  Object.assign(title.style, {
    fontWeight: "700",
    fontSize: "16px",
    letterSpacing: "0.02em",
  } as CSSStyleDeclaration);

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  Object.assign(closeButton.style, {
    marginLeft: "8px",
    border: "none",
    background: "transparent",
    color: "#f5f5f5",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: "1",
  } as CSSStyleDeclaration);

  header.appendChild(title);
  header.appendChild(closeButton);

  return { header, closeButton };
}

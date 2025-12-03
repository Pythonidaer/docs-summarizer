let PAGE_TEXT_FOR_LINKS = "";

export function setPageTextForLinks(text: string): void {
  PAGE_TEXT_FOR_LINKS = text || "";
}

export function getPageTextForLinks(): string {
  return PAGE_TEXT_FOR_LINKS;
}
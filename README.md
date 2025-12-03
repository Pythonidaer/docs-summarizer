# Docs Summarizer (Chrome Extension)

Docs Summarizer is a Chrome extension that injects a right-hand drawer
into any page and uses OpenAI's Responses API to summarize documentation
and answer follow-up questions. It also supports internal scroll links
and on-page highlighting based on model output.

## Features

-   Right-side drawer with:
    -   Toggle handle on the right edge of the page.
    -   Header, toolbar, and scrollable message area.
    -   "Use custom instructions" checkbox + textarea.
    -   "Summarize page" and "Clear highlights" buttons.
    -   Chat-style follow-up questions about the current page.
-   Uses OpenAI Responses API (`gpt-5-nano`) to:
    -   Summarize the current page.
    -   Answer follow-up questions referencing page content + history.
-   Smart linking and highlighting:
    -   Model can emit `[label](#scroll:Some phrase)` links.
    -   Only turns them into clickable scroll links if the phrase exists
        in the page text.
    -   Scrolls to the best-matching element and highlights the phrase
        (inline, with block fallback).

## Tech Stack

-   TypeScript
-   Chrome Extension (Manifest V3)
-   esbuild (content script bundling)
-   Jest + ts-jest (unit tests)
-   JSDOM (DOM tests)

## Requirements

-   Node.js (18+ recommended)
-   npm
-   Google Chrome (Manifest V3 support)
-   OpenAI API key: https://platform.openai.com/api-keys

## Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/<your-username>/docs-summarizer.git
cd docs-summarizer
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Build the project

``` bash
npm run build
npm run build:content
```

### 4. Run tests

``` bash
npm test
```

### 5. Load into Chrome

1.  Run `npm run build:content`.
2.  Open `chrome://extensions`.
3.  Enable Developer Mode.
4.  Click **Load unpacked**.
5.  Select the folder containing `manifest.json`.

### 6. First Run (API Key Prompt)

The extension stores your OpenAI key in `chrome.storage.sync` under
`openaiApiKey`.\
You will be prompted automatically when first needed.

## Project Structure

``` text
src/
  extension/
    constants.ts
    types.ts
    pageText.ts
    highlight.ts
    markdown.ts
    openai.ts
    storage/
      apiKey.ts
    __tests__/
      openai.test.ts
      highlight.test.ts
      markdown.test.ts
    content-script.ts
dist/
  extension/
    content-script.js
manifest.json
jest.config.cjs
tsconfig.json
index.js
package.json
package-lock.json
```

## npm Scripts

``` json
"scripts": {
  "dev": "node index.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "build": "tsc",
  "build:content": "esbuild src/extension/content-script.ts --bundle --format=iife --platform=browser --outfile=dist/extension/content-script.js --sourcemap"
}
```

## Testing Notes

-   Jest + ts-jest
-   Uses JSDOM for DOM simulation
-   Tests include OpenAI helpers, highlighting, markdown parsing

## Future Work

-   Break up `content-script.ts` into UI modules
-   Add UI integration tests

## License

MIT (recommended)

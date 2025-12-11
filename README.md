# Docs Summarizer (Chrome Extension)

Docs Summarizer is a Chrome extension that injects a right-hand drawer
into any page and uses OpenAI's Responses API to summarize documentation
and answer follow-up questions. It also supports internal scroll links
and on-page highlighting based on model output.

## Features

-   **Right-side drawer** with:
    -   Toggle handle on the right edge of the page (dynamically positioned).
    -   Header, toolbar, and scrollable message area.
    -   "Use custom instructions" checkbox + textarea.
    -   "Summarize page" and "Clear highlights" buttons.
    -   Chat-style follow-up questions about the current page.
    -   Page blur/focus mode to reduce distractions.
-   **Detached window mode**:
    -   Detach the drawer into a separate popup window.
    -   Works independently while maintaining connection to the original page.
    -   Scroll links in detached window trigger scrolling/highlighting on the main page.
    -   State persists across service worker restarts.
    -   Automatically restores state when the detached window is refreshed.
-   **Prompt voices** (10 distinct AI personas):
    -   Default, Teacher, Senior Engineer, Simplifier, Organizer, Socratic, In-Depth, MLA Essay, Technical Report, Research Abstract.
    -   Each voice has unique instructions and formatting preferences.
-   **Model settings**:
    -   Uses OpenAI Responses API (`gpt-5-nano`) by default.
    -   Reasoning effort levels: Low (default), Medium.
    -   Verbosity: Low (default).
-   **Smart linking and highlighting**:
    -   Model can emit `[label](#scroll:Some phrase)` links.
    -   Pre-validates phrases before rendering as clickable links.
    -   Only turns them into scroll links if the phrase exists in the page text.
    -   Scrolls to the best-matching element and highlights the phrase
        (inline, with block fallback).
    -   Works from both the drawer and detached window.
-   **State management**:
    -   Background service worker manages detached window state.
    -   State persists to `chrome.storage.local` for reliability.
    -   Automatic tab lookup fallback if connection is lost.

## Tech Stack

-   TypeScript
-   Chrome Extension (Manifest V3)
-   Background Service Worker (state management)
-   esbuild (content script and detached window bundling)
-   Jest + ts-jest (unit tests)
-   JSDOM (DOM tests)
-   Shadow DOM (UI isolation)

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
npm run build:all
```

Or build individually:
``` bash
npm run build          # TypeScript compilation
npm run build:content  # Content script bundle
npm run build:detached  # Detached window bundle
```

### 4. Run tests

``` bash
npm test
```

### 5. Load into Chrome

1.  Run `npm run build:all` to build all components.
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
    constants.ts              # System instructions, default settings
    types.ts                  # TypeScript interfaces
    pageText.ts               # Page text extraction and validation
    pageStructure.ts          # Page structure extraction for AI
    highlight.ts              # Scroll and highlight functionality
    markdown.ts               # Markdown renderer with scroll link support
    openai.ts                 # OpenAI API integration
    content-script.ts         # Main content script (drawer UI)
    detached-window.ts       # Detached window logic
    background.ts             # Service worker for state management
    storage/
      apiKey.ts              # API key management
    prompts/
      voices.ts              # Prompt voice definitions
    ui/
      shell.ts               # Drawer shell/container
      header.ts              # Header component
      toolbar.ts             # Toolbar with controls
      instructionsPanel.ts   # Custom instructions panel
      mainArea.ts            # Message display area
      footer.ts              # Chat input footer
      events.ts              # Event wiring
      styles.ts              # CSS styles
      focusBlur.ts           # Page blur functionality
    __tests__/               # Unit tests
dist/
  extension/
    content-script.js        # Bundled content script
    detached-window.js       # Bundled detached window script
    background.js            # Service worker
detached-window.html         # Detached window HTML
manifest.json
jest.config.cjs
tsconfig.json
package.json
```

## npm Scripts

``` json
{
  "dev": "node index.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "build": "tsc",
  "build:content": "esbuild src/extension/content-script.ts --bundle --format=iife --platform=browser --outfile=dist/extension/content-script.js --sourcemap",
  "build:detached": "esbuild src/extension/detached-window.ts --bundle --format=esm --platform=browser --outfile=dist/extension/detached-window.js --sourcemap",
  "build:all": "npm run build && npm run build:content && npm run build:detached"
}
```

## Usage

### Basic Usage

1. Navigate to any web page.
2. Click the toggle handle on the right edge to open the drawer.
3. Click "Summarize page" to get an AI summary.
4. Ask follow-up questions in the chat input.

### Detached Window

1. Open the drawer on any page.
2. Click the "Detach to Window" button in the toolbar.
3. The drawer opens in a separate popup window.
4. You can move, resize, or position this window independently.
5. Scroll links in the detached window will scroll/highlight on the original page.
6. The detached window maintains its state even if refreshed.

**Note**: The detached window uses a snapshot of the page content from when it was detached. If the main page is refreshed, scroll links may not work if the content has changed.

### Prompt Voices

Select different AI personas from the "Voice" dropdown:
- **Default**: Balanced, clear explanations
- **Teacher**: Educational, step-by-step guidance
- **Senior Engineer**: Technical, code-focused
- **Simplifier**: ADHD-friendly, concise
- **Organizer**: Structured, checklist-oriented
- **Socratic**: Question-based learning
- **In-Depth**: Detailed, comprehensive
- **MLA Essay**: Academic writing style
- **Technical Report**: Formal technical documentation
- **Research Abstract**: Scientific paper style

### Custom Instructions

Enable "Use custom instructions" to provide specific guidance to the AI model. This overrides the default prompt voice instructions.

### Page Blur

Enable the blur checkbox to dim the main page content, helping you focus on the AI responses.

## Testing Notes

-   Jest + ts-jest
-   Uses JSDOM for DOM simulation
-   Tests include OpenAI helpers, highlighting, markdown parsing, page structure extraction, and more
-   Comprehensive test coverage for core functionality

## Architecture Notes

- **Content Script**: Injected into every page, manages the drawer UI and page interaction
- **Background Service Worker**: Manages detached window state, message passing, and tab connections
- **Detached Window**: Separate popup window that communicates with the background script
- **State Persistence**: Uses `chrome.storage.local` to persist state across service worker restarts
- **Message Passing**: Content script ↔ Background script ↔ Detached window communication

## Future Work

-   Real-time page content sync for detached window
-   Multiple detached windows support
-   Export/import conversation history

## License

MIT (recommended)

# Docs Summarizer

**AI-powered Chrome extension to summarize and explain documentation pages with customizable voice styles.**

Docs Summarizer helps you quickly understand documentation by providing AI-powered summaries and answering your questions about the content. Simply open the extension on any page, and get instant insights tailored to your preferred learning style.

---

## Quick Navigation

- [For Users](#for-users) - Installation, features, and usage
- [Support](#support) - Get help or report issues
- [For Developers](#for-developers) - Setup, development, and contributing

---

## For Users

### Features

- **Right-side drawer** with AI-powered summaries
  - Toggle handle on the right edge of the page
  - Clean, distraction-free interface
  - Page blur mode to focus on AI responses

- **Smart scrolling and highlighting**
  - Click links in AI responses to jump to relevant sections
  - Automatically highlights referenced content on the page
  - Works seamlessly with documentation sites

- **Detached window mode**
  - Detach the chat into a separate window
  - Continue conversations while browsing
  - Maintains connection to the original page

- **14 customizable prompt voices**
  - Default, Teacher, Senior Engineer, Simplifier, Organizer, Socratic, In-Depth
  - MLA Essay, APA Essay, Technical Report, Research Abstract, Retrieval Coach, Visual Mapper, Setup Guide
  - Each voice tailors explanations to different learning styles and use cases

- **Custom instructions**
  - Override default voice instructions
  - Get responses exactly how you want them

### Getting Started

1. **Install from Chrome Web Store** 
   - Or load the extension manually (see [For Developers](#for-developers))

2. **Get an OpenAI API Key**
   - Visit [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Sign up or log in to your OpenAI account
   - Click "Create new secret key"
   - Copy the key (it starts with "sk-")

3. **First Use**
   - Navigate to any documentation page
   - Click the extension icon or the toggle handle on the right edge
   - Paste your OpenAI API key when prompted
   - Click "Summarize page" to get started!

> **Note**: This is an experimental tool that may not work perfectly on every page. Results can vary depending on page structure, content format, and complexity. For best results, try experimenting with different prompt voices and custom instructions. Clever prompting (e.g., being specific about what you want to understand, asking focused questions) may result in better, more useful responses.

### Usage

#### Basic Usage

1. Navigate to any web page
2. Click the toggle handle on the right edge to open the drawer
3. Click "Summarize page" to get an AI summary
4. Ask follow-up questions in the chat input

#### Detached Window

1. Open the drawer on any page
2. Click the "Detach to Window" button in the toolbar
3. The drawer opens in a separate popup window
4. You can move, resize, or position this window independently
5. Scroll links in the detached window will scroll/highlight on the original page

**Note**: The detached window uses a snapshot of the page content from when it was detached. If the main page is refreshed, scroll links may not work if the content has changed.

#### Prompt Voices

Select different AI personas from the "Voice" dropdown to get responses tailored to your needs:

- **Default**: Balanced, clear explanations
- **Teacher**: Educational, step-by-step guidance
- **Senior Engineer**: Technical, code-focused
- **Simplifier**: ADHD-friendly, concise
- **Organizer**: Structured, checklist-oriented
- **Socratic**: Question-based learning
- **In-Depth**: Detailed, comprehensive
- **MLA Essay**: Academic writing style with MLA citations
- **APA Essay**: Academic writing style with APA citations
- **Technical Report**: Formal technical documentation
- **Research Abstract**: Scientific paper style
- **Retrieval Coach**: Active recall learning
- **Visual Mapper**: Mind map and concept mapping
- **Setup Guide**: Step-by-step installation instructions

#### Custom Instructions

Enable "Use custom instructions" to provide specific guidance to the AI model. This overrides the default prompt voice instructions.

#### Page Blur

Enable the blur checkbox to dim the main page content, helping you focus on the AI responses.

### Privacy & Security

Your OpenAI API key is stored locally on your computer only. The extension creator does NOT have access to your API key, your OpenAI account, or any data you process with this extension.

- API key stored locally in Chrome storage
- Only sent to OpenAI's API (never to other servers)
- No data collection or tracking
- No data storage on external servers

For more details, see our [Privacy Policy](PRIVACY.md) or click the info icon (ℹ️) in the extension header.

---

## Support

Need help or have questions? We're here for you!

- **Email**: [codefolio.work@gmail.com](mailto:codefolio.work@gmail.com)
- **LinkedIn**: [Connect with me on LinkedIn](https://www.linkedin.com/in/jonamichahammo)

---

## For Developers

### Tech Stack

- TypeScript
- Chrome Extension (Manifest V3)
- Background Service Worker (state management)
- esbuild (content script and detached window bundling)
- Jest + ts-jest (unit tests)
- JSDOM (DOM tests)
- Shadow DOM (UI isolation)

### Requirements

- Node.js (18+ recommended)
- npm
- Google Chrome (Manifest V3 support)
- OpenAI API key: https://platform.openai.com/api-keys

### Getting Started

#### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/docs-summarizer.git
cd docs-summarizer
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Build the project

```bash
npm run build:all
```

Or build individually:
```bash
npm run build          # TypeScript compilation
npm run build:content  # Content script bundle
npm run build:detached  # Detached window bundle
```

#### 4. Run tests

```bash
npm test
```

#### 5. Load into Chrome

1. Run `npm run build:all` to build all components.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

#### 6. First Run (API Key Prompt)

The extension stores your OpenAI key in `chrome.storage.local` under `openaiApiKey`. You will be prompted automatically when first needed.

### Project Structure

```
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

### npm Scripts

```json
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

### Security & Privacy (Developer Notes)

#### API Key Storage

Your OpenAI API key is stored locally in Chrome's `chrome.storage.local` under the key `openaiApiKey`. This means:

- **Local storage only**: The key is stored on your computer only, not synced across devices
- **Extension-only access**: Only this extension can access the key
- **No external transmission**: The key is never sent to any servers except OpenAI's API (`https://api.openai.com`)
- **No logging**: The key is never logged in console output or error messages

#### Security Risks

While we take security seriously, you should be aware of these risks:

- If your computer is compromised, the key could be accessed
- Anyone with access to your Chrome storage could use your key
- The key has access to your OpenAI account and billing
- The extension only sends the key to OpenAI's API (never to other servers)

#### Security Best Practices

- **Use spending limits**: If you want to be super cautious, consider using a throwaway API key with spending limits for this extension
  - Go to [OpenAI Dashboard → Billing](https://platform.openai.com/account/billing) → Set usage limits
  - Create a separate API key for this extension
  - Set a monthly spending cap
- **Regular key rotation**: Regularly rotate your API keys
- **Revoke compromised keys**: If your computer is compromised, immediately revoke the key at [OpenAI API Keys](https://platform.openai.com/api-keys)
- **Never share your key**: Keep your API key private

#### How to Delete Your API Key

1. Click the "Delete Key" button in the extension header
2. Or manually: Chrome DevTools → Application → Storage → Local Storage → Extension ID → Delete `openaiApiKey`

#### Privacy

**Important**: The extension creator does NOT store your data. Your API key and all data are stored locally on your computer only. The extension creator has no access to your API key, your OpenAI account, or any data you process with this extension.

This extension:
- Stores your API key locally in Chrome storage only
- Sends your API key ONLY to OpenAI's API
- Never sends your key to any other servers
- Never logs your API key
- Processes page content locally before sending to OpenAI
- Does not collect or store any personal data

Your API key is used solely to authenticate requests to OpenAI's API. We do not have access to your key or your OpenAI account.

You can access the Security & Privacy FAQ at any time by clicking the info icon (ℹ️) next to the "Delete Key" button in the extension header.

### Testing Notes

- Jest + ts-jest
- Uses JSDOM for DOM simulation
- Tests include OpenAI helpers, highlighting, markdown parsing, page structure extraction, and more
- Comprehensive test coverage for core functionality

### Architecture Notes

- **Content Script**: Injected into every page, manages the drawer UI and page interaction
- **Background Service Worker**: Manages detached window state, message passing, and tab connections
- **Detached Window**: Separate popup window that communicates with the background script
- **State Persistence**: Uses `chrome.storage.local` to persist state across service worker restarts
- **Message Passing**: Content script ↔ Background script ↔ Detached window communication

### Future Work

- Real-time page content sync for detached window
- Multiple detached windows support
- Export/import conversation history

### License

MIT

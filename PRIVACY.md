# Privacy Policy for Docs Summarizer

**Last Updated:** December 2025

This privacy policy explains how the Docs Summarizer Chrome extension handles your data.

## Data Storage

### API Key Storage
- Your OpenAI API key is stored locally in Chrome's local storage (`chrome.storage.local`)
- The key is only accessible by this extension
- The key is not synced across devices
- The key is stored on your computer only
- The extension creator does NOT have access to your API key

### What Data is Collected
- **None.** This extension does not collect, store, or transmit any personal data to external servers
- The extension does not track your browsing activity
- The extension does not log or store your API key on external servers

## Data Transmission

### What is Sent to OpenAI
- When you explicitly trigger a request (click "Summarize" or send a chat message), the extension sends:
  - The text content of the current page
  - Your chat messages
  - Your API key (for authentication only)
- **This data is sent ONLY to OpenAI's API** (`https://api.openai.com`)
- The extension never sends your API key to any other servers

### What is NOT Sent
- Your API key is never sent to any server except OpenAI's API
- Page content is only sent when you explicitly request a summary or chat response
- No automatic data transmission occurs
- No browsing history or tracking data is collected

## Local Processing

- Page content is processed locally before being sent to OpenAI
- The extension only injects content scripts when you click the extension icon (user-triggered)
- All processing happens in your browser

## Security Best Practices

To protect your API key:
- Use a key with limited permissions/spending limits in your OpenAI dashboard
- Regularly rotate your keys
- Never share your API key
- Revoke keys immediately if compromised
- Consider using a throwaway key with spending limits for this extension

## Deleting Your Data

### How to Delete Your API Key
1. Click the "Delete Key" button in the extension header, OR
2. Manually via Chrome DevTools:
   - Open Chrome DevTools (F12)
   - Go to Application → Storage → Local Storage
   - Find your extension ID → Delete `openaiApiKey`

### If Your Computer Gets Compromised
1. Immediately revoke the key in your OpenAI dashboard: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new key if needed

## Contact

If you have questions about this privacy policy, please contact:
- **Email:** codefolio.work@gmail.com
- **LinkedIn:** [https://www.linkedin.com/in/jonamichahammo](https://www.linkedin.com/in/jonamichahammo)

## Changes to This Policy

We may update this privacy policy from time to time. The "Last Updated" date at the top of this policy will reflect the most recent changes.

## Summary

**The extension creator does NOT store your data. Your API key and all data are stored locally on your computer only. The extension creator has no access to your API key, your OpenAI account, or any data you process with this extension.**


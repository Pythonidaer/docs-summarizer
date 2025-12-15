import { showPrompt, showAlert } from "../ui/modal";

// ------------ API key storage helpers --------------

async function getApiKey(): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get(["openaiApiKey"], (result: {openaiApiKey?: string}) => {
            // Explicitly coerce undefined -> null
            resolve(result.openaiApiKey ?? null);
        });
    });
}

async function setApiKey(key: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({ openaiApiKey: key }, () => resolve());
    });
}

// Delete API key from storage
export async function deleteApiKey(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(["openaiApiKey"], () => resolve());
    });
}

// Ask user on first use if key is missing
export async function ensureApiKey(): Promise<string | null> {
    const existing = await getApiKey();
    if (existing) return existing;

    const entered = await showPrompt(
        "Docs Summarizer helps you quickly understand documentation pages by providing AI-powered summaries and answering your questions about the content.\n\nTo get started, paste your OpenAI API key into the input below:\n\n⚠️ **Security Notice**: Your key will be stored locally in Chrome for this extension only, and is only sent to OpenAI's API. You can always access security information by clicking the info icon next to the \"Delete Key\" button.",
        "sk-...",
        "Welcome to Docs Summarizer"
    );
    
    if (!entered || !entered.trim()) {
        await showAlert("No API key entered. Cannot call OpenAI.", "API Key Required");
        return null;
    }

    const trimmed = entered.trim();
    await setApiKey(trimmed);
    return trimmed;
}
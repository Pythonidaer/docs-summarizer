import { showPrompt, showAlert } from "../ui/modal";

// ------------ API key storage helpers --------------

async function getApiKey(): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["openaiApiKey"], (result: {openaiApiKey?: string}) => {
            // Explicitly coerce undefined -> null
            resolve(result.openaiApiKey ?? null);
        });
    });
}

async function setApiKey(key: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ openaiApiKey: key }, () => resolve());
    });
}

// Ask user on first use if key is missing
export async function ensureApiKey(): Promise<string | null> {
    const existing = await getApiKey();
    if (existing) return existing;

    const entered = await showPrompt(
        "Enter your OpenAI API key (will be stored in Chrome for this extension only):",
        "sk-..."
    );
    
    if (!entered || !entered.trim()) {
        await showAlert("No API key entered. Cannot call OpenAI.", "API Key Required");
        return null;
    }

    const trimmed = entered.trim();
    await setApiKey(trimmed);
    return trimmed;
}
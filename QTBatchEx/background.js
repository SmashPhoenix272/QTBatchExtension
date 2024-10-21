const SERVER_URL = 'http://localhost:2210/translate_batch'; // Updated to use the batch translation endpoint

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateBatch") {
        fetch(SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ texts: request.texts }),
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ translatedTexts: data.translatedTexts });
        })
        .catch(error => {
            console.error('Error:', error);
            sendResponse({ error: 'Translation failed' });
        });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.action === "startAutoConvert") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "startAutoConvert"});
        });
    } else if (request.action === "stopAutoConvert") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "stopAutoConvert"});
        });
    }
});

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ autoConvert: false });
});

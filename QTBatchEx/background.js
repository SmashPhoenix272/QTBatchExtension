chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateBatch") {
        chrome.storage.sync.get('serverAddress', function(data) {
            const serverAddress = data.serverAddress || 'http://localhost:2210';
            const SERVER_URL = `${serverAddress}/translate_batch`;

            fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ texts: request.texts }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.translatedTexts || data.translatedTexts.length !== request.texts.length) {
                    throw new Error('Invalid response from server');
                }
                sendResponse({ translatedTexts: data.translatedTexts });
            })
            .catch(error => {
                console.error('Error:', error);
                sendResponse({ error: `Translation failed: ${error.message}` });
            });
        });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.action === "updateAutoConvert") {
        chrome.storage.sync.set({ autoConvert: request.enabled }, () => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateAutoConvert",
                        enabled: request.enabled
                    });
                }
            });
        });
    }
});

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ 
        autoConvert: false,
        serverAddress: 'http://localhost:2210'
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error setting initial state:', chrome.runtime.lastError);
        } else {
            console.log('Extension state initialized successfully');
        }
    });
});

// Listen for changes in the extension's enabled state
chrome.management.onEnabled.addListener((info) => {
    if (info.id === chrome.runtime.id) {
        console.log('Extension enabled');
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "extensionEnabled"});
            }
        });
    }
});

// Listen for navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0) {  // Only for main frame
        chrome.storage.sync.get('autoConvert', (data) => {
            chrome.tabs.sendMessage(details.tabId, {
                action: "updateAutoConvert",
                enabled: data.autoConvert
            });
        });
    }
});

// Listen for DOM content loaded
chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
    if (details.frameId === 0) {  // Only for main frame
        chrome.storage.sync.get('autoConvert', (data) => {
            chrome.tabs.sendMessage(details.tabId, {
                action: "updateAutoConvert",
                enabled: data.autoConvert
            });
        });
    }
});

// Function to chunk array into smaller arrays
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Queue to maintain order of translations
class TranslationQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    enqueue(item) {
        this.queue.push(item);
        if (!this.processing) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }

        this.processing = true;
        const item = this.queue.shift();
        await item.process();
        this.processQueue();
    }
}

const translationQueue = new TranslationQueue();

// Store original text content
const originalTextMap = new Map();

// Flag to temporarily disable auto-convert
let autoConvertPaused = false;

function detectAndReplaceChinese(rootNode = document.body) {
    const textNodes = [];
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeValue.trim() !== '' && /[\u4e00-\u9fa5]/.test(node.nodeValue) && 
            (!node.parentElement || !node.parentElement.hasAttribute('data-translated'))) {
            textNodes.push(node);
            // Store original text
            originalTextMap.set(node, node.nodeValue);
        }
    }

    // Process text nodes in batches of 10
    const batches = chunkArray(textNodes, 10);

    batches.forEach((batch, batchIndex) => {
        const textsToTranslate = batch.map(node => node.nodeValue);

        translationQueue.enqueue({
            process: () => new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: "translateBatch",
                    texts: textsToTranslate,
                    batchIndex: batchIndex
                }, response => {
                    if (response && response.translatedTexts) {
                        batch.forEach((node, index) => {
                            try {
                                node.nodeValue = response.translatedTexts[index];
                                if (node.parentElement) {
                                    node.parentElement.setAttribute('data-translated', 'true');
                                }
                            } catch (error) {
                                console.error('Error updating node:', error);
                            }
                        });
                    }
                    resolve();
                });
            })
        });
    });
}

function revertTranslation(revertDelay) {
    autoConvertPaused = true;
    originalTextMap.forEach((originalText, node) => {
        if (node.parentElement && node.parentElement.hasAttribute('data-translated')) {
            node.nodeValue = originalText;
            node.parentElement.removeAttribute('data-translated');
        }
    });
    originalTextMap.clear();
    
    // Re-enable auto-convert after the specified delay
    setTimeout(() => {
        autoConvertPaused = false;
    }, revertDelay);
}

// MutationObserver to watch for DOM changes
const observer = new MutationObserver((mutations) => {
    if (autoConvertPaused) return;
    
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    detectAndReplaceChinese(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    detectAndReplaceChinese(node.parentNode);
                }
            });
        }
    });
});

function startObserver() {
    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
    observer.disconnect();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "manualConvert") {
        detectAndReplaceChinese();
    } else if (request.action === "revert") {
        revertTranslation(request.revertDelay);
    }
});

chrome.storage.sync.get('autoConvert', function(data) {
    if (data.autoConvert) {
        detectAndReplaceChinese();
        startObserver();
    }
});

// Listen for changes to autoConvert setting
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes.autoConvert) {
        if (changes.autoConvert.newValue) {
            detectAndReplaceChinese();
            startObserver();
        } else {
            stopObserver();
        }
    }
});

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

function detectAndReplaceChinese() {
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeValue.trim() !== '' && /[\u4e00-\u9fa5]/.test(node.nodeValue)) {
            textNodes.push(node);
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
                            node.nodeValue = response.translatedTexts[index];
                        });
                    }
                    resolve();
                });
            })
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "manualConvert") {
        detectAndReplaceChinese();
    }
});

chrome.storage.sync.get('autoConvert', function(data) {
    if (data.autoConvert) {
        detectAndReplaceChinese();
    }
});

// Listen for changes to autoConvert setting
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes.autoConvert && changes.autoConvert.newValue) {
        detectAndReplaceChinese();
    }
});

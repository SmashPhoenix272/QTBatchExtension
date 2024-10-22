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

// Flag to control auto-convert functionality
let autoConvertEnabled = false;

// Flag to temporarily disable auto-convert
let autoConvertPaused = false;

function detectAndReplaceChinese(rootNode = document.body, isHoverContent = false, isManualConvert = false) {
    if ((!autoConvertEnabled || autoConvertPaused) && !isManualConvert) return;

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
                            updateNode(node, response.translatedTexts[index], isHoverContent);
                        });
                    }
                    resolve();
                });
            })
        });
    });
}

function updateNode(node, translation, isHoverContent) {
    try {
        node.nodeValue = translation;
        if (node.parentElement) {
            node.parentElement.setAttribute('data-translated', 'true');
            if (isHoverContent) {
                node.parentElement.setAttribute('data-hover-translated', 'true');
            }
        }
    } catch (error) {
        console.error('Error updating node:', error);
    }
}

function revertTranslation(revertDelay) {
    autoConvertPaused = true;
    originalTextMap.forEach((originalText, node) => {
        if (node.parentElement && node.parentElement.hasAttribute('data-translated')) {
            node.nodeValue = originalText;
            node.parentElement.removeAttribute('data-translated');
            node.parentElement.removeAttribute('data-hover-translated');
        }
    });
    originalTextMap.clear();
    
    // Re-enable auto-convert after the specified delay
    setTimeout(() => {
        autoConvertPaused = false;
        if (autoConvertEnabled) {
            detectAndReplaceChinese();
        }
    }, revertDelay);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Improved function to handle hover events
function handleHover(event) {
    if (!autoConvertEnabled || autoConvertPaused) return;

    const target = event.target;

    // Check for any newly visible elements
    const hoverContent = document.elementsFromPoint(event.clientX, event.clientY);
    hoverContent.forEach(element => {
        detectAndReplaceChinese(element, true);
    });

    // Check for title attribute
    if (target.title && /[\u4e00-\u9fa5]/.test(target.title)) {
        const originalTitle = target.title;
        chrome.runtime.sendMessage({
            action: "translateBatch",
            texts: [originalTitle],
            batchIndex: 0
        }, response => {
            if (response && response.translatedTexts) {
                target.title = response.translatedTexts[0];
                target.setAttribute('data-original-title', originalTitle);
                target.setAttribute('data-hover-translated', 'true');
            }
        });
    }
}

// Debounced hover handler
const debouncedHandleHover = debounce(handleHover, 100);

// MutationObserver to watch for DOM changes
const observer = new MutationObserver((mutations) => {
    if (!autoConvertEnabled || autoConvertPaused) return;
    
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    detectAndReplaceChinese(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    detectAndReplaceChinese(node.parentNode);
                }
            });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
            const target = mutation.target;
            if (target.title && /[\u4e00-\u9fa5]/.test(target.title) && !target.hasAttribute('data-hover-translated')) {
                handleHover({ target: target, clientX: 0, clientY: 0 });
            }
        }
    });
});

function startObserver() {
    observer.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['title'] 
    });
    // Add event listeners for hover
    document.body.addEventListener('mouseover', debouncedHandleHover, true);
}

function stopObserver() {
    observer.disconnect();
    document.body.removeEventListener('mouseover', debouncedHandleHover, true);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "manualConvert") {
        detectAndReplaceChinese(document.body, false, true);
    } else if (request.action === "revert") {
        revertTranslation(request.revertDelay);
    } else if (request.action === "updateAutoConvert") {
        autoConvertEnabled = request.enabled;
        if (autoConvertEnabled) {
            detectAndReplaceChinese();
            startObserver();
        } else {
            stopObserver();
        }
    }
});

// Function to handle dynamically loaded content
function handleDynamicContent() {
    if (autoConvertEnabled && !autoConvertPaused) {
        detectAndReplaceChinese(document.body, true);
    }
}

// Set up a MutationObserver for dynamic content
const dynamicContentObserver = new MutationObserver(handleDynamicContent);

// Function to initialize the extension
function initializeExtension() {
    chrome.storage.sync.get('autoConvert', function(data) {
        autoConvertEnabled = data.autoConvert;
        if (autoConvertEnabled) {
            detectAndReplaceChinese();
            startObserver();
            dynamicContentObserver.observe(document.body, { childList: true, subtree: true });
        }
    });
}

// Initialize the extension when the content script loads
initializeExtension();

// Re-initialize on page loads (for single-page applications)
window.addEventListener('load', initializeExtension);

// We've removed the setInterval call to avoid repeated initializations

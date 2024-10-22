document.addEventListener('DOMContentLoaded', function() {
    const autoConvertCheckbox = document.getElementById('autoConvert');
    const convertBtn = document.getElementById('convertBtn');
    const revertBtn = document.getElementById('revertBtn');
    const serverStatus = document.getElementById('serverStatus');
    const serverAddressInput = document.getElementById('serverAddress');
    const refreshBtn = document.getElementById('refreshBtn');
    const revertDelayInput = document.getElementById('revertDelay');

    // Load saved state
    chrome.storage.sync.get(['autoConvert', 'serverAddress', 'revertDelay'], function(data) {
        autoConvertCheckbox.checked = data.autoConvert || false;
        serverAddressInput.value = data.serverAddress || 'http://localhost:2210';
        revertDelayInput.value = data.revertDelay || 15000; // Default to 15 seconds
        updateButtonStates();
    });

    // Save state when checkbox is toggled
    autoConvertCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({autoConvert: this.checked}, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving autoConvert state:', chrome.runtime.lastError);
                return;
            }
            chrome.runtime.sendMessage({
                action: "updateAutoConvert",
                enabled: autoConvertCheckbox.checked
            });
            updateButtonStates();
        });
    });

    // Save server address when it's changed
    serverAddressInput.addEventListener('change', function() {
        chrome.storage.sync.set({serverAddress: this.value}, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving server address:', chrome.runtime.lastError);
                return;
            }
            checkServerConnection();
        });
    });

    // Save revert delay when it's changed
    revertDelayInput.addEventListener('change', function() {
        chrome.storage.sync.set({revertDelay: parseInt(this.value) || 15000}, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving revert delay:', chrome.runtime.lastError);
            }
        });
    });

    // Handle manual convert button click
    convertBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "manualConvert"});
            }
        });
    });

    // Handle revert button click
    revertBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "revert",
                    revertDelay: parseInt(revertDelayInput.value) || 15000
                });
            }
        });
    });

    // Handle refresh button click
    refreshBtn.addEventListener('click', function() {
        checkServerConnection();
    });

    // Check server connection
    function checkServerConnection() {
        chrome.storage.sync.get('serverAddress', function(data) {
            const serverAddress = data.serverAddress || 'http://localhost:2210';
            serverStatus.innerHTML = '<span class="status-icon">&#8987;</span><span>Checking connection...</span>';
            serverStatus.classList.remove('connected', 'disconnected');
            
            fetch(`${serverAddress}/ping`, { mode: 'no-cors' })
                .then(response => {
                    if (response.type === 'opaque') {
                        // Assume connection is successful for no-cors mode
                        return { status: 'ok' };
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'ok') {
                        serverStatus.innerHTML = '<span class="status-icon connected">&#10004;</span><span>Server Connected</span>';
                        serverStatus.classList.remove('disconnected');
                        serverStatus.classList.add('connected');
                    } else {
                        throw new Error('Server not responding correctly');
                    }
                })
                .catch(error => {
                    console.error('Server connection error:', error);
                    serverStatus.innerHTML = '<span class="status-icon disconnected">&#10060;</span><span>Server Disconnected</span>';
                    serverStatus.classList.remove('connected');
                    serverStatus.classList.add('disconnected');
                });
        });
    }

    function updateButtonStates() {
        if (autoConvertCheckbox.checked) {
            convertBtn.disabled = true;
            revertBtn.disabled = false;
        } else {
            convertBtn.disabled = false;
            revertBtn.disabled = true;
        }
    }

    // Check server connection when popup opens
    checkServerConnection();

    // Check server connection every 5 seconds
    setInterval(checkServerConnection, 5000);

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "updatePopup") {
            checkServerConnection();
            updateButtonStates();
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const autoConvertCheckbox = document.getElementById('autoConvert');
    const convertBtn = document.getElementById('convertBtn');
    const serverStatus = document.getElementById('serverStatus');
    const serverAddressInput = document.getElementById('serverAddress');

    // Load saved state
    chrome.storage.sync.get(['autoConvert', 'serverAddress'], function(data) {
        autoConvertCheckbox.checked = data.autoConvert || false;
        serverAddressInput.value = data.serverAddress || 'http://localhost:2210';
    });

    // Save state when checkbox is toggled
    autoConvertCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({autoConvert: this.checked});
        if (this.checked) {
            chrome.runtime.sendMessage({action: "startAutoConvert"});
        } else {
            chrome.runtime.sendMessage({action: "stopAutoConvert"});
        }
    });

    // Save server address when it's changed
    serverAddressInput.addEventListener('change', function() {
        chrome.storage.sync.set({serverAddress: this.value});
        checkServerConnection();
    });

    // Handle manual convert button click
    convertBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "manualConvert"});
        });
    });

    // Check server connection
    function checkServerConnection() {
        chrome.storage.sync.get('serverAddress', function(data) {
            const serverAddress = data.serverAddress || 'http://localhost:2210';
            fetch(`${serverAddress}/ping`)
                .then(response => response.json())
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
                    serverStatus.innerHTML = '<span class="status-icon disconnected">&#10060;</span><span>Server Disconnected</span>';
                    serverStatus.classList.remove('connected');
                    serverStatus.classList.add('disconnected');
                });
        });
    }

    // Check server connection when popup opens
    checkServerConnection();

    // Check server connection every 5 seconds
    setInterval(checkServerConnection, 5000);
});

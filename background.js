// Background Service Worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'FETCH_FILE') {
        fetch(request.url)
            .then(response => response.text())
            .then(text => {
                sendResponse({ success: true, data: text });
            })
            .catch(error => {
                console.error('Background fetch failed:', error);
                sendResponse({ success: false, error: error.toString() });
            });
        return true; // Keep the messaging channel open for async response
    }
});

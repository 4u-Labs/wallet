/**
 * 4U Elite Extension Framework - Common Utils
 * Unified for SecureON Wallet WebApp & Extension
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Process i18n safely
    processI18n();

    // 2. Sync Current Year
    const yearEl = document.querySelector('.current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // 3. Handle Close Window Buttons
    document.querySelectorAll('.btn-close-window').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.close();
            }
        });
    });
});

function processI18n() {
    if (typeof chrome === 'undefined' || !chrome.i18n || typeof chrome.i18n.getMessage !== 'function') {
        return;
    }
    document.querySelectorAll('[data-i18n]').forEach(el => {
        try {
            const key = el.getAttribute('data-i18n');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                if (el.tagName === 'INPUT' && (el.type === 'placeholder' || el.type === 'text')) {
                    el.placeholder = message;
                } else {
                    el.textContent = message;
                }
            }
        } catch (e) {
            // ignore i18n errors in web context
        }
    });
}

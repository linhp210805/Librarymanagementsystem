/**
 * ui.js - Managed UI components like Toast notifications
 */

/**
 * Hiển thị thông báo (Toast)
 * @param {string} type - 'success', 'error', 'info'
 */

function showToast(type, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    if (type === 'error') icon = 'bx-x-circle';

    const duration = 4000; // 4 seconds

    toast.innerHTML = `
        <i class='bx ${icon}'></i>
        <div class="toast-message">${message}</div>
        <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// Map Django message tag → toast type
function djangoTagToToastType(classList) {
    if (classList.contains('success')) return 'success';
    if (classList.contains('error') || classList.contains('danger')) return 'error';
    if (classList.contains('warning')) return 'error';
    return 'info';
}

// Global initialization
document.addEventListener('DOMContentLoaded', function() {
    // Convert Django messages thành toast đúng màu
    const djangoMessages = document.querySelectorAll('.message-box');
    djangoMessages.forEach(msg => {
        const text = msg.innerText.trim();
        if (text) {
            const type = djangoTagToToastType(msg.classList);
            showToast(type, text);
            msg.style.display = 'none';
        }
    });
});

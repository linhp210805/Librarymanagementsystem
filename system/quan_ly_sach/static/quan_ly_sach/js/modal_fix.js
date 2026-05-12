// Fix cho openCancelModal - Tự động tìm modal đang mở
window.openCancelModal = function(modalId) {
    // Nếu không truyền modalId, tự động tìm modal đang mở
    if (!modalId) {
        // Tìm modal đang mở
        const modals = ['addBookModal', 'editBookModal', 'copyModal', 'detailModal'];
        for (let modal of modals) {
            const element = document.getElementById(modal);
            if (element && element.style.display === 'flex') {
                currentModalId = modal;
                break;
            }
        }
    } else {
        currentModalId = modalId;
    }

    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.style.display = 'flex';
};

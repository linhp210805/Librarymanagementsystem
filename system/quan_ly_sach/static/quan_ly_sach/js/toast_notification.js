class ToastNotification {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            document.body.appendChild(this.container);
        }
    }

    show(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon-circle"><i class='bx bx-check'></i></div>
                <span class="toast-msg">${message}</span>
            </div>
        `;
        this.container.appendChild(toast);

        // Tăng thời gian hiển thị lên 5 giây cho dễ nhìn
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }
}

const toastNotify = new ToastNotification();

// SỬA TẠI ĐÂY: Không hiện ngay mà lưu lại
window.showSuccess = function(message) {
    sessionStorage.setItem('pendingToast', message);
};

// Tự động kiểm tra khi trang load xong
document.addEventListener('DOMContentLoaded', function() {
    const pendingMsg = sessionStorage.getItem('pendingToast');
    if (pendingMsg) {
        toastNotify.show(pendingMsg);
        sessionStorage.removeItem('pendingToast'); // Hiện xong thì xóa cho sạch
    }
});
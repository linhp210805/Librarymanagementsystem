console.log('--- BOOK LIST JS LOADED ---');

/* =========================
   1. URL HELPER
========================= */
window.updateURL = function(param = '') {
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + param;
    window.history.pushState({ path: newUrl }, '', newUrl);
};

/* =========================
   2. MODAL CONTROL
========================= */

// 👉 MỞ MODAL THÊM
window.openAddModal = function() {
    const modal = document.getElementById('addBookModal');
    const form = document.getElementById('addBookForm');

    if (modal) {
        if (form) form.reset();
        modal.style.display = 'flex';
    }
};

// 👉 MỞ MODAL SỬA
window.editBook = function(id, title, author, type, pub, year, qty) {
    const modal = document.getElementById('editBookModal');

    if (!modal) return;

    document.getElementById('editBookId').value = id;
    document.getElementById('editOriginalId').value = id;
    document.getElementById('editBookTitle').value = title;
    document.getElementById('editBookAuthor').value = author;
    document.getElementById('editBookType').value = type;
    document.getElementById('editBookPublisher').value = pub;
    document.getElementById('editBookYear').value = year;
    document.getElementById('editBookQty').value = qty;

    const subtitle = document.getElementById('editModalSubtitle');
    if (subtitle) {
        subtitle.innerHTML = `Cập nhật thông tin sách <strong>${id}</strong>`;
    }

    modal.style.display = 'flex';
};
/* =========================
   KIỂM TRA LOGIC THÊM MỚI (ADD)
========================= */
document.addEventListener('DOMContentLoaded', function() {
    const addForm = document.getElementById('addBookForm');
    if (!addForm) return;

    addForm.addEventListener('submit', function(e) {
        // 1. Reset trạng thái lỗi trước khi kiểm tra
        document.querySelectorAll('.error-msg').forEach(el => el.innerText = '');
        document.querySelectorAll('input').forEach(el => el.classList.remove('invalid'));

        const currentYear = new Date().getFullYear();
        const regexChar = /[a-zA-ZÀ-ỹ]/;

        // Hàm kiểm tra và dừng lại ngay khi gặp lỗi đầu tiên
        function validateField(inputId, errId, condition, message) {
            const input = document.getElementById(inputId);
            const errElement = document.getElementById(errId);

            if (!condition) {
                errElement.innerText = message;
                input.classList.add('invalid');
                input.focus();
                return false; // Trả về false để báo hiệu có lỗi
            }
            return true; // Trả về true nếu hợp lệ
        }

        // --- KIỂM TRA THEO THỨ TỰ (Sử dụng cấu trúc if-else) ---

        // 1. Tên sách
        const title = document.getElementById('addBookTitle').value.trim();
        if (!validateField('addBookTitle', 'err-title', regexChar.test(title),
            'Tên sách không hợp lệ. Vui lòng nhập tên sách không chỉ chứa số hoặc ký tự đặc biệt.')) {
            e.preventDefault();
            return; // Dừng toàn bộ hàm, không kiểm tra các ô bên dưới
        }

        // 2. Tác giả
        const author = document.getElementById('addBookAuthor').value.trim();
        if (!validateField('addBookAuthor', 'err-author', regexChar.test(author),
            'Tên tác giả không hợp lệ. Vui lòng nhập tên tác giả không chỉ chứa số hoặc ký tự đặc biệt.')) {
            e.preventDefault();
            return;
        }

        // 3. Thể loại
        const category = document.getElementById('addBookType').value.trim();
        if (!validateField('addBookType', 'err-type', regexChar.test(category),
            'Thể loại không hợp lệ. Vui lòng nhập thể loại có ít nhất một ký tự chữ cái.')) {
            e.preventDefault();
            return;
        }

        // 4. Nhà xuất bản
        const publisher = document.getElementById('addBookPublisher').value.trim();
        if (!validateField('addBookPublisher', 'err-publisher', regexChar.test(publisher),
            'Tên NXB không hợp lệ. Vui lòng nhập tên NXB không chỉ chứa số hoặc ký tự đặc biệt.')) {
            e.preventDefault();
            return;
        }

        // 5. Năm xuất bản
        const yearValue = document.getElementById('addBookYear').value;
        const year = parseInt(yearValue);
        if (!validateField('addBookYear', 'err-year', (!isNaN(year) && year >= 1450 && year <= currentYear),
            `Năm NXB không hợp lệ. Vui lòng nhập năm từ 1450 đến ${currentYear}.`)) {
            e.preventDefault();
            return;
        }

        // 6. Số lượng
        const qtyValue = document.getElementById('addBookQty').value;
        const qty = parseInt(qtyValue);
        if (!validateField('addBookQty', 'err-qty', (!isNaN(qty) && qty > 0),
            'Số lượng không hợp lệ. Vui lòng nhập số lượng lớn hơn 0.')) {
            e.preventDefault();
            return;
        }
    });
});
/* =========================
   KIỂM TRA LOGIC CHỈNH SỬA (EDIT)
========================= */
document.getElementById('editBookForm').addEventListener('submit', function(e) {
    let isValid = true;
    const currentYear = new Date().getFullYear();
    const regexChar = /[a-zA-ZÀ-ỹ]/;

    this.querySelectorAll('.error-msg').forEach(el => el.innerText = '');
    this.querySelectorAll('input').forEach(el => el.classList.remove('invalid'));

    function showError(inputId, errId, message) {
        if (isValid) {
            const input = document.getElementById(inputId);
            const errSpan = document.getElementById(errId);
            if (errSpan) errSpan.innerText = message;
            if (input) {
                input.classList.add('invalid');
                input.focus();
            }
            isValid = false;
        }
    }

    // Logic kiểm tra giống hệt Add, nhưng dùng ID của Edit Modal
    if (!regexChar.test(document.getElementById('editBookTitle').value)) {
        showError('editBookTitle', 'err-edit-title', 'Tên sách không hợp lệ. Vui lòng nhập tên sách không chỉ chứa số hoặc ký tự đặc biệt.');
    }
    if (!regexChar.test(document.getElementById('editBookAuthor').value)) {
        showError('editBookAuthor', 'err-edit-author', 'Tên tác giả không hợp lệ. Vui lòng nhập tên tác giả không chỉ chứa số hoặc ký tự đặc biệt.');
    }
    if (!regexChar.test(document.getElementById('editBookType').value)) {
        showError('editBookType', 'err-edit-type', 'Thể loại không hợp lệ. Vui lòng nhập thể loại có ít nhất một ký tự chữ cái.');
    }
    if (!regexChar.test(document.getElementById('editBookPublisher').value)) {
        showError('editBookPublisher', 'err-edit-publisher', 'Tên NXB không hợp lệ. Vui lòng nhập tên NXB không chỉ chứa số hoặc ký tự đặc biệt.');
    }
    const year = parseInt(document.getElementById('editBookYear').value);
    if (isNaN(year) || year < 1450 || year > currentYear) {
        showError('editBookYear', 'err-edit-year', `Năm NXB không hợp lệ. Vui lòng nhập năm từ 1450 đến ${currentYear}.`);
    }
    const qty = parseInt(document.getElementById('editBookQty').value);
    if (isNaN(qty) || qty <= 0) {
        showError('editBookQty', 'err-edit-qty', 'Số lượng không hợp lệ. Vui lòng nhập số lượng lớn hơn 0.');
    }

    if (!isValid) e.preventDefault();
});
/* =========================
   3. VIEW DETAIL
========================= */
window.viewDetail = function(id, title, author, type, pub, year, availableQty, totalQty) {
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('bookDetailContent');

    if (!modal || !content) return;

    const status = parseInt(availableQty) > 0 ? 'Sẵn sàng' : 'Hết sách';
    const quantityDisplay = `
        <b style="color: ${parseInt(availableQty) > 0 ? '#1e293b' : '#ef4444'};">${availableQty}</b>
        /
        <span style="font-weight: 500;">${totalQty}</span>
    `;

    content.innerHTML = `
        <div class="detail-info">
            <div class="detail-item">
                <label>Mã sách</label>
                <span>${id}</span>
            </div>
            <div class="detail-item">
                <label>Trạng thái</label>
                <span class="status-badge">${status}</span>
            </div>
            <div class="detail-item">
                <label>Tên sách</label>
                <span>${title}</span>
            </div>
            <div class="detail-item">
                <label>Thể loại</label>
                <span>${type}</span>
            </div>
            <div class="detail-item">
                <label>Tác giả</label>
                <span>${author}</span>
            </div>
            <div class="detail-item">
                <label>Năm xuất bản</label>
                <span>${year}</span>
            </div>
            <div class="detail-item">
                <label>Nhà xuất bản</label>
                <span>${pub}</span>
            </div>
            <div class="detail-item">
                <label>Số lượng (Có sẵn / Tổng)</label>
                <span>${quantityDisplay}</span>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

/* =========================
   4. DELETE
========================= */
window.requestDelete = function(id) {
    const modal = document.getElementById('deleteConfirmModal');
    const input = document.getElementById('deleteBookId');

    if (!modal || !input) {
        console.error("❌ Không tìm thấy modal xóa");
        return;
    }

    input.value = id;

    const title = modal.querySelector('.confirm-title');
    const desc = modal.querySelector('.confirm-desc');

    if (title) title.innerText = "Xác nhận xóa?";
    if (desc) desc.innerText = `Bạn có chắc muốn xóa sách ${id}?`;

    modal.style.display = 'flex';
};

window.closeDeleteModal = function() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.style.display = 'none';
};

/* =========================
   5. COPY
/* =========================
   XỬ LÝ MODAL THÊM BẢN SAO
   ========================= */
window.openCopyModal = function(id, title) {
    const modal = document.getElementById('copyModal');

    // 1. Gán vào thẻ hiện ra cho bạn thấy
    document.getElementById('copyBookInfo').value = id + " - " + title;

    // 2. Gán vào thẻ ẨN để gửi về Django (BẮT BUỘC)
    document.getElementById('copyBookId').value = id;

    modal.style.display = 'flex';
};

window.submitCopy = function() {
    const qtyInput = document.getElementById('copyQty');
    const form = document.getElementById('addCopiesForm');
    const btnSave = document.querySelector('#copyModal .btn-save'); // Lấy nút xác nhận
    const qty = parseInt(qtyInput.value);

    if (!qty || qty <= 0) {
        document.getElementById('err-copy-qty').innerText = "Vui lòng nhập số > 0";
        return;
    }

    if (form) {
        // Vô hiệu hóa nút để tránh double-click
        btnSave.innerText = "Đang xử lý...";
        btnSave.style.opacity = "0.5";
        btnSave.style.pointerEvents = "none";

        form.submit();
    }
};

// Đóng modal khi click ra ngoài
window.onclick = function(event) {
    const modal = document.getElementById('copyModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};
/* =========================
   6. CANCEL (OPTIMIZED)
========================= */

// lưu modal đang mở
let currentModalId = null;

// 👉 MỞ popup xác nhận hủy
window.openCancelModal = function(modalId) {
    currentModalId = modalId;

    const modal = document.getElementById('cancelConfirmModal');
    if (modal) modal.style.display = 'flex';
};

// 👉 ĐÓNG modal bất kỳ
window.closeSubModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};

// 👉 ĐÓNG TẤT CẢ modal
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => {
        m.style.display = 'none';
    });
}

// 👉 RESET form + input
function resetAllForms() {
    document.querySelectorAll('form').forEach(f => f.reset());

    const qtyInput = document.getElementById('copyQty');
    if (qtyInput) qtyInput.value = "";

    const errCopy = document.getElementById('err-copy-qty');
    if (errCopy) errCopy.innerText = "";
}

// 👉 XÁC NHẬN HỦY
window.confirmCancel = function() {
    // reset dữ liệu
    resetAllForms();

    // đóng toàn bộ modal
    closeAllModals();

    // reset state
    currentModalId = null;

    // quay về trang list
    window.location.href = '/books/';
};
/* =========================
   7. DEBUG CHECK
========================= */
console.log("✅ Functions ready:", {
    viewDetail: typeof window.viewDetail,
    requestDelete: typeof window.requestDelete
});

/* =========================
   TOAST NOTIFICATION SYSTEM
   Dùng showToast() từ ui.js (đã load trong base.html)
========================= */

window.showSuccess = function(message) {
    if (typeof showToast === 'function') {
        showToast('success', message);
    }
};

/* =================================================
   8. SEARCH SYSTEM (JS ONLY)
==================================================== */
window.searchBook = function() {
    // 1. Lấy giá trị từ ô nhập liệu
    let input = document.getElementById("searchInput");
    if (!input) return;

    let filter = input.value.toLowerCase();

    // 2. Lấy tất cả các dòng trong bảng (Tìm thẻ tbody tr để tránh lấy dòng tiêu đề)
    let table = document.querySelector("table tbody");
    if (!table) return;

    let tr = table.getElementsByTagName("tr");

    // 3. Lặp qua từng dòng để kiểm tra nội dung
    for (let i = 0; i < tr.length; i++) {
        let textContent = tr[i].textContent.toLowerCase();

        // Nếu dòng chứa từ khóa thì hiện, ngược lại thì ẩn
        if (textContent.includes(filter)) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
};
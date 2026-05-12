/* =========================================================
   book.js – Quản lý sách
   Dùng cho: templates/books/book_list.html
========================================================= */
console.log('--- DUE Library: Book Script Loaded v2 ---');

let books = JSON.parse(localStorage.getItem('due_library_books')) || [
    { id: "KT001", title: "Kinh tế học vi mô", author: "N. Gregory Mankiw", type: "Kinh tế học", publisher: "NXB Thống Kê", year: 2020, quantity: "7/10" },
    { id: "KT002", title: "Kinh tế vĩ mô", author: "N. Gregory Mankiw", type: "Kinh tế học", publisher: "NXB Thống Kê", year: 2020, quantity: "8/10" },
    { id: "TC001", title: "Nguyên lý kế toán", author: "Nguyễn Thị Mai", type: "Kế toán", publisher: "NXB Tài Chính", year: 2019, quantity: "5/8" },
    { id: "QT001", title: "Quản trị học", author: "Lê Văn Tâm", type: "Quản trị kinh doanh", publisher: "NXB Lao Động", year: 2021, quantity: "11/12" },
    { id: "MKT001", title: "Marketing căn bản", author: "Philip Kotler", type: "Marketing", publisher: "NXB Lao Động", year: 2018, quantity: "12/15" },
    { id: "TC002", title: "Tài chính doanh nghiệp", author: "Trần Văn Hùng", type: "Tài chính", publisher: "NXB Lao Động", year: 2022, quantity: "6/6" }
];

const tableBody = document.getElementById('bookTableBody');
const bookCount = document.getElementById('bookCount');
const bookModal = document.getElementById('bookModal');
const bookForm = document.getElementById('bookForm');

let currentDeleteIndex = -1;

function saveBooksToStorage() {
    localStorage.setItem('due_library_books', JSON.stringify(books));
}

function safeToast(message) {
    if (typeof showToast === 'function') {
        showToast('success', message);
        return;
    }

    const container = document.getElementById('toastContainer') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}

function getStatusBadge(quantity) {
    if (!quantity || !quantity.includes('/')) {
        return '<span class="badge badge-green-solid">Có sẵn</span>';
    }

    const parts = quantity.split('/');
    const available = parseInt(parts[0], 10) || 0;
    const total = parseInt(parts[1], 10) || 0;

    if (total === 0 || available === 0) {
        return '<span class="badge badge-orange-solid">Hết sách</span>';
    }

    if (available < total) {
        return '<span class="badge badge-blue-solid">Đang mượn</span>';
    }

    return '<span class="badge badge-green-solid">Có sẵn</span>';
}

function renderBooks(data = books) {
    if (!tableBody || !bookCount) return;

    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;">Không tìm thấy sách</td>
            </tr>
        `;
        bookCount.innerText = 'Hiển thị 0 quyển sách';
        return;
    }

    data.forEach((book, index) => {
        const row = `
            <tr>
                <td><strong>${book.id}</strong></td>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.type || ''}</td>
                <td>${book.publisher || ''}</td>
                <td>${book.year || ''}</td>
                <td>${book.quantity || ''}</td>
                <td>${getStatusBadge(book.quantity)}</td>
                <td class="col-action">
                    <div class="action-tools">
                        <i class="bx bx-info-circle" onclick="viewDetail(${index})" title="Chi tiết"></i>
                        <i class="bx bx-edit-alt" onclick="editBook(${index})" title="Chỉnh sửa"></i>
                        <i class="bx bx-trash" onclick="requestDelete(${index})" title="Xóa"></i>
                    </div>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    bookCount.innerText = `Hiển thị ${data.length} quyển sách`;
    saveBooksToStorage();
}

function viewDetail(index) {
    const book = books[index];
    if (!book) return;

    const content = `
        <p><strong>Mã sách:</strong> ${book.id}</p>
        <p><strong>Tên sách:</strong> ${book.title}</p>
        <p><strong>Tác giả:</strong> ${book.author}</p>
        <p><strong>Thể loại:</strong> ${book.type || ''}</p>
        <p><strong>Nhà xuất bản:</strong> ${book.publisher || ''}</p>
        <p><strong>Năm xuất bản:</strong> ${book.year || ''}</p>
        <p><strong>Số lượng:</strong> ${book.quantity || ''}</p>
    `;

    const detailContent = document.getElementById('bookDetailContent');
    const detailModal = document.getElementById('detailModal');

    if (detailContent) {
        detailContent.innerHTML = content;
    }

    if (detailModal) {
        detailModal.style.display = 'flex';
    }
}

function searchBook() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const term = input.value.toLowerCase().trim();

    const filtered = books.filter((b) =>
        b.title.toLowerCase().includes(term) ||
        b.id.toLowerCase().includes(term) ||
        b.author.toLowerCase().includes(term)
    );

    renderBooks(filtered);
}

function resetBooks() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
    }
    renderBooks();
}

function openAddModal() {
    const modalTitle = document.getElementById('modalTitle');
    const editIndex = document.getElementById('editIndex');

    if (modalTitle) modalTitle.innerText = 'Thêm sách';
    if (editIndex) editIndex.value = -1;
    if (bookForm) bookForm.reset();
    if (bookModal) bookModal.style.display = 'flex';
}

function editBook(index) {
    const book = books[index];
    if (!book) return;

    document.getElementById('modalTitle').innerText = 'Chỉnh sửa';
    document.getElementById('editIndex').value = index;

    document.getElementById('bookId').value = book.id;
    document.getElementById('bookTitle').value = book.title;
    document.getElementById('bookAuthor').value = book.author;
    document.getElementById('bookType').value = book.type || '';
    document.getElementById('bookPublisher').value = book.publisher || '';
    document.getElementById('bookYear').value = book.year || '';
    document.getElementById('bookQty').value = book.quantity || '';

    if (bookModal) {
        bookModal.style.display = 'flex';
    }
}

function closeModal() {
    if (bookModal) {
        bookModal.style.display = 'none';
    }
}

function handleCancelClick() {
    const cancelModal = document.getElementById('cancelConfirmModal');
    if (cancelModal) {
        cancelModal.style.display = 'flex';
    }
}

function confirmCancel() {
    closeSubModal('cancelConfirmModal');
    closeModal();
}

function requestDelete(index) {
    currentDeleteIndex = index;
    const deleteModal = document.getElementById('deleteConfirmModal');
    if (deleteModal) {
        deleteModal.style.display = 'flex';
    }
}

function confirmDelete() {
    if (currentDeleteIndex > -1) {
        books.splice(currentDeleteIndex, 1);
        renderBooks();
        safeToast('Xóa thông tin sách thành công');
        closeSubModal('deleteConfirmModal');
        currentDeleteIndex = -1;
    }
}

if (bookForm) {
    bookForm.onsubmit = (e) => {
        e.preventDefault();

        const index = parseInt(document.getElementById('editIndex').value, 10);

        const bookData = {
            id: document.getElementById('bookId').value.trim(),
            title: document.getElementById('bookTitle').value.trim(),
            author: document.getElementById('bookAuthor').value.trim(),
            type: document.getElementById('bookType').value.trim(),
            publisher: document.getElementById('bookPublisher').value.trim(),
            year: document.getElementById('bookYear').value.trim(),
            quantity: document.getElementById('bookQty').value.trim()
        };

        if (!bookData.id || !bookData.title || !bookData.author) {
            return;
        }

        if (index === -1) {
            const duplicated = books.some((b) => b.id.toLowerCase() === bookData.id.toLowerCase());
            if (duplicated) {
                safeToast('Mã sách đã tồn tại');
                return;
            }
            books.unshift(bookData);
            safeToast('Thêm thông tin sách thành công');
        } else {
            books[index] = bookData;
            safeToast('Cập nhật thông tin sách thành công');
        }

        renderBooks();
        closeModal();
    };
}

function closeSubModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    }
}

window.viewDetail = viewDetail;
window.searchBook = searchBook;
window.openAddModal = openAddModal;
window.editBook = editBook;
window.handleCancelClick = handleCancelClick;
window.confirmCancel = confirmCancel;
window.requestDelete = requestDelete;
window.confirmDelete = confirmDelete;
window.closeSubModal = closeSubModal;

window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderBooks();
});
/* =========================================================
   user.js - Quan ly nguoi dung
   Chi xu ly modal chi tiet tren du lieu DB da render san
========================================================= */

const modal = document.getElementById('userModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const searchForm = document.getElementById('userSearchForm');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const filterStatus = document.getElementById('filterStatus');
const filterClass = document.getElementById('filterClass');
const tableBody = document.getElementById('userRowsBody');
const emptyStateRow = document.getElementById('emptyStateRow');
const tableContainer = document.querySelector('.table-container');
const readerDataUrlInput = document.getElementById('readerDataUrl');
const readerDataUrl = readerDataUrlInput ? readerDataUrlInput.value : '';

function updateTableScrollState(totalRows) {
    if (!tableContainer) return;
    tableContainer.classList.toggle('has-scroll', totalRows >= 5);
}

function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase();
}

function createUserRow(user, index) {
    const row = document.createElement('tr');
    row.className = 'user-data-row';
    row.innerHTML = `
        <td>${index}</td>
        <td>${user.id || ''}</td>
        <td>${user.name || ''}</td>
        <td><span class="tag">${user.role || ''}</span></td>
        <td>${user.class_name || ''}</td>
        <td>${user.graduation_status || ''}</td>
        <td>
            <button
                type="button"
                class="action-btn"
                onclick="openModal(this)"
                data-user-id="${user.id || ''}"
                data-user-name="${user.name || ''}"
                data-user-role="${user.role || ''}"
                data-user-email="${user.email || ''}"
                data-user-phone="${user.phone || ''}"
                data-user-class="${user.class_name || ''}"
                data-user-graduation="${user.graduation_status || ''}"
                data-user-borrowed="${user.borrowed_books || 0}"
                data-user-fine="${user.unpaid_fines || 0}"
                title="Xem chi tiết"
            >
                <i class="fa-regular fa-eye"></i>
            </button>
        </td>
    `;
    return row;
}

async function applyTableFilters() {
    if (!readerDataUrl || !tableBody || !emptyStateRow) return;

    const keyword = searchInput ? searchInput.value.trim() : '';
    const statusValue = filterStatus ? filterStatus.value : 'all';
    const classValue = filterClass ? filterClass.value : 'all';

    const params = new URLSearchParams();
    if (keyword) params.set('q', keyword);
    if (statusValue) params.set('status', statusValue);
    if (classValue) params.set('class', classValue);

    const url = params.toString() ? `${readerDataUrl}?${params.toString()}` : readerDataUrl;

    try {
        const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (!response.ok) {
            throw new Error('Khong the tai du lieu nguoi dung');
        }
        const payload = await response.json();
        const users = Array.isArray(payload.users) ? payload.users : [];

        tableBody.querySelectorAll('.user-data-row').forEach((row) => row.remove());

        if (users.length === 0) {
            emptyStateRow.style.display = 'table-row';
            updateTableScrollState(0);
            if (tableContainer) {
                tableContainer.scrollTop = 0;
            }
            return;
        }

        emptyStateRow.style.display = 'none';
        users.forEach((user, index) => {
            tableBody.appendChild(createUserRow(user, index + 1));
        });
        updateTableScrollState(users.length);
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    } catch (error) {
        emptyStateRow.style.display = 'table-row';
        updateTableScrollState(0);
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    }
}

window.openModal = function (trigger) {
    if (!modal || !trigger) return;

    const button = trigger.closest ? trigger.closest('button') : trigger;
    if (!button) return;

    document.getElementById('modalUserId').textContent = button.dataset.userId || '';
    document.getElementById('modalUserName').textContent = button.dataset.userName || '';
    document.getElementById('modalUserRole').textContent = button.dataset.userRole || '';
    document.getElementById('modalUserEmail').textContent = button.dataset.userEmail || '';
    document.getElementById('modalUserPhone').textContent = button.dataset.userPhone || '';
    document.getElementById('modalUserClass').textContent = button.dataset.userClass || '';
    document.getElementById('modalUserGraduation').textContent = button.dataset.userGraduation || '';
    document.getElementById('modalBooks').textContent = button.dataset.userBorrowed || '0';
    const fineValue = button.dataset.userFine || '0';
    document.getElementById('modalFine').textContent = fineValue + 'đ';

    modal.style.display = 'flex';
};

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void applyTableFilters();
    });
}

if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        void applyTableFilters();
    });
}

if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void applyTableFilters();
        }
    });
}

if (filterStatus) {
    filterStatus.addEventListener('change', () => {
        void applyTableFilters();
    });
}

if (filterClass) {
    filterClass.addEventListener('change', () => {
        void applyTableFilters();
    });
}

void applyTableFilters();


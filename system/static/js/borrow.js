/* ================================================================
   borrow.js – Quản lý mượn sách


================================================================ */
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('pmOverlay');
    const searchInput = document.getElementById('borrowSearchInput');
    const searchBtn = document.getElementById('borrowSearchBtn');
    const addBtn = document.getElementById('addBorrowBtn');
    const tableBody = document.getElementById('borrowTableBody');
    if (!tableBody) return;

    const borrowPermissions = window.borrowPermissions || {};
    const canDelete = !!borrowPermissions.canDelete;
    const canExtend = !!borrowPermissions.canExtend;

    let slips = [];

    async function fetchSlips() {
        try {
            const response = await fetch('/api/danh_sach_phieu_muon/');
            if (!response.ok) throw new Error('Network response was not ok');
            slips = await response.json();
            renderRows(slips);
        } catch (error) {
            console.error('Error fetching slips:', error);
            safeToast('error', 'Không thể tải danh sách phiếu mượn.');
            renderRows([]);
        }
    }

    let pendingDeleteId = null;
    let extLargeSlipId = null;
    let extSmallSlipId = null;
    let detailSlipId = null;

    /* ========================
       TOAST HELPER
    ======================== */
    function safeToast(type, message) {
        if (typeof showToast === 'function') {
            showToast(type, message);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /* ========================
       DATE HELPERS
    ======================== */
    function toIso(display) {
        if (!display || !display.includes('/')) return '';
        const parts = display.split('/');
        return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }

    function toDisplay(iso) {
        if (!iso || !iso.includes('-')) return iso || '';
        const parts = iso.split('-');
        return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
    }

    /* ========================
       POPUP HELPERS
    ======================== */
    function hideAllPopups() {
        document.querySelectorAll('.pm-modal, .pm-modal-sm').forEach(function (modal) {
            modal.style.display = 'none';
        });
    }

    function openPm(id) {
        if (!overlay) return;
        overlay.classList.add('open');
        hideAllPopups();
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    window.closePm = function () {
        if (overlay) {
            overlay.classList.remove('open');
        }
        hideAllPopups();
    };

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                window.closePm();
            }
        });
    }

    /* ========================
       RENDER TABLE
    ======================== */
    function renderRows(rows) {
        if (!rows.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;">
                        Không có dữ liệu
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = rows.map(function (s) {
            const actionButtons = [];
            if (canExtend) {
                actionButtons.push(`
                    <button class="icon-btn edit btn-edit" data-id="${s.id}" title="Gia hạn">
                        <i class="bx bx-calendar"></i>
                    </button>
                `);
            }
            if (canDelete) {
                actionButtons.push(`
                    <button class="icon-btn del btn-del" data-id="${s.id}" title="Xóa">
                        <i class="bx bx-trash"></i>
                    </button>
                `);
            }

            return `
                <tr data-id="${s.id}">
                    <td>${s.slipCode}</td>
                    <td>${s.userId}</td>
                    <td>${s.userName}</td>
                    <td>${s.borrowDate}</td>
                    <td>${s.dueDate}</td>
                    <td>
                        <span class="${s.statusClass}">${s.status}</span>
                    </td>
                    <td class="col-action">
                        ${actionButtons.length ? actionButtons.join('&nbsp;') : '<span style="color:#9ca3af;">-</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /* ========================
       SEARCH
    ======================== */
    function doSearch() {
        const keyword = (searchInput ? searchInput.value : '').toLowerCase().trim();

        if (!keyword) {
            renderRows(slips);
            return;
        }

        const filtered = slips.filter(function (s) {
            const hasKeywordInBooks = (s.books || []).some(function (b) {
                return (b.code || '').toLowerCase().includes(keyword) ||
                    (b.title || '').toLowerCase().includes(keyword);
            });

            return (
                (s.slipCode || '').toLowerCase().includes(keyword) ||
                (s.userId || '').toLowerCase().includes(keyword) ||
                (s.userName || '').toLowerCase().includes(keyword) ||
                (s.status || '').toLowerCase().includes(keyword) ||
                hasKeywordInBooks
            );
        });

        renderRows(filtered);

        if (filtered.length === 0) {
            safeToast('error', 'Không tìm thấy phiếu mượn');
        }
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', doSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keyup', function (e) {
            if (e.key === 'Enter') {
                doSearch();
            }
        });
    }

    /* ========================
       BOOK LIST RENDER
    ======================== */
    function renderBookList(containerId, books) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!books || !books.length) {
            container.innerHTML = `<div style="color:#9ca3af;padding:14px 0;">Không có sách</div>`;
            return;
        }

        container.innerHTML = books.map(function (book) {
            return `
                <div class="pm-list-row">
                    <div class="lcode">${book.code}</div>
                    <div class="ltitle">${book.title}</div>
                    <div class="lqty">${book.qty}</div>
                </div>
            `;
        }).join('');
    }

    /* ========================
       ADD BOOK ROW
    ======================== */
    window.addBookRow = function () {
        const body = document.getElementById('addBooksBody');
        if (!body) return;

        const row = document.createElement('div');
        row.className = 'pm-book-row';
        row.innerHTML = `
            <div class="pm-input-wrapper">
                <input class="pm-input book-code-input" type="text" placeholder="MS001-001" autocomplete="off">
                <div class="suggestion-box"></div>
            </div>
            <input class="pm-input book-title-input" type="text" placeholder="Tên sách" readonly>
            <input class="pm-input" type="number" min="1" value="1" readonly>
            <button class="btn-row-del" type="button" onclick="this.closest('.pm-book-row').remove()">×</button>
        `;
        body.appendChild(row);
    };

    // Book Autocomplete & Lookup Integration
    const addBooksBody = document.getElementById('addBooksBody');
    if (addBooksBody) {
        // Clear suggestions and title when input is empty
        addBooksBody.addEventListener('input', async function (e) {
            if (e.target.classList.contains('book-code-input')) {
                const input = e.target;
                const query = input.value.trim();
                const wrapper = input.closest('.pm-input-wrapper');
                const suggestBox = wrapper.querySelector('.suggestion-box');
                const row = input.closest('.pm-book-row');
                const titleInput = row.querySelector('.book-title-input');

                if (!query) {
                    suggestBox.style.display = 'none';
                    suggestBox.innerHTML = '';
                    titleInput.value = '';
                    return;
                }

                try {
                    const response = await fetch(`/api/tim_kiem_sach/?q=${query}`);
                    const data = await response.json();
                    
                    if (data.length > 0) {
                        suggestBox.innerHTML = data.map(item => `
                            <div class="suggestion-item" data-code="${item.code}" data-title="${item.title}">
                                <span>${item.code}</span>
                                <span class="s-title">${item.title}</span>
                            </div>
                        `).join('');
                        suggestBox.style.display = 'block';
                    } else {
                        suggestBox.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error fetching suggestions:', error);
                }
            }
        });

        // Show suggestions on focus if there's text
        addBooksBody.addEventListener('focusin', function (e) {
            if (e.target.classList.contains('book-code-input')) {
                // Trigger the input event logic
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Click selection
        addBooksBody.addEventListener('mousedown', function (e) {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                const code = item.getAttribute('data-code');
                const title = item.getAttribute('data-title');
                const wrapper = item.closest('.pm-input-wrapper');
                const input = wrapper.querySelector('.book-code-input');
                const row = input.closest('.pm-book-row');
                const titleInput = row.querySelector('.book-title-input');

                input.value = code;
                titleInput.value = title;
                wrapper.querySelector('.suggestion-box').style.display = 'none';
            }
        });

        // Hide suggestions on blur
        addBooksBody.addEventListener('focusout', function (e) {
            if (e.target.classList.contains('book-code-input')) {
                setTimeout(() => {
                    const wrapper = e.target.closest('.pm-input-wrapper');
                    if (wrapper) {
                        const suggestBox = wrapper.querySelector('.suggestion-box');
                        if (suggestBox) suggestBox.style.display = 'none';
                    }
                }, 200);
            }
        });

        // Keyboard navigation
        addBooksBody.addEventListener('keydown', function (e) {
            if (e.target.classList.contains('book-code-input')) {
                const wrapper = e.target.closest('.pm-input-wrapper');
                const suggestBox = wrapper.querySelector('.suggestion-box');
                
                if (suggestBox.style.display === 'block') {
                    const items = suggestBox.querySelectorAll('.suggestion-item');
                    let activeIndex = Array.from(items).findIndex(i => i.classList.contains('active'));

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (activeIndex < items.length - 1) {
                            if (activeIndex >= 0) items[activeIndex].classList.remove('active');
                            items[activeIndex + 1].classList.add('active');
                            items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
                        } else if (activeIndex === -1 && items.length > 0) {
                            items[0].classList.add('active');
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (activeIndex > 0) {
                            items[activeIndex].classList.remove('active');
                            items[activeIndex - 1].classList.add('active');
                            items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
                        }
                    } else if (e.key === 'Enter') {
                        if (activeIndex >= 0) {
                            e.preventDefault();
                            const item = items[activeIndex];
                            const code = item.getAttribute('data-code');
                            const title = item.getAttribute('data-title');
                            const input = wrapper.querySelector('.book-code-input');
                            const row = input.closest('.pm-book-row');
                            const titleInput = row.querySelector('.book-title-input');

                            input.value = code;
                            titleInput.value = title;
                            suggestBox.style.display = 'none';
                        }
                    } else if (e.key === 'Escape') {
                        suggestBox.style.display = 'none';
                    }
                }
            }
        });
    }

    /* ========================
       OPEN ADD POPUP
    ======================== */
    if (addBtn) {
        addBtn.addEventListener('click', function () {
            const addUserId = document.getElementById('addUserId');
            const addUserName = document.getElementById('addUserName');
            const addBorrowDate = document.getElementById('addBorrowDate');
            const addDueDate = document.getElementById('addDueDate');
            const addBooksBody = document.getElementById('addBooksBody');

            if (addUserId) addUserId.value = '';
            if (addUserName) addUserName.value = '';

            // Set default dates
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            if (addBorrowDate) {
                addBorrowDate.value = todayStr;
            }

            const due = new Date();
            due.setDate(now.getDate() + 30);
            const dueStr = due.toISOString().split('T')[0];
            if (addDueDate) {
                addDueDate.value = dueStr;
            }

            if (addBooksBody) addBooksBody.innerHTML = '';

            window.addBookRow();
            openPm('popup-add-borrow');
        });
    }

    // Auto-calculate Due Date
    const addBorrowDateEl = document.getElementById('addBorrowDate');
    if (addBorrowDateEl) {
        addBorrowDateEl.addEventListener('change', function () {
            const bDateStr = this.value;
            if (bDateStr) {
                const bDate = new Date(bDateStr);
                const dDate = new Date(bDate);
                dDate.setDate(bDate.getDate() + 30);
                const addDueDate = document.getElementById('addDueDate');
                if (addDueDate) {
                    addDueDate.value = dDate.toISOString().split('T')[0];
                }
            }
        });
    }

    /* ========================
       AUTO FILL USER NAME
    ======================== */
    const addUserIdEl = document.getElementById('addUserId');
    if (addUserIdEl) {
        addUserIdEl.addEventListener('blur', async function () {
            const uid = this.value.trim();
            const addUserNameInput = document.getElementById('addUserName');
            if (!uid) {
                if (addUserNameInput) addUserNameInput.value = '';
                return;
            }

            try {
                const response = await fetch(`/api/thong_tin_nguoi_dung/?ma_nguoi_dung=${uid}`);
                const data = await response.json();
                if (data.success) {
                    if (addUserNameInput) addUserNameInput.value = data.ho_ten;
                } else {
                    if (addUserNameInput) addUserNameInput.value = '';
                    safeToast('error', data.message);
                }
            } catch (error) {
                console.error('Error looking up user:', error);
            }
        });
    }

    /* ========================
       SUBMIT ADD BORROW
    ======================== */
    window.submitAddBorrow = async function (e) {
        e.preventDefault();

        const userId = document.getElementById('addUserId')?.value.trim() || '';
        const borrowDate = document.getElementById('addBorrowDate')?.value || '';
        const dueDate = document.getElementById('addDueDate')?.value || '';

        if (!userId || !borrowDate || !dueDate) {
            safeToast('error', 'Vui lòng nhập đầy đủ thông tin.');
            return;
        }

        const books = [];
        document.querySelectorAll('#addBooksBody .pm-book-row').forEach(function (row) {
            const inputs = row.querySelectorAll('input');
            const code = inputs[0] ? inputs[0].value.trim() : '';
            const title = inputs[1] ? inputs[1].value.trim() : '';

            if (code && title) {
                books.push({ code, title });
            }
        });

        if (books.length === 0) {
            safeToast('error', 'Không tìm thấy sách');
            return;
        }

        try {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const response = await fetch('/api/tao_phieu_muon/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    userId,
                    borrowDate,
                    dueDate,
                    books
                })
            });

            const data = await response.json();
            if (data.success) {
                safeToast('success', data.message);
                window.closePm();
                fetchSlips(); // Refresh the table
            } else {
                safeToast('error', data.message);
            }
        } catch (error) {
            console.error('Error creating borrow slip:', error);
            safeToast('error', 'Lỗi hệ thống khi lưu phiếu mượn.');
        }
    };

    /* ========================
       TABLE CLICK EVENTS
    ======================== */
    tableBody.addEventListener('click', function (e) {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const slip = slips.find(function (s) {
                return s.id === id;
            });

            if (!slip) return;

            const extLgUserId = document.getElementById('extLgUserId');
            const extLgUserName = document.getElementById('extLgUserName');
            const extLgCurrentDue = document.getElementById('extLgCurrentDue');
            const extLgNewDue = document.getElementById('extLgNewDue');

            if (extLgUserId) extLgUserId.value = slip.userId;
            if (extLgUserName) extLgUserName.value = slip.userName;
            if (extLgCurrentDue) extLgCurrentDue.value = toIso(slip.dueDate);
            if (extLgNewDue) extLgNewDue.value = toIso(slip.dueDate);

            renderBookList('extLgBooksBody', slip.books);
            extLargeSlipId = id;
            openPm('popup-extend-large');
            return;
        }

        const delBtn = e.target.closest('.btn-del');
        if (delBtn) {
            pendingDeleteId = delBtn.getAttribute('data-id');
            openPm('popup-delete-confirm');
            return;
        }

        const row = e.target.closest('tr[data-id]');
        if (row && !e.target.closest('.btn-edit') && !e.target.closest('.btn-del')) {
            const rowId = row.getAttribute('data-id');
            const slip = slips.find(function (s) {
                return s.id === rowId;
            });

            if (!slip) return;

            const detUserId = document.getElementById('detUserId');
            const detUserName = document.getElementById('detUserName');
            const detBorrowDate = document.getElementById('detBorrowDate');
            const detDueDate = document.getElementById('detDueDate');

            if (detUserId) detUserId.value = slip.userId;
            if (detUserName) detUserName.value = slip.userName;
            if (detBorrowDate) detBorrowDate.value = toIso(slip.borrowDate);
            if (detDueDate) detDueDate.value = toIso(slip.dueDate);

            detailSlipId = rowId;
            renderBookList('detBooksBody', slip.books);
            openPm('popup-borrow-detail');
        }
    });

    /* ========================
       SAVE DETAIL CHANGES
    ======================== */
    window.saveDetailChanges = async function () {
        const newDate = document.getElementById('detDueDate')?.value || '';
        const currentDueIso = document.getElementById('detDueDate')?.dataset.originalDue || '';

        if (!newDate) {
            safeToast('error', 'Vui lòng chọn ngày đến hạn mới.');
            return;
        }

        // Kiểm tra quá hạn phía frontend (sử dụng dữ liệu từ slip)
        const slip = slips.find(s => s.id === detailSlipId);
        if (slip) {
            const currentDue = toIso(slip.dueDate);
            const today = new Date().toISOString().split('T')[0];

            // Nếu đã quá hạn: không cho gia hạn
            if (today > currentDue) {
                safeToast('error', 'Sách đã quá hạn trả, không thể gia hạn. Vui lòng thực hiện trả sách và thanh toán phí phạt nếu có.');
                return;
            }

            // Ngày mới phải lớn hơn hạn trả hiện tại
            if (newDate <= currentDue) {
                safeToast('error', 'Ngày gia hạn mới phải lớn hơn hạn trả hiện tại.');
                return;
            }
        }

        try {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const response = await fetch(`/api/gia_han_phieu_muon/${detailSlipId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ newDueDate: newDate })
            });

            const data = await response.json();
            if (data.success) {
                safeToast('success', data.message);
                window.closePm();
                fetchSlips();
            } else {
                // Không đóng popup khi thất bại để người dùng có thể điều chỉnh
                safeToast('error', data.message);
            }
        } catch (error) {
            console.error('Error updating borrow slip:', error);
            safeToast('error', 'Lỗi hệ thống khi cập nhật.');
        }
    };

    /* ========================
       SAVE EXTEND SMALL
    ======================== */
    window.saveExtendSmall = async function () {
        const newDate = document.getElementById('extSmNewDate')?.value || '';

        if (!newDate) {
            safeToast('error', 'Vui lòng chọn ngày gia hạn mới.');
            return;
        }

        const slip = slips.find(s => s.id == extSmallSlipId);
        if (slip) {
            const currentDue = toIso(slip.dueDate);
            const today = new Date().toISOString().split('T')[0];

            // Nếu đã quá hạn: không cho gia hạn
            if (today > currentDue) {
                safeToast('error', 'Sách đã quá hạn trả, không thể gia hạn. Vui lòng thực hiện trả sách và thanh toán phí phạt nếu có.');
                return;
            }

            // Ngày mới phải lớn hơn hạn trả hiện tại
            if (newDate <= currentDue) {
                safeToast('error', 'Ngày gia hạn mới phải lớn hơn hạn trả hiện tại.');
                return;
            }
        }

        try {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const response = await fetch(`/api/gia_han_phieu_muon/${extSmallSlipId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ newDueDate: newDate })
            });

            const data = await response.json();
            if (data.success) {
                safeToast('success', data.message);
                window.closePm();
                fetchSlips();
            } else {
                // Không đóng popup khi thất bại
                safeToast('error', data.message);
            }
        } catch (error) {
            console.error('Error extending borrow slip:', error);
            safeToast('error', 'Lỗi hệ thống khi gia hạn.');
        }
    };

    /* ========================
       SAVE EXTEND LARGE
    ======================== */
    window.saveExtendLarge = async function () {
        const newDate = document.getElementById('extLgNewDue')?.value || '';

        if (!newDate) {
            safeToast('error', 'Vui lòng chọn ngày đến hạn mới.');
            return;
        }

        const slip = slips.find(s => s.id == extLargeSlipId);
        if (slip) {
            const currentDue = toIso(slip.dueDate);
            const today = new Date().toISOString().split('T')[0];

            // Nếu đã quá hạn: không cho gia hạn
            if (today > currentDue) {
                safeToast('error', 'Sách đã quá hạn trả, không thể gia hạn. Vui lòng thực hiện trả sách và thanh toán phí phạt nếu có.');
                return;
            }

            // Ngày mới phải lớn hơn hạn trả hiện tại
            if (newDate <= currentDue) {
                safeToast('error', 'Ngày gia hạn mới phải lớn hơn hạn trả hiện tại.');
                return;
            }
        }

        try {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const response = await fetch(`/api/gia_han_phieu_muon/${extLargeSlipId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ newDueDate: newDate })
            });

            const data = await response.json();
            if (data.success) {
                safeToast('success', data.message);
                window.closePm();
                fetchSlips();
            } else {
                // Không đóng popup khi thất bại
                safeToast('error', data.message);
            }
        } catch (error) {
            console.error('Error extending borrow slip:', error);
            safeToast('error', 'Lỗi hệ thống khi gia hạn.');
        }
    };

    /* ========================
       CONFIRM DELETE
    ======================== */
    window.confirmDelete = async function () {
        if (pendingDeleteId === null) return;

        try {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            const response = await fetch(`/api/xoa_phieu_muon/${pendingDeleteId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken
                }
            });

            if (response.redirected) {
                console.log('Redirecting to:', response.url);
                const currentUrl = new URL(window.location.href);
                const targetUrl = new URL(response.url);
                
                // If redirecting to the same page, we need to force reload to show messages
                if (currentUrl.pathname === targetUrl.pathname) {
                    window.location.reload();
                } else {
                    window.location.href = response.url;
                }
                return;
            }

            const data = await response.json();
            if (data.action === 'reload') {
                window.location.reload();
                return;
            }

            if (data.success) {
                safeToast('success', data.message);
                window.closePm();
                fetchSlips(); // Refresh table
            } else {
                safeToast('error', data.message);
            }
        } catch (error) {
            console.error('Error deleting borrow slip:', error);
            safeToast('error', 'Lỗi hệ thống khi xóa phiếu mượn.');
        } finally {
            pendingDeleteId = null;
        }
    };

    /* ========================
       INITIAL RENDER
    ======================== */
    fetchSlips();
});
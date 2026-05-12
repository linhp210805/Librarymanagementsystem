let selectedReturnRow = null;
let selectedLostRow = null;
let selectedCompensateRow = null;
let overdueFineValue = 0;
let damageFineValue = 0;

function normalizeSearchText(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = normalizeSearchText(searchInput.value);
    const allRows = document.querySelectorAll('.tab-pane tbody tr');

    allRows.forEach((row) => {
        const rowText = normalizeSearchText(row.textContent);
        row.style.display = !query || rowText.includes(query) ? '' : 'none';
    });
}

function switchTab(clickedTab, targetId) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => {
        p.classList.add('hidden');
        p.classList.remove('active');
        p.style.display = '';  // Xóa inline style để CSS class quyết định
    });

    clickedTab.classList.add('active');
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
        target.style.display = '';  // Xóa inline style để CSS .tab-pane.active quyết định
    }

    sessionStorage.setItem('activeReturnTab', targetId);
}

function reloadCurrentTab() {
    const activeTab = sessionStorage.getItem('activeReturnTab') || 'tab-1';
    const url = new URL(window.location.href);
    url.searchParams.set('active_tab', activeTab);
    window.location.replace(url.toString());
}

function showToast(type, customMessage) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';

    const map = {
        returnSuccess: { cls: 'toast-success', icon: 'bx bx-check-circle', msg: 'Xác nhận trả sách thành công' },
        returnError: { cls: 'toast-error', icon: 'bx bx-x-circle', msg: 'Xác nhận trả sách thất bại' },
        compensateSuccess: { cls: 'toast-success', icon: 'bx bx-check-circle', msg: 'Xác nhận đền sách thành công' },
        compensateError: { cls: 'toast-error', icon: 'bx bx-x-circle', msg: 'Xác nhận đền sách thất bại' },
        lostSuccess: { cls: 'toast-success', icon: 'bx bx-check-circle', msg: 'Xác nhận mất sách thành công' },
        lostError: { cls: 'toast-error', icon: 'bx bx-x-circle', msg: 'Xác nhận xử lý mất sách thất bại' },
        paymentSuccess: { cls: 'toast-success', icon: 'bx bx-check-circle', msg: 'Xác nhận thanh toán thành công' },
        error: { cls: 'toast-error', icon: 'bx bx-x-circle', msg: customMessage || 'Đã có lỗi xảy ra' }
    };

    const cfg = map[type] || map.error;
    toast.classList.add(cfg.cls);
    toast.innerHTML = `<i class='${cfg.icon}'></i> <span>${customMessage || cfg.msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutToast 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatCurrency(value) {
    return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, value || 0))}đ`;
}

function escapeHtml(text) {
    return (text || '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTab2Body() {
    return document.querySelector('#tab-2 tbody');
}

function syncTab2EmptyState() {
    const tbody = getTab2Body();
    const emptyRow = document.getElementById('tab2EmptyStateRow');
    if (!tbody || !emptyRow) return;

    const hasDataRows = tbody.querySelectorAll('tr.row-clickable').length > 0;
    emptyRow.style.display = hasDataRows ? 'none' : '';
}

function escapeSelectorValue(value) {
    const text = String(value || '');
    if (window.CSS && typeof CSS.escape === 'function') {
        return CSS.escape(text);
    }
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findTab2UserRow(userId) {
    if (!userId) return null;
    const selector = `#tab-2 tr[data-user-id="${escapeSelectorValue(String(userId))}"]`;
    return document.querySelector(selector);
}

function renderTab2UserRow(row, userId, userName, unpaidTotal, hasAnyFine) {
    const tbody = getTab2Body();
    if (!row || !tbody) return;

    const safeUserId = String(userId || row.dataset.userId || '');
    const safeUserName = userName || row.dataset.userName || '-';
    const total = Number(unpaidTotal) || 0;
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(row) + 1;

    row.dataset.userId = safeUserId;
    row.dataset.userName = safeUserName;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Mở chi tiết phí phạt của ${safeUserName}`);
    row.onclick = () => openPaymentPopup(safeUserId, safeUserName, total);

    if (row.children.length >= 5) {
        row.children[0].innerHTML = `<strong>${rowIndex}</strong>`;
        row.children[1].textContent = safeUserName;
        row.children[2].textContent = safeUserId;
        row.children[3].innerHTML = `<span style="color: #ea580c; font-weight: 700; font-size: 15px;">${formatCurrency(total)}</span>`;
        row.children[4].innerHTML = total > 0
            ? `<div style="display:flex; gap:8px; justify-content:flex-end;"><button class="btn btn-primary" style="background-color: #3b82f6; padding: 8px 16px; font-size: 13px; white-space: nowrap; border-radius: 6px; font-weight: 600;" onclick='event.stopPropagation(); openPaymentPopup(${JSON.stringify(safeUserId)}, ${JSON.stringify(safeUserName)}, ${total})'>Thanh toán</button></div>`
            : '';
    }

    if (!hasAnyFine && total <= 0) {
        row.querySelector('td:nth-child(4)').innerHTML = `<span style="color: #ea580c; font-weight: 700; font-size: 15px;">0đ</span>`;
    }
}

function upsertTab2UserRow(userId, userName, unpaidTotal, hasAnyFine = true) {
    const tbody = getTab2Body();
    if (!tbody) return;

    const total = Number(unpaidTotal) || 0;
    if (total <= 0) {
        const existingRow = findTab2UserRow(userId);
        if (existingRow) existingRow.remove();
        syncTab2EmptyState();
        return null;
    }

    const existingRow = findTab2UserRow(userId);
    if (existingRow) {
        renderTab2UserRow(existingRow, userId, userName, total, true);
        return existingRow;
    }

    const row = document.createElement('tr');
    row.className = 'row-clickable';
    row.dataset.userId = String(userId || '');
    row.dataset.userName = userName || '-';
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Mở chi tiết phí phạt của ${userName || '-'}`);

    const rowIndex = tbody.querySelectorAll('tr').length + 1;
    const safeUserId = String(userId || '');
    const safeUserName = userName || '-';
    row.innerHTML = `
        <td style="white-space: nowrap; padding: 16px;"><strong>${rowIndex}</strong></td>
        <td style="white-space: nowrap; padding: 16px;">${escapeHtml(safeUserName)}</td>
        <td style="white-space: nowrap; padding: 16px;">${escapeHtml(safeUserId)}</td>
        <td style="white-space: nowrap; padding: 16px;"><span style="color: #ea580c; font-weight: 700; font-size: 15px;">${formatCurrency(total)}</span></td>
        <td class="col-action" style="width:1px; white-space: nowrap; padding: 16px;">
            <div style="display:flex; gap:8px; justify-content:flex-end;">${total > 0 ? `<button class="btn btn-primary" style="background-color: #3b82f6; padding: 8px 16px; font-size: 13px; white-space: nowrap; border-radius: 6px; font-weight: 600;" onclick='event.stopPropagation(); openPaymentPopup(${JSON.stringify(safeUserId)}, ${JSON.stringify(safeUserName)}, ${total})'>Thanh toán</button>` : ''}</div>
        </td>
    `;
    row.addEventListener('click', () => openPaymentPopup(safeUserId, safeUserName, total));
    tbody.appendChild(row);
    syncTab2EmptyState();
    return row;
}

function refreshTab2UserSummary(userId, userName) {
    if (!userId) return Promise.resolve();

    return fetch(`/api/lay_danh_sach_phi_phat_nguoi_dung/?ma_nguoi_dung=${encodeURIComponent(userId)}`)
        .then(async (res) => {
            let data = null;
            try {
                data = await res.json();
            } catch (err) {
                throw new Error('Phản hồi không hợp lệ từ máy chủ.');
            }

            if (!res.ok || !data.success) {
                throw new Error(data?.error || data?.message || `Lỗi tải dữ liệu (${res.status})`);
            }

            const unpaidTotal = (data.fines || [])
                .filter((fine) => isUnpaidStatus(fine.trang_thai))
                .reduce((sum, fine) => sum + (Number(fine.so_tien) || 0), 0);
            upsertTab2UserRow(userId, userName, unpaidTotal, true);
        })
        .catch((err) => {
            console.error('Failed to refresh fee summary:', err);
        });
}

function removeLostReportRow(loanId, bookCode) {
    if (!loanId || !bookCode) return;
    const selector = `#tab-3 tr.lost-record[data-loan-id="${escapeSelectorValue(String(loanId))}"][data-book-code="${escapeSelectorValue(String(bookCode))}"]`;
    document.querySelectorAll(selector).forEach((row) => row.remove());
}

function getLocalISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeStatusText(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isUnpaidStatus(value) {
    return normalizeStatusText(value) === 'chua thanh toan';
}

function isReturnEligibleStatus(status) {
    const s = (status || '').toLowerCase();
    return s === 'đang mượn' || s === 'quá hạn' || s === 'dang_muon' || s === 'qua_han';
}

function isLostEligibleStatus(status) {
    const s = (status || '').toLowerCase();
    return s === 'đang mượn' || s === 'quá hạn' || s === 'dang_muon' || s === 'qua_han';
}

function openModalById(id) {
    const overlay = document.getElementById('popupOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    const flexModalIds = new Set(['popup-return-confirm', 'popup-return-cancel-confirm', 'popup-payment', 'popup-payment-cancel-confirm', 'popup-lost-book', 'popup-compensate-confirm']);
    document.querySelectorAll('.popup-modal').forEach((modal) => {
        if (modal.id === id) {
            modal.style.display = 'flex';
        } else {
            modal.style.display = 'none';
        }
    });
}

function closeAllPopups() {
    const overlay = document.getElementById('popupOverlay');
    if (overlay) overlay.style.display = 'none';
    document.querySelectorAll('.popup-modal').forEach((modal) => {
        modal.style.display = 'none';
    });
}

function getSelectedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
}

function markReturnConditionError(showError) {
    const conditionGroup = document.getElementById('returnConditionGroup');
    const conditionError = document.getElementById('returnConditionError');
    if (!conditionGroup || !conditionError) return;
    conditionGroup.classList.toggle('error', showError);
    conditionError.classList.toggle('hidden', !showError);
}

function resetReturnFormState() {
    document.querySelectorAll('input[name="returnCondition"]').forEach((input) => { input.checked = false; });
    document.querySelectorAll('input[name="damageLevel"]').forEach((input) => { input.checked = false; });

    const damageDescription = document.getElementById('damageDescription');
    if (damageDescription) damageDescription.value = '';

    const damageSection = document.getElementById('damageSection');
    if (damageSection) damageSection.classList.add('hidden');

    markReturnConditionError(false);
    updateReturnFeeSummary();
}

function updateReturnFeeSummary() {
    const condition = getSelectedRadioValue('returnCondition');
    const isDamaged = condition === 'damaged';
    const checkedDamage = document.querySelector('input[name="damageLevel"]:checked');

    damageFineValue = 0;
    if (isDamaged && checkedDamage) {
        damageFineValue = parseInt(checkedDamage.dataset.fee) || 0;
    }
    const totalFine = overdueFineValue + damageFineValue;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    setText('damageFeeValue', formatCurrency(damageFineValue));
    setText('overdueFeeValue', formatCurrency(overdueFineValue));
    setText('overdueSummaryValue', formatCurrency(overdueFineValue));
    setText('damageSummaryValue', formatCurrency(damageFineValue));
    setText('totalFineValue', formatCurrency(totalFine));

    const overdueSummaryRow = document.getElementById('overdueSummaryRow');
    const damageSummaryRow = document.getElementById('damageSummaryRow');
    if (overdueSummaryRow) overdueSummaryRow.classList.toggle('hidden', overdueFineValue <= 0);
    if (damageSummaryRow) damageSummaryRow.classList.toggle('hidden', !isDamaged);
}

function syncReturnPopupFromRow(row) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || '-';
    };

    setText('returnBookCode', row.dataset.bookCode);
    setText('returnBookTitle', row.dataset.bookTitle);
    setText('returnBorrower', row.dataset.borrower);
    setText('returnDueDate', row.dataset.dueDate);

    const overdueDays = Number(row.dataset.overdueDays || 0);
    const overdueRate = Number(row.dataset.overdueRate || 0);
    overdueFineValue = overdueDays > 0 ? overdueDays * overdueRate : 0;

    setText('overdueDaysValue', `${overdueDays} ngày`);
    setText('overdueRateValue', formatCurrency(overdueRate));

    const overdueSection = document.getElementById('overdueSection');
    if (overdueSection) overdueSection.classList.toggle('hidden', overdueDays <= 0);
}

function openReturnConfirm(triggerButton) {
    const row = triggerButton.closest('tr.return-record');
    if (!row) return;

    const status = row.dataset.status || '';
    if (!isReturnEligibleStatus(status)) {
        showToast('error', 'Chỉ bản ghi Đang mượn hoặc Quá hạn mới được xác nhận trả.');
        return;
    }

    selectedReturnRow = row;
    syncReturnPopupFromRow(row);
    resetReturnFormState();
    openModalById('popup-return-confirm');
}

function requestCloseReturnPopup() {
    const hasCondition = !!getSelectedRadioValue('returnCondition');
    const hasDamageLevel = !!getSelectedRadioValue('damageLevel');
    const damageDescription = document.getElementById('damageDescription');
    const hasDescription = !!(damageDescription && damageDescription.value.trim());

    if (!hasCondition && !hasDamageLevel && !hasDescription) {
        closeAllPopups();
        return;
    }

    openModalById('popup-return-cancel-confirm');
}

function backToReturnPopup() {
    openModalById('popup-return-confirm');
}

function confirmCancelReturnPopup() {
    resetReturnFormState();
    closeAllPopups();
}

function requestClosePaymentPopup() {
    const paymentModal = document.getElementById('popup-payment');
    const footerActions = document.getElementById('paymentFooterActions');
    if (!paymentModal || paymentModal.style.display === 'none') {
        closeAllPopups();
        return;
    }

    const hasPendingPayment = !footerActions || footerActions.style.display !== 'none';
    if (!hasPendingPayment) {
        closeAllPopups();
        return;
    }

    openModalById('popup-payment-cancel-confirm');
}

function backToPaymentPopup() {
    openModalById('popup-payment');
}

function confirmCancelPaymentPopup() {
    selectedPaymentUser = null;
    window.currentFineIds = [];
    closeAllPopups();
}

function submitReturnConfirm() {
    const condition = getSelectedRadioValue('returnCondition');
    if (!condition) {
        markReturnConditionError(true);
        return;
    }
    markReturnConditionError(false);

    // Lấy các giá trị cần gửi
    const damageLevelRadio = document.querySelector('input[name="damageLevel"]:checked');
    const damageLevel = damageLevelRadio ? damageLevelRadio.value : '';

    if (condition === 'damaged' && !damageLevel) {
        showToast('error', 'Vui lòng chọn mức độ hư hỏng.');
        return;
    }

    const damageDescription = document.getElementById('damageDescription')?.value || '';
    // Lấy thông tin từ selectedReturnRow
    const ma_phieu_muon = selectedReturnRow?.dataset.loanId || '';
    const ma_sach_trong_kho = selectedReturnRow?.dataset.bookCode || '';

    // Gửi request xác nhận trả sách
    fetch('/api/xac_nhan_tra_sach/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': window.CSRF_TOKEN || ''
        },
        body: new URLSearchParams({
            ma_phieu_muon,
            ma_sach_trong_kho,
            tinh_trang: condition === 'damaged' ? 'hu_hong' : 'tot',
            mo_ta_hu_hong: damageDescription,
            damage_level: condition === 'damaged' ? damageLevel : ''
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const loanId = selectedReturnRow?.dataset.loanId || '';
                const bookCode = selectedReturnRow?.dataset.bookCode || '';
                const userId = selectedReturnRow?.dataset.userId || '';
                const userName = selectedReturnRow?.dataset.userName || selectedReturnRow?.dataset.borrower || '-';
                selectedReturnRow.dataset.status = 'Đã trả';
                if (selectedReturnRow.dataset.overdueDays) selectedReturnRow.dataset.overdueDays = '0';
                selectedReturnRow.classList.remove('row-overdue');

                const statusCell = selectedReturnRow.querySelector('.col-status');
                const actionCell = selectedReturnRow.querySelector('.col-action');

                if (statusCell) statusCell.innerHTML = '<span class="badge badge-green-solid">Đã trả</span>';
                if (actionCell) actionCell.innerHTML = '';

                closeAllPopups();
                resetReturnFormState();
                showToast('returnSuccess');
                removeLostReportRow(loanId, bookCode);
                refreshTab2UserSummary(userId, userName);
                setTimeout(() => reloadCurrentTab(), 1000);
            } else {
                showToast('returnError', data.error || 'Xác nhận trả sách thất bại');
            }
        })
        .catch(() => showToast('returnError'));
}

function markLostDateError(showError) {
    const dateInput = document.getElementById('lostReportDate');
    const dateError = document.getElementById('lostDateError');
    if (!dateInput || !dateError) return;

    dateInput.classList.toggle('error-input', showError);
    dateError.classList.toggle('hidden', !showError);
}

function markLostMethodError(showError) {
    const methodGroup = document.getElementById('lostCompensateGroup');
    const methodError = document.getElementById('lostMethodError');
    if (!methodGroup || !methodError) return;

    methodGroup.classList.toggle('error', showError);
    methodError.classList.toggle('hidden', !showError);
}

function resetLostFormState() {
    const dateInput = document.getElementById('lostReportDate');
    const noteInput = document.getElementById('lostNote');

    // Tự động chọn ngày hôm nay
    if (dateInput) {
        dateInput.value = getLocalISODate();
    }

    if (noteInput) noteInput.value = '';

    document.querySelectorAll('input[name="compensateMethod"]').forEach((input) => {
        input.checked = false;
    });

    markLostDateError(false);
    markLostMethodError(false);
    updateLostOutcome();
}

function updateLostOutcome() {
    const method = getSelectedRadioValue('compensateMethod');
    const lostFee = Number(selectedLostRow?.dataset.lostFee || 0);
    const overdueDays = Number(selectedLostRow?.dataset.overdueDays || 0);
    const overdueRate = Number(selectedLostRow?.dataset.overdueRate || 0);
    const overdueFine = overdueDays > 0 ? overdueDays * overdueRate : 0;

    const lostFineCreation = document.getElementById('lostFineCreation');
    const lostFineType = document.getElementById('lostFineType');
    const lostFineStatus = document.getElementById('lostFineStatus');
    const lostProcessingFee = document.getElementById('lostProcessingFee');
    const lostRecordNextStatus = document.getElementById('lostRecordNextStatus');
    const lostTotalAmount = document.getElementById('lostTotalAmount');
    const lostOutcomeHint = document.getElementById('lostOutcomeHint');

    if (!method) {
        if (lostFineCreation) lostFineCreation.innerText = 'Chưa xác định';
        if (lostFineType) lostFineType.innerText = '-';
        if (lostFineStatus) lostFineStatus.innerText = '-';
        if (lostProcessingFee) lostProcessingFee.innerText = formatCurrency(0);
        if (lostRecordNextStatus) lostRecordNextStatus.innerText = '-';
        if (lostTotalAmount) lostTotalAmount.innerText = formatCurrency(0);
        if (lostOutcomeHint) lostOutcomeHint.innerText = 'Chọn phương án bồi hoàn để xem kết quả nghiệp vụ.';
        return;
    }

    if (method === 'money') {
        if (lostFineCreation) lostFineCreation.innerText = 'Có tạo khoản phạt';
        if (lostFineType) lostFineType.innerText = 'Mất sách' + (overdueFine > 0 ? ' + Trễ hạn' : '');
        if (lostFineStatus) lostFineStatus.innerText = 'Chưa thanh toán';
        if (lostProcessingFee) lostProcessingFee.innerText = formatCurrency(lostFee);
        if (lostRecordNextStatus) lostRecordNextStatus.innerText = 'Đang xử lý';
        if (lostTotalAmount) lostTotalAmount.innerText = formatCurrency(lostFee + overdueFine);
        if (lostOutcomeHint) lostOutcomeHint.innerText = 'Sau xác nhận: tạo phạt Mất sách và Trễ hạn (nếu có) với trạng thái Chưa thanh toán.';
        return;
    }

    if (lostFineCreation) lostFineCreation.innerText = 'Không tạo phạt mất sách';
    if (lostFineType) lostFineType.innerText = (overdueFine > 0 ? 'Trễ hạn' : '-');
    if (lostFineStatus) lostFineStatus.innerText = (overdueFine > 0 ? 'Chưa thanh toán' : '-');
    if (lostProcessingFee) lostProcessingFee.innerText = formatCurrency(0);
    if (lostRecordNextStatus) lostRecordNextStatus.innerText = 'Chờ đền sách';
    if (lostTotalAmount) lostTotalAmount.innerText = formatCurrency(overdueFine);
    if (lostOutcomeHint) lostOutcomeHint.innerText = 'Sau xác nhận: hồ sơ chuyển Chờ đền sách, chỉ tạo phạt Trễ hạn (nếu có).';
}

function openLostReport(triggerButton) {
    const row = triggerButton.closest('tr');
    if (!row) return;

    const status = row.dataset.status || '';
    if (!isLostEligibleStatus(status)) {
        showToast('error', 'Chỉ bản ghi Đang mượn hoặc Quá hạn mới được báo mất.');
        return;
    }

    selectedLostRow = row;
    const bookTitle = document.getElementById('lostBookTitle');
    const borrower = document.getElementById('lostBorrowerName');
    if (bookTitle) bookTitle.innerText = row.dataset.bookTitle || '-';
    if (borrower) borrower.innerText = row.dataset.borrower || '-';

    resetLostFormState();
    openModalById('popup-lost-book');
}

function submitLostBookReport() {
    const reportDate = document.getElementById('lostReportDate')?.value || '';
    const method = getSelectedRadioValue('compensateMethod');

    const validDate = Boolean(reportDate);
    markLostDateError(!validDate);
    markLostMethodError(!method);
    if (!validDate || !method) return;

    const ma_phieu_muon = selectedLostRow?.dataset.loanId || '';
    const ma_sach_trong_kho = selectedLostRow?.dataset.bookCode || '';
    const ghi_chu = document.getElementById('lostNote')?.value || '';

    fetch('/api/xu_ly_mat_sach/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': window.CSRF_TOKEN || ''
        },
        body: new URLSearchParams({
            ma_phieu_muon,
            ma_sach_trong_kho,
            ngay_khai_bao_mat: reportDate,
            phuong_an: method === 'money' ? 'den_bu_tien' : 'den_sach_moi',
            ghi_chu
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const userId = selectedLostRow?.dataset.userId || '';
                const userName = selectedLostRow?.dataset.userName || selectedLostRow?.dataset.borrower || '-';
                const statusCell = selectedLostRow.querySelector('.col-status');
                const actionCell = selectedLostRow.querySelector('.col-action');

                if (method === 'money') {
                    selectedLostRow.dataset.status = 'Đang xử lý';
                    if (statusCell) statusCell.innerHTML = '<span class="badge badge-orange-solid">Đang xử lý</span>';
                } else {
                    selectedLostRow.dataset.status = 'Chờ đền sách';
                    if (statusCell) statusCell.innerHTML = '<span class="badge badge-red-solid">Chờ đền sách</span>';
                }

                if (actionCell) actionCell.innerHTML = '';

                closeAllPopups();
                resetLostFormState();
                showToast('lostSuccess');
                refreshTab2UserSummary(userId, userName);

                setTimeout(() => {
                    setTimeout(() => reloadCurrentTab(), 1000);
                }, 1000);
            } else {
                showToast('lostError', data.error || 'Xử lý mất sách thất bại');
            }
        })
        .catch(() => showToast('lostError'));
}

function initLostFlow() {
    document.querySelectorAll('.lost-report-trigger').forEach((button) => {
        button.addEventListener('click', () => openLostReport(button));
    });

    document.querySelectorAll('input[name="compensateMethod"]').forEach((input) => {
        input.addEventListener('change', () => {
            markLostMethodError(false);
            updateLostOutcome();
        });
    });

    const reportDateInput = document.getElementById('lostReportDate');
    if (reportDateInput) {
        reportDateInput.addEventListener('change', () => markLostDateError(false));
    }

    document.querySelectorAll('tr.lost-record, tr.return-record').forEach((row) => {
        const status = row.dataset.status || '';
        if (!isLostEligibleStatus(status)) {
            const actionCell = row.querySelector('.col-action-lost');
            if (actionCell) {
                actionCell.innerHTML = '';
            }
        }
    });
}

function isCompensateEligibleStatus(status) {
    const s = (status || '').toLowerCase();
    return s === 'chờ đền sách' || s === 'cho_den_sach' || s === 'cho_den';
}

function markCompInspectionError(showError) {
    const group = document.getElementById('compInspectionGroup');
    const error = document.getElementById('compInspectionError');
    if (!group || !error) return;

    group.classList.toggle('error', showError);
    error.classList.toggle('hidden', !showError);
}

function resetCompensateFormState() {
    document.querySelectorAll('input[name="compInspectionResult"]').forEach((input) => {
        input.checked = false;
    });
    const note = document.getElementById('compInspectionNote');
    if (note) note.value = '';
    markCompInspectionError(false);
}

function syncCompensatePopupFromRow(row) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || '-';
    };

    setText('compRecordId', row.dataset.recordId);
    setText('compBookTitle', row.dataset.bookTitle);
    setText('compBookCode', row.dataset.bookCode);
    setText('compBorrower', row.dataset.compensator);
    setText('compReportDate', row.dataset.reportDate);
}

function openCompensateConfirm(triggerEl) {
    const row = triggerEl.closest('tr.compensate-record');
    if (!row) return;

    const status = row.dataset.status || '';

    selectedCompensateRow = row;
    syncCompensatePopupFromRow(row);
    resetCompensateFormState();
    openModalById('popup-compensate-confirm');
}

function submitCompensateConfirm() {
    const inspection = getSelectedRadioValue('compInspectionResult');
    if (!inspection) {
        markCompInspectionError(true);
        return;
    }

    markCompInspectionError(false);

    if (inspection === 'fail') {
        showToast('compensateError', 'Sách đền không đạt yêu cầu, vui lòng kiểm tra lại.');
        return;
    }

    const ma_phieu_muon = selectedCompensateRow?.dataset.recordId || '';
    const ghi_chu = document.getElementById('compInspectionNote')?.value.trim() || '';

    fetch('/api/xac_nhan_den_sach/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': window.CSRF_TOKEN || ''
        },
        body: new URLSearchParams({
            ma_phieu_muon,
            ghi_chu
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                closeAllPopups();
                resetCompensateFormState();

                // Xóa hàng khỏi danh sách tab-4 ngay lập tức
                if (selectedCompensateRow) {
                    selectedCompensateRow.remove();
                }

                showToast('compensateSuccess');
                setTimeout(() => reloadCurrentTab(), 1500);
            } else {
                showToast('compensateError', data.error || 'Xác nhận đền sách thất bại');
            }
        })
        .catch((err) => {
            console.error('Lỗi xác nhận đền sách:', err);
            showToast('compensateError');
        });
}

function initCompensateFlow() {
    // Cho phép click vào cả dòng để hiện popup xác nhận
    document.querySelectorAll('tr.compensate-record').forEach((row) => {
        row.addEventListener('click', () => {
            const trigger = row.querySelector('.compensate-confirm-trigger');
            if (trigger) openCompensateConfirm(trigger);
        });

        // Trigger luôn hiển thị nếu có trong DOM (do template đã filter)
        const trigger = row.querySelector('.compensate-confirm-trigger');
        if (!trigger) {
            // Không có trigger nghĩa là đã hoàn thành
        }
    });

    // Sự kiện riêng cho trigger (ngăn sủi bọt)
    document.querySelectorAll('.compensate-confirm-trigger').forEach((trigger) => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            openCompensateConfirm(trigger);
        });
    });

    document.querySelectorAll('input[name="compInspectionResult"]').forEach((input) => {
        input.addEventListener('change', () => markCompInspectionError(false));
    });
}

function initReturnFlow() {
    const overlay = document.getElementById('popupOverlay');
    if (overlay) {
        overlay.addEventListener('click', (event) => {
            if (event.target !== overlay) return;
            const returnModal = document.getElementById('popup-return-confirm');
            const paymentModal = document.getElementById('popup-payment');
            const paymentCancelModal = document.getElementById('popup-payment-cancel-confirm');
            if (returnModal && returnModal.style.display !== 'none') {
                requestCloseReturnPopup();
            } else if (paymentCancelModal && paymentCancelModal.style.display !== 'none') {
                backToPaymentPopup();
            } else if (paymentModal && paymentModal.style.display !== 'none') {
                requestClosePaymentPopup();
            } else {
                closeAllPopups();
            }
        });
    }

    document.querySelectorAll('.return-confirm-trigger').forEach((btn) => {
        btn.addEventListener('click', () => openReturnConfirm(btn));
    });

    document.querySelectorAll('input[name="returnCondition"]').forEach((input) => {
        input.addEventListener('change', () => {
            const damageSection = document.getElementById('damageSection');
            const isDamaged = getSelectedRadioValue('returnCondition') === 'damaged';
            if (damageSection) damageSection.classList.toggle('hidden', !isDamaged);
            markReturnConditionError(false);
            updateReturnFeeSummary();
        });
    });

    document.querySelectorAll('input[name="damageLevel"]').forEach((input) => {
        input.addEventListener('change', updateReturnFeeSummary);
    });

    document.querySelectorAll('tr.return-record').forEach((row) => {
        const status = row.dataset.status || '';
        if (!isReturnEligibleStatus(status)) {
            const actionCell = row.querySelector('.col-action');
            if (actionCell) actionCell.innerHTML = '';
            row.classList.remove('row-overdue');
        }
    });
}

let selectedPaymentUser = null;

function openPaymentPopup(maNguoiDung, hoTen = '', tongTien = 0) {
    selectedPaymentUser = maNguoiDung;
    const nameEl = document.getElementById('payUserName');
    const totalEl = document.getElementById('payTotalAmount');
    if (nameEl) nameEl.innerText = hoTen || '-';
    if (totalEl) totalEl.innerText = formatCurrency(Number(tongTien) || 0);

    document.querySelectorAll('input[name="paymentMethodNew"]').forEach(r => r.checked = false);
    const errorEl = document.getElementById('paymentMethodError');
    if (errorEl) errorEl.classList.add('hidden');

    // Xóa nội dung bảng cũ và hiện loading
    const tableBody = document.getElementById('paymentTableBody');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#6b7280;">Đang tải chi tiết các khoản phạt...</td></tr>';

    openModalById('popup-payment');

    // Fetch chi tiết từ server
    fetch(`/api/lay_danh_sach_phi_phat_nguoi_dung/?ma_nguoi_dung=${maNguoiDung}`)
        .then(async (res) => {
            let data = null;
            try {
                data = await res.json();
            } catch (err) {
                throw new Error('Phản hồi không hợp lệ từ máy chủ.');
            }

            if (!res.ok || !data.success) {
                throw new Error(data?.error || data?.message || `Lỗi tải dữ liệu (${res.status})`);
            }

            return data;
        })
        .then(data => {
            window.currentFineIds = []; // Chỉ lưu mã phạt chưa thanh toán
            let unpaidTotal = 0;
            tableBody.innerHTML = '';
            if (data.fines.length > 0) {
                data.fines.forEach(fine => {
                    const fineAmount = Number(fine.so_tien) || 0;
                    const isUnpaid = isUnpaidStatus(fine.trang_thai);
                    if (isUnpaid) {
                        window.currentFineIds.push(fine.ma_phat);
                        unpaidTotal += fineAmount;
                    }
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid #f3f4f6';
                    const isPaid = !isUnpaid;

                    let penaltyBadgeClass = 'badge-gray';
                    const lcLoai = (fine.loai_phat || '').toLowerCase();
                    let displayLoaiPhat = fine.loai_phat;

                    if (lcLoai.includes('hư hỏng') || lcLoai.includes('hu hong')) {
                        penaltyBadgeClass = 'badge-orange-solid';
                        displayLoaiPhat = 'Hư hỏng';
                    } else if (lcLoai.includes('mất sách') || lcLoai.includes('mat sach') || lcLoai.includes('đền sách') || lcLoai.includes('den sach')) {
                        penaltyBadgeClass = 'badge-red-solid';
                    } else if (lcLoai.includes('trễ hạn') || lcLoai.includes('tre han')) {
                        penaltyBadgeClass = 'badge-blue-solid';
                    }

                    row.innerHTML = `
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: nowrap !important; text-align: center;"><strong>${fine.ma_sach_trong_kho}</strong></td>
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: nowrap !important; font-weight: 600;">${fine.ten_sach}</td>
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: normal !important; text-align: center;">
                            <span class="badge ${penaltyBadgeClass}" style="font-size:11px; padding: 4px 10px; border-radius: 12px; font-weight: 600; white-space: nowrap; display: inline-block; text-align: center; min-width: 80px;">${displayLoaiPhat}</span>
                        </td>
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: normal !important; min-width: 150px; max-width: 250px; word-wrap: break-word;">${fine.ly_do}</td>
                        <td style="padding:12px 14px; font-size:13px; font-weight:700; color:#f97316; white-space: nowrap !important; text-align: center;">${formatCurrency(fineAmount)}</td>
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: nowrap !important; text-align: center;">${fine.ngay_tao}</td>
                        <td style="padding:12px 14px; font-size:13px; color:#374151; white-space: nowrap !important; text-align: center;"><strong>${fine.ma_phieu_muon}</strong></td>
                        <td style="padding:12px 14px; white-space: nowrap !important; text-align: center;">
                            <span class="badge ${isPaid ? 'badge-green-solid' : 'badge-orange-solid'}" style="font-size:11px; white-space: nowrap !important; display: inline-block; padding: 4px 8px; text-align: center; min-width: 90px;">
                                ${isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                            </span>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
                if (totalEl) {
                    totalEl.innerText = formatCurrency(unpaidTotal);
                }
            } else {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#9ca3af;">Không có lịch sử phí phạt.</td></tr>';
                if (totalEl) totalEl.innerText = formatCurrency(0);
            }
            // Ẩn/Hiện controls thanh toán và hiển thị thông báo nếu đã thanh toán hết
            const paymentControls = document.getElementById('paymentControls');
            const paidNotice = document.getElementById('paidNotice');
            const paymentFooterActions = document.getElementById('paymentFooterActions');
            const paymentFooterExit = document.getElementById('paymentFooterExit');

            const hasUnpaid = data.fines.some(f => isUnpaidStatus(f.trang_thai));
            if (paymentControls) {
                paymentControls.style.display = hasUnpaid ? 'block' : 'none';
            }
            if (paidNotice) {
                paidNotice.style.display = (!hasUnpaid && data.fines.length > 0) ? 'block' : 'none';
            }
            if (paymentFooterActions && paymentFooterExit) {
                if (hasUnpaid) {
                    paymentFooterActions.style.display = 'flex';
                    paymentFooterExit.style.display = 'none';
                } else {
                    paymentFooterActions.style.display = 'none';
                    paymentFooterExit.style.display = 'flex';
                }
            }
        })
        .catch((err) => {
            const message = err?.message || 'Lỗi kết nối khi tải chi tiết phí phạt.';
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#ef4444;">${message}</td></tr>`;
            console.error('Payment detail load error:', err);
        });
}

function submitPayment() {
    if (!selectedPaymentUser) return;
    const paymentMethod = getSelectedRadioValue('paymentMethodNew');
    const errorEl = document.getElementById('paymentMethodError');
    // Đảm bảo luôn ẩn lỗi trước khi kiểm tra
    if (errorEl) errorEl.classList.add('hidden');
    if (!paymentMethod) {
        if (errorEl) {
            errorEl.classList.remove('hidden');
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    if (!window.currentFineIds || window.currentFineIds.length === 0) {
        alert('Không có khoản phạt nào để thanh toán.');
        return;
    }
    const params = new URLSearchParams();
    params.append('ma_nguoi_dung', selectedPaymentUser);
    params.append('phuong_thuc', paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản');
    window.currentFineIds.forEach(id => params.append('danh_sach_ma_phat[]', id));
    fetch('/api/thanh_toan_phi_phat/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': window.CSRF_TOKEN || ''
        },
        body: params
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const nameEl = document.getElementById('payUserName');
                const userName = nameEl ? nameEl.innerText.trim() : '-';
                closeAllPopups();
                showToast('paymentSuccess');
                refreshTab2UserSummary(selectedPaymentUser, userName);
                setTimeout(() => reloadCurrentTab(), 1000);
            } else {
                alert('Thanh toán thất bại: ' + (data.error || 'Lỗi hệ thống'));
            }
        })
        .catch(() => alert('Lỗi kết nối khi thanh toán'));
}

document.addEventListener('DOMContentLoaded', () => {
    initReturnFlow();
    initLostFlow();
    initCompensateFlow();
    // Thêm sự kiện ẩn lỗi khi chọn radio phương thức thanh toán
    document.querySelectorAll('input[name="paymentMethodNew"]').forEach((input) => {
        input.addEventListener('change', () => {
            const errorEl = document.getElementById('paymentMethodError');
            if (errorEl) errorEl.classList.add('hidden');
        });
    });

    // Khôi phục tab đang mở trước khi reload
    const activeTabId = sessionStorage.getItem('activeReturnTab');
    if (activeTabId) {
        const tabBtn = document.querySelector(`.tab[onclick*="'${activeTabId}'"]`);
        if (tabBtn) {
            switchTab(tabBtn, activeTabId);
        }
    }
});

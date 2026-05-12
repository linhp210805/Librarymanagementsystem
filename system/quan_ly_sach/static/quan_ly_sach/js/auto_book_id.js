// Auto-generate book ID functionality (Sửa đổi: Tăng số thứ tự)
console.log('Auto book ID module loaded');

const originalOpenAddModal = window.openAddModal;

window.openAddModal = function() {
    if (originalOpenAddModal) {
        originalOpenAddModal();
    }

    setTimeout(() => {
        const bookIdInput = document.getElementById('addBookId');
        if (bookIdInput) {
            // 1. Tìm tất cả các mã sách đang có trong bảng (giả sử mã nằm trong các ô <td> hoặc có class cụ thể)
            // Thay đổi 'td' thành selector phù hợp với bảng của bạn nếu cần
            const existingIds = Array.from(document.querySelectorAll('td'))
                .map(el => el.innerText.trim())
                .filter(text => text.startsWith('MS'));

            let nextNumber = 1;

            if (existingIds.length > 0) {
                // 2. Lấy số lớn nhất từ các mã hiện có (ví dụ từ 'MS0005' lấy ra 5)
                const numbers = existingIds.map(id => {
                    const match = id.match(/MS(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                });
                nextNumber = Math.max(...numbers) + 1;
            }

            // 3. Định dạng lại chuỗi với 4 chữ số (Padding) -> MS000X
            const newMaSach = `MS${nextNumber.toString().padStart(4, '0')}`;

            bookIdInput.value = newMaSach;
        }
    }, 150); // Tăng delay một chút để đảm bảo DOM đã sẵn sàng
};
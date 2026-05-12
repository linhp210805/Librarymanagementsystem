/* =========================================================
   STOCK_FIXED.JS - HIỂN THỊ DANH SÁCH TRONG KHO
========================================================= */

// 1. Dữ liệu đã được render bởi Django template
console.log("Stock page loaded - showing data from Django template");

// 2. Hàm quay về trang danh sách sách
function goBack() {
    window.location.href = '/books/';
}

// 3. Các hàm xử lý nếu cần (hiện tại chỉ hiển thị)
function initStockPage() {
    console.log("Stock page initialized");
    
    // Thêm sự kiện cho các nút nếu có
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.onclick) return; // Đã có onclick trong HTML
        
        // Có thể thêm các xử lý khác ở đây nếu cần
    });
}

// Khởi tạo trang khi load xong
document.addEventListener('DOMContentLoaded', initStockPage);

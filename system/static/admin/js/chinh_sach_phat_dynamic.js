// Ẩn/hiện các trường mức phí phù hợp với loại phạt trong admin ChinhSachPhat
(function() {
    function updateFields() {
        var loaiPhatInput = document.getElementById('id_loai_phat');
        if (!loaiPhatInput) return;
        var loaiPhat = loaiPhatInput.value.toLowerCase();
        var field_moi_ngay = document.querySelector('.form-row.field-muc_phat_moi_ngay');
        var field_hu_hong = document.querySelector('.form-row.field-muc_phat_hu_hong');
        var field_mat_sach = document.querySelector('.form-row.field-muc_den_bu_mat_sach');
        if (field_moi_ngay) field_moi_ngay.style.display = 'none';
        if (field_hu_hong) field_hu_hong.style.display = 'none';
        if (field_mat_sach) field_mat_sach.style.display = 'none';
        if (loaiPhat.includes('trễ hạn')) {
            if (field_moi_ngay) field_moi_ngay.style.display = '';
        } else if (loaiPhat.includes('hư hỏng')) {
            if (field_hu_hong) field_hu_hong.style.display = '';
        } else if (loaiPhat.includes('mất sách')) {
            if (field_mat_sach) field_mat_sach.style.display = '';
        }
    }
    document.addEventListener('DOMContentLoaded', updateFields);
    document.getElementById('id_loai_phat')?.addEventListener('input', updateFields);
})();


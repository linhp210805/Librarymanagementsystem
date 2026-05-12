from django.db import models, transaction
from django.core.exceptions import ValidationError
import base64
import hashlib

class Sach(models.Model):
    # editable=False để ẩn khỏi form nhập liệu vì máy tự sinh
    ma_sach = models.CharField(max_length=15, primary_key=True, editable=False)
    ten_sach = models.CharField(max_length=255)
    ten_tac_gia = models.CharField(max_length=255, blank=True, null=True)
    the_loai = models.CharField(max_length=100, blank=True, null=True)
    ten_nha_xuat_ban = models.CharField(max_length=255, blank=True, null=True)
    nam_xuat_ban = models.PositiveIntegerField()
    so_luong = models.PositiveIntegerField()

    class Meta:
        db_table = 'Sach'
        verbose_name = 'Sách'
        verbose_name_plural = 'Sách'

    def save(self, *args, **kwargs):
        # Tự sinh mã chính khi tạo mới
        if not self.ma_sach:
            last_book = Sach.objects.all().order_by('ma_sach').last()
            if not last_book:
                self.ma_sach = "MS0001"
            else:
                last_id_num = int(last_book.ma_sach[2:])
                self.ma_sach = f"MS{str(last_id_num + 1).zfill(4)}"

        with transaction.atomic():
            super().save(*args, **kwargs)
            self.dong_bo_kho()  # Luôn kiểm tra để đẻ thêm nếu thiếu

    def dong_bo_kho(self):
        prefix = self.ma_sach
        
        # Đếm tổng số record trong kho (bao gồm cả những sách đã mất)
        total_count = self.sach_trong_kho.count()
        # Đếm số lượng sách bị mất
        lost_count = self.sach_trong_kho.filter(trang_thai_sach='lost').count()
        
        # Số lượng sách thực tế còn trong hệ thống (không tính sách mất)
        active_count = total_count - lost_count

        # Nếu số lượng khai báo mới lớn hơn số lượng đang active -> Đẻ thêm
        if active_count < self.so_luong:
            items_to_create = []
            num_to_create = self.so_luong - active_count
            for i in range(total_count + 1, total_count + num_to_create + 1):
                # Mã kho ví dụ: MS0001-001
                ma_kho = f"{prefix}-{str(i).zfill(3)}"

                # Mã vạch sẽ lấy theo mã kho cho sạch sẽ và dễ quét
                ma_vach = f"BC-{ma_kho}"

                items_to_create.append(SachTrongKho(
                    ma_sach_trong_kho=ma_kho,
                    ma_sach=self,
                    ma_vach=ma_vach,
                    trang_thai_sach='available'
                ))
            SachTrongKho.objects.bulk_create(items_to_create)

    def __str__(self):
        return f"{self.ma_sach} - {self.ten_sach}"


class SachTrongKho(models.Model):
    # Để max_length dài ra tí cho thoải mái
    class TrangThai(models.TextChoices):
        AVAILABLE = 'available', 'Có sẵn'
        BORROWED = 'borrowed', 'Đang mượn'
        OVERDUE = 'overdue', 'Quá hạn'
        AWAITING_REPLACEMENT = 'awaiting_replacement', 'Chờ đền sách'
        PROCESSED = 'processed', 'Đã xử lý (Đã đền bù)'
        DAMAGED = 'damaged', 'Hư hỏng'
        LOST = 'lost', 'Đã mất'
        DISCONTINUED = 'discontinued', 'Ngừng sử dụng'

    ma_sach_trong_kho = models.CharField(max_length=25, primary_key=True, editable=False)
    ma_sach = models.ForeignKey(Sach, on_delete=models.CASCADE, related_name='sach_trong_kho')
    ma_vach = models.CharField(max_length=50, unique=True, editable=False)
    trang_thai_sach = models.CharField(
        max_length=30,  # Tăng max_length lên tí cho thoải mái
        choices=TrangThai.choices,
        default=TrangThai.AVAILABLE
    )
    class Meta:
        db_table = 'SachTrongKho'
        ordering = ['ma_sach_trong_kho']
        verbose_name = 'Sách trong kho'
        verbose_name_plural = 'Sách trong kho'

    def __str__(self):
        return f"{self.ma_sach_trong_kho} - {self.ma_sach.ten_sach}"
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils import timezone
import uuid

class ChinhSachPhat(models.Model):
    ma_loai_phat = models.CharField(max_length=32, primary_key=True, editable=False)
    loai_phat = models.CharField(max_length=100)
    muc_phat_moi_ngay = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0)]
    )
    muc_phat_hu_hong = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0)]
    )
    muc_den_bu_mat_sach = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'ChinhSachPhat'
        ordering = ['loai_phat']
        verbose_name = 'Chính sách phạt'
        verbose_name_plural = 'Chính sách phạt'

    def __str__(self):
        return f"{self.ma_loai_phat} - {self.loai_phat}"

    def save(self, *args, **kwargs):
        if not self.ma_loai_phat:
            self.ma_loai_phat = f"RULE-{uuid.uuid4().hex[:24].upper()}"
        super().save(*args, **kwargs)


class KhoanPhat(models.Model):
    ma_phat = models.CharField(max_length=32, primary_key=True, editable=False)
    ma_nguoi_dung = models.ForeignKey(
        'quan_ly_nguoi_dung.NguoiDung',
        on_delete=models.PROTECT,
        related_name='khoan_phat'
    )
    ma_phieu_muon = models.ForeignKey(
        'muon_sach.PhieuMuon',
        on_delete=models.PROTECT,
        related_name='khoan_phat'
    )
    ma_sach_trong_kho = models.ForeignKey(
        'quan_ly_sach.SachTrongKho',
        on_delete=models.PROTECT,
        related_name='khoan_phat'
    )
    ma_loai_phat = models.ForeignKey(
        ChinhSachPhat,
        on_delete=models.PROTECT,
        related_name='khoan_phat'
    )
    so_tien = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    ngay_tao = models.DateTimeField(default=timezone.now)
    trang_thai_tt = models.CharField(max_length=50)
    ly_do = models.CharField(max_length=255, blank=True, null=True)
    nguoi_tao = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='khoan_phat_da_tao',
        blank=True,
        null=True
    )

    class Meta:
        db_table = 'KhoanPhat'
        ordering = ['-ngay_tao']
        verbose_name = 'Khoản phạt'
        verbose_name_plural = 'Khoản phạt'

    def __str__(self):
        return self.ma_phat

    def save(self, *args, **kwargs):
        if not self.ma_phat:
            self.ma_phat = f"FINE-{uuid.uuid4().hex[:24].upper()}"
        super().save(*args, **kwargs)


class GiaoDichThanhToan(models.Model):
    ma_giao_dich = models.CharField(max_length=32, primary_key=True, editable=False)
    ma_nguoi_dung = models.ForeignKey(
        'quan_ly_nguoi_dung.NguoiDung',
        on_delete=models.PROTECT,
        related_name='giao_dich_thanh_toan'
    )
    tong_so_tien = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    phuong_thuc = models.CharField(max_length=50, blank=True, null=True)
    thoi_gian_thanh_toan = models.DateTimeField(default=timezone.now)
    trang_thai = models.CharField(max_length=50)
    nguoi_thu = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='giao_dich_da_thu',
        blank=True,
        null=True
    )

    class Meta:
        db_table = 'GiaoDichThanhToan'
        ordering = ['-thoi_gian_thanh_toan']
        verbose_name = 'Giao dịch thanh toán'
        verbose_name_plural = 'Giao dịch thanh toán'

    def __str__(self):
        return self.ma_giao_dich

    def save(self, *args, **kwargs):
        if not self.ma_giao_dich:
            self.ma_giao_dich = f"PAY-{uuid.uuid4().hex[:24].upper()}"
        super().save(*args, **kwargs)


class ChiTietThanhToan(models.Model):
    ma_giao_dich = models.ForeignKey(
        GiaoDichThanhToan,
        on_delete=models.CASCADE,
        related_name='chi_tiet_thanh_toan'
    )
    ma_phat = models.ForeignKey(
        KhoanPhat,
        on_delete=models.CASCADE,
        related_name='chi_tiet_thanh_toan'
    )
    so_tien_thanh_toan = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'ChiTietThanhToan'
        verbose_name = 'Chi tiết thanh toán'
        verbose_name_plural = 'Chi tiết thanh toán'
        constraints = [
            models.UniqueConstraint(
                fields=['ma_giao_dich', 'ma_phat'],
                name='unique_chi_tiet_thanh_toan'
            )
        ]

    def __str__(self):
        return f"{self.ma_giao_dich_id} - {self.ma_phat_id}"

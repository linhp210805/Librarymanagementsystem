from django.db import models
from django.contrib.auth.models import User

class NguoiDung(models.Model):
    LOAI_NGUOI_DUNG_CHOICES = [
        ('doc_gia', 'Độc giả'),
        ('thu_thu', 'Thủ thư'),
        ('quan_tri', 'Quản trị viên'),
    ]

    ma_nguoi_dung = models.CharField(max_length=10, primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='nguoi_dung',
        blank=True,
        null=True
    )
    loai_nguoi_dung = models.CharField(max_length=20, choices=LOAI_NGUOI_DUNG_CHOICES)
    ho_ten = models.CharField(max_length=255)
    lop = models.CharField(max_length=50, blank=True, null=True)
    trang_thai_tot_nghiep = models.BooleanField(default=False)
    email = models.EmailField(blank=True, null=True)
    so_dien_thoai = models.CharField(max_length=15, blank=True, null=True)

    class Meta:
        db_table = 'NguoiDung'
        ordering = ['ho_ten']
        verbose_name = 'Người dùng'
        verbose_name_plural = 'Người dùng'

    def __str__(self):
        return f"{self.ma_nguoi_dung} - {self.ho_ten}"
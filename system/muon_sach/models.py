from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

class PhieuMuon(models.Model):
    TRANG_THAI_MUON_CHOICES = [
        ('dang_muon', 'Đang mượn'),
        ('qua_han', 'Quá hạn'),
        ('da_tra', 'Đã trả'),
        ('dang_xu_ly', 'Đang xử lý'),
        ('cho_den_sach', 'Chờ đền sách'),
    ]
    ma_phieu_muon = models.CharField(max_length=10, primary_key=True)

    def save(self, *args, **kwargs):
        if not self.ma_phieu_muon:
            # Lấy phiếu mượn cuối cùng dựa trên mã
            last_pm = PhieuMuon.objects.all().order_by('ma_phieu_muon').last()

            if not last_pm:
                # Nếu chưa có phiếu nào, bắt đầu từ PM0000001
                self.ma_phieu_muon = 'PM0000001'
            else:
                # Cắt chuỗi bỏ 'PM', lấy phần số và tăng thêm 1
                last_number = int(last_pm.ma_phieu_muon[2:])
                new_number = last_number + 1
                # Ghép lại với tiền tố PM và format 7 chữ số (tổng độ dài là 9)
                self.ma_phieu_muon = 'PM' + str(new_number).zfill(7)

        super(PhieuMuon, self).save(*args, **kwargs)
    ma_nguoi_dung = models.ForeignKey(
        'quan_ly_nguoi_dung.NguoiDung',
        on_delete=models.PROTECT,
        related_name='phieu_muon'
    )
    ngay_muon = models.DateField(default=timezone.now)
    trang_thai = models.CharField(
        max_length=20,
        choices=TRANG_THAI_MUON_CHOICES,
        default='dang_muon',
        verbose_name="Trạng thái mượn"
    )
    nguoi_tao = models.ForeignKey(
        'quan_ly_nguoi_dung.NguoiDung',
        on_delete=models.PROTECT,
        related_name='phieu_muon_da_tao'
    )

    class Meta:
        db_table = 'PhieuMuon'
        ordering = ['-ngay_muon']
        verbose_name = 'Phiếu mượn'
        verbose_name_plural = 'Phiếu mượn'
        permissions = [
            ('extend_phieumuon', 'Can extend borrow slip'),
        ]

    def __str__(self):
        return f"{self.ma_phieu_muon}- {self.get_trang_thai_display()}"

    def sync_status(self):
        """
        Calculates and updates the trang_thai field based on book details and current date.
        The order of checking status is important.
        """
        chi_tiet = self.chi_tiet_phieu_muon.all()
        if not chi_tiet.exists():
            return self.trang_thai

        today = timezone.now().date()
        
        # Flags to determine the overall status
        all_returned = True
        any_overdue = False
        any_pending_replace = False
        any_processing_loss = False

        for ct in chi_tiet:
            if ct.ngay_tra is None:
                all_returned = False # Nếu có bất kỳ cuốn nào chưa trả, thì phiếu chưa thể "đã trả"

                if ct.phuong_an_boi_thuong == 'den_sach_moi':
                    any_pending_replace = True
                elif ct.phuong_an_boi_thuong == 'den_bu_tien':
                    any_processing_loss = True
                else:
                    due_date = ct.ngay_gia_han if ct.ngay_gia_han else ct.han_tra
                    if due_date < today:
                        any_overdue = True

        # Determine the new status based on priority
        if all_returned:
            new_status = 'da_tra'
        elif any_pending_replace:
            new_status = 'cho_den_sach'
        elif any_processing_loss:
            new_status = 'dang_xu_ly'
        elif any_overdue:
            new_status = 'qua_han'
        else:
            new_status = 'dang_muon'

        if self.trang_thai != new_status:
            self.trang_thai = new_status
            PhieuMuon.objects.filter(pk=self.pk).update(trang_thai=new_status)
        
        return new_status


class ChiTietPhieuMuon(models.Model):
    ma_phieu_muon = models.ForeignKey(
        PhieuMuon,
        on_delete=models.CASCADE,
        related_name='chi_tiet_phieu_muon'
    )
    ma_sach_trong_kho = models.ForeignKey(
        'quan_ly_sach.SachTrongKho',
        on_delete=models.PROTECT,
        related_name='chi_tiet_phieu_muon'
    )
    han_tra = models.DateField()
    ngay_tra = models.DateField(blank=True, null=True)
    ngay_gia_han = models.DateField(blank=True, null=True, verbose_name="Ngày gia hạn")
    tinh_trang_khi_tra = models.CharField(max_length=100, blank=True, null=True)
    ngay_khai_bao_mat = models.DateField(blank=True, null=True)
    phuong_an_boi_thuong = models.CharField(
        max_length=20,
        choices=[
            ('', 'Chưa chọn'),
            ('den_bu_tien', 'Bồi thường tiền'),
            ('den_sach_moi', 'Đền sách mới')
        ],
        default='',
        blank=True,
        verbose_name='Phương án bồi thường'
    )

    class Meta:
        db_table = 'ChiTietPhieuMuon'
        verbose_name = 'Chi tiết phiếu mượn'
        verbose_name_plural = 'Chi tiết phiếu mượn'
        constraints = [
            models.UniqueConstraint(
                fields=['ma_phieu_muon', 'ma_sach_trong_kho'],
                name='unique_chi_tiet_phieu_muon'
            )
        ]

    def clean(self):
        if self.han_tra and self.ma_phieu_muon and self.han_tra < self.ma_phieu_muon.ngay_muon:
            raise ValidationError({'han_tra': 'Hạn trả không được nhỏ hơn ngày mượn.'})

        if self.ngay_tra and self.ma_phieu_muon and self.ngay_tra < self.ma_phieu_muon.ngay_muon:
            raise ValidationError({'ngay_tra': 'Ngày trả không được nhỏ hơn ngày mượn.'})

    def __str__(self):
        return f"{self.ma_phieu_muon_id} - {self.ma_sach_trong_kho_id}"

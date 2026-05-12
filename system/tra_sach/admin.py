from django.contrib import admin
from .models import ChinhSachPhat, KhoanPhat, GiaoDichThanhToan, ChiTietThanhToan
from django import forms
from django.core.exceptions import ValidationError

class ChinhSachPhatForm(forms.ModelForm):
	class Meta:
		model = ChinhSachPhat
		fields = '__all__'
		widgets = {
			'muc_phat_moi_ngay': forms.NumberInput(attrs={
				'step': 1000,
				'min': 0,
				'style': 'width: 200px;',
				'inputmode': 'numeric',
			}),
			'muc_phat_hu_hong': forms.NumberInput(attrs={
				'step': 1000,
				'min': 0,
				'style': 'width: 200px;',
				'inputmode': 'numeric',
			}),
			'muc_den_bu_mat_sach': forms.NumberInput(attrs={
				'step': 1000,
				'min': 0,
				'style': 'width: 200px;',
				'inputmode': 'numeric',
			}),
		}

	def clean(self):
		cleaned_data = super().clean()
		loai_phat = cleaned_data.get('loai_phat', '').lower()
		muc_phat_moi_ngay = cleaned_data.get('muc_phat_moi_ngay')
		muc_phat_hu_hong = cleaned_data.get('muc_phat_hu_hong')
		muc_den_bu_mat_sach = cleaned_data.get('muc_den_bu_mat_sach')
		# Chỉ cho phép nhập đúng một loại mức phí
		count = sum([
			bool(muc_phat_moi_ngay),
			bool(muc_phat_hu_hong),
			bool(muc_den_bu_mat_sach)
		])
		if count != 1:
			raise ValidationError('Chỉ nhập đúng một mức phí phù hợp với loại phạt.')
		# Kiểm tra loại phạt phù hợp với trường mức phí
		if 'trễ hạn' in loai_phat and not muc_phat_moi_ngay:
			raise ValidationError('Loại phạt trễ hạn phải nhập mức phạt mỗi ngày.')
		if 'hư hỏng' in loai_phat and not muc_phat_hu_hong:
			raise ValidationError('Loại phạt hư hỏng phải nhập mức phạt hư hỏng.')
		if 'mất sách' in loai_phat and not muc_den_bu_mat_sach:
			raise ValidationError('Loại phạt mất sách phải nhập mức đền bù mất sách.')
		return cleaned_data

class ChinhSachPhatAdmin(admin.ModelAdmin):
	form = ChinhSachPhatForm
	list_display = ("ma_loai_phat", "loai_phat", "muc_phat_moi_ngay", "muc_phat_hu_hong", "muc_den_bu_mat_sach")
    
	class Media:
		js = ("admin/js/chinh_sach_phat_dynamic.js",)

# Đăng ký lại admin với custom form
try:
	admin.site.unregister(ChinhSachPhat)
except admin.sites.NotRegistered:
	pass
admin.site.register(ChinhSachPhat, ChinhSachPhatAdmin)

class KhoanPhatForm(forms.ModelForm):
    # Ẩn trường số ngày quá hạn, chỉ dùng nội bộ
    class Meta:
        model = KhoanPhat
        fields = '__all__'
        widgets = {
            'so_tien': forms.NumberInput(attrs={'readonly': 'readonly', 'style': 'width: 200px;'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ẩn trường số ngày quá hạn nếu có
        if 'so_ngay_qua_han' in self.fields:
            self.fields['so_ngay_qua_han'].widget = forms.HiddenInput()

    def clean(self):
        cleaned_data = super().clean()
        chinh_sach = cleaned_data.get('ma_loai_phat')
        phieu_muon = cleaned_data.get('ma_phieu_muon')
        sach_trong_kho = cleaned_data.get('ma_sach_trong_kho')
        if chinh_sach:
            loai_phat = chinh_sach.loai_phat.lower()
            if 'trễ hạn' in loai_phat:
                # Tự động tính số ngày quá hạn
                if phieu_muon and hasattr(phieu_muon, 'ngay_tra') and hasattr(phieu_muon, 'han_tra'):
                    ngay_tra = phieu_muon.ngay_tra
                    han_tra = phieu_muon.han_tra
                    if ngay_tra and han_tra and ngay_tra > han_tra:
                        so_ngay_qua_han = (ngay_tra - han_tra).days
                        if so_ngay_qua_han < 1:
                            raise ValidationError('Số ngày quá hạn phải lớn hơn 0.')
                        muc = chinh_sach.muc_phat_moi_ngay or 0
                        cleaned_data['so_tien'] = muc * so_ngay_qua_han
                    else:
                        raise ValidationError('Không có số ngày quá hạn hoặc ngày trả chưa vượt hạn trả.')
                else:
                    raise ValidationError('Không đủ thông tin phiếu mượn để tính số ngày quá hạn.')
            elif 'hư hỏng' in loai_phat:
                cleaned_data['so_tien'] = chinh_sach.muc_phat_hu_hong or 0
            elif 'mất sách' in loai_phat:
                # Kiểm tra phương án bồi thường của ChiTietPhieuMuon
                from muon_sach.models import ChiTietPhieuMuon
                ctpm = None
                if phieu_muon and sach_trong_kho:
                    ctpm = ChiTietPhieuMuon.objects.filter(ma_phieu_muon=phieu_muon, ma_sach_trong_kho=sach_trong_kho).first()
                if ctpm and ctpm.phuong_an_boi_thuong == 'den_bu_tien':
                    cleaned_data['so_tien'] = chinh_sach.muc_den_bu_mat_sach or 0
                else:
                    raise ValidationError('Chỉ tạo khoản phạt mất sách khi phương án bồi thường là "Bồi thường tiền".')
            else:
                cleaned_data['so_tien'] = 0
        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        chinh_sach = instance.ma_loai_phat
        phieu_muon = instance.ma_phieu_muon
        sach_trong_kho = instance.ma_sach_trong_kho
        if chinh_sach:
            loai_phat = chinh_sach.loai_phat.lower()
            if 'trễ hạn' in loai_phat:
                if phieu_muon and hasattr(phieu_muon, 'ngay_tra') and hasattr(phieu_muon, 'han_tra'):
                    ngay_tra = phieu_muon.ngay_tra
                    han_tra = phieu_muon.han_tra
                    if ngay_tra and han_tra and ngay_tra > han_tra:
                        so_ngay_qua_han = (ngay_tra - han_tra).days
                        instance.so_tien = (chinh_sach.muc_phat_moi_ngay or 0) * so_ngay_qua_han
            elif 'hư hỏng' in loai_phat:
                instance.so_tien = chinh_sach.muc_phat_hu_hong or 0
            elif 'mất sách' in loai_phat:
                from muon_sach.models import ChiTietPhieuMuon
                ctpm = None
                if phieu_muon and sach_trong_kho:
                    ctpm = ChiTietPhieuMuon.objects.filter(ma_phieu_muon=phieu_muon, ma_sach_trong_kho=sach_trong_kho).first()
                if ctpm and ctpm.phuong_an_boi_thuong == 'den_bu_tien':
                    instance.so_tien = chinh_sach.muc_den_bu_mat_sach or 0
                else:
                    instance.so_tien = 0
        if commit:
            instance.save()
        return instance

class KhoanPhatAdmin(admin.ModelAdmin):
    form = KhoanPhatForm
    list_display = ("ma_phat", "ma_nguoi_dung", "ma_phieu_muon", "ma_sach_trong_kho", "ma_loai_phat", "so_tien", "ngay_tao", "trang_thai_tt")
    readonly_fields = ("so_tien",)

# Đăng ký lại admin với custom form
try:
    admin.site.unregister(KhoanPhat)
except admin.sites.NotRegistered:
    pass
admin.site.register(KhoanPhat, KhoanPhatAdmin)
admin.site.register(GiaoDichThanhToan)
admin.site.register(ChiTietThanhToan)

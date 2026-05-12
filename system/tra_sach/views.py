from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponseBadRequest
from django.db import transaction
from muon_sach.models import PhieuMuon, ChiTietPhieuMuon

from .models import KhoanPhat, ChinhSachPhat, ChiTietThanhToan
from django.utils import timezone
from decimal import Decimal
from django.db.models import Q, Exists, OuterRef

def _create_fine(ma_nguoi_dung, ma_phieu_muon, ma_sach_trong_kho, ma_loai_phat, so_tien, ly_do, nguoi_tao):
    """Hàm hỗ trợ tạo khoản phạt."""
    if so_tien > 0:
        KhoanPhat.objects.create(
            ma_nguoi_dung=ma_nguoi_dung,
            ma_phieu_muon=ma_phieu_muon,
            ma_sach_trong_kho=ma_sach_trong_kho,
            ma_loai_phat=ma_loai_phat,
            so_tien=so_tien,
            trang_thai_tt='Chưa thanh toán',
            ly_do=ly_do,
            nguoi_tao=nguoi_tao
        )


UNPAID_STATUS = 'Chưa thanh toán'
PAID_STATUS = 'Đã thanh toán'


def _sync_fine_statuses():
    """Dong bo trang thai KhoanPhat dua tren chi tiet thanh toan de tranh lech du lieu."""
    payment_detail_qs = ChiTietThanhToan.objects.filter(ma_phat=OuterRef('pk'))
    fines = KhoanPhat.objects.annotate(has_payment=Exists(payment_detail_qs)).values('ma_phat', 'trang_thai_tt', 'has_payment')

    to_paid_ids = []
    to_unpaid_ids = []
    for fine in fines:
        if fine['has_payment']:
            if fine['trang_thai_tt'] != PAID_STATUS:
                to_paid_ids.append(fine['ma_phat'])
        elif fine['trang_thai_tt'] != UNPAID_STATUS:
            to_unpaid_ids.append(fine['ma_phat'])

    if to_paid_ids:
        KhoanPhat.objects.filter(ma_phat__in=to_paid_ids).update(trang_thai_tt=PAID_STATUS)
    if to_unpaid_ids:
        KhoanPhat.objects.filter(ma_phat__in=to_unpaid_ids).update(trang_thai_tt=UNPAID_STATUS)

@login_required
def return_list_view(request):
    _sync_fine_statuses()

    # Tab 1: Danh sách sách (Tất cả: Đang mượn + Đã trả)
    chi_tiet_muon = ChiTietPhieuMuon.objects.all().select_related(
        'ma_phieu_muon', 'ma_sach_trong_kho', 'ma_phieu_muon__ma_nguoi_dung', 'ma_sach_trong_kho__ma_sach'
    ).order_by('ma_phieu_muon')
    
    tab1_grouped = {}
    for ct in chi_tiet_muon:
        pm = ct.ma_phieu_muon
        key = pm.ma_phieu_muon
        if key not in tab1_grouped:
            tab1_grouped[key] = {
                'ma_phieu_muon': pm.ma_phieu_muon,
                'ma_nguoi_dung': pm.ma_nguoi_dung.ma_nguoi_dung,
                'nguoi_muon': pm.ma_nguoi_dung.ho_ten,
                'ngay_muon': pm.ngay_muon,
                'trang_thai': pm.get_trang_thai_display(),
                'sach_list': []
            }
        sach_trong_kho = ct.ma_sach_trong_kho
        sach = sach_trong_kho.ma_sach
        
        # Xác định trạng thái của từng cuốn sách (ChiTietPhieuMuon)
        is_returned = ct.ngay_tra is not None
        is_lost = ct.ngay_khai_bao_mat is not None
        is_overdue = not is_returned and not is_lost and ct.han_tra < timezone.now().date()
        
        book_status_key = 'da_tra' if is_returned else \
                          'da_mat' if is_lost else \
                          'qua_han' if is_overdue else \
                          'dang_muon'

        tab1_grouped[key]['sach_list'].append({
            'ma_sach_trong_kho': sach_trong_kho.ma_sach_trong_kho,
            'ten_sach': sach.ten_sach,
            'han_tra': ct.han_tra,
            'ngay_tra': ct.ngay_tra,
            'tinh_trang': ct.tinh_trang_khi_tra,
            'is_returned': is_returned,
            'is_lost': is_lost,
            'is_overdue': is_overdue,
            'so_ngay_qua_han': (timezone.now().date() - ct.han_tra).days if is_overdue else 0,
            'status_key': book_status_key, # Trạng thái riêng của sách
        })
    tab1_data = sorted(
        tab1_grouped.values(),
        key=lambda item: item['ma_phieu_muon'],
        reverse=True
    )

    # Tab 2: Danh sách người dùng có khoản phạt (hiển thị cả lịch sử đã thanh toán và chưa thanh toán)
    # Lưu ý: 'tong_tien' sẽ chỉ tính các khoản CHƯA thanh toán để UI biết ai còn nợ
    unpaid_detail_qs = ChiTietThanhToan.objects.filter(ma_phat=OuterRef('pk'))
    khoan_phat_all = (
        KhoanPhat.objects.select_related('ma_nguoi_dung', 'ma_loai_phat')
        .annotate(has_payment=Exists(unpaid_detail_qs))
    )

    tab2_users = {}
    for kp in khoan_phat_all:
        nd = kp.ma_nguoi_dung
        uid = nd.ma_nguoi_dung
        if uid not in tab2_users:
            tab2_users[uid] = {
                'ma_nguoi_dung': uid,
                'ho_ten': nd.ho_ten,
                'tong_tien': 0.0,  # chỉ cộng các khoản chưa thanh toán
                'ly_do_phat': [],
                'has_any_fine': False,
            }

        tab2_users[uid]['has_any_fine'] = True
        # Nếu khoản phạt chưa có bản ghi thanh toán, cộng vào tong_tien
        if not getattr(kp, 'has_payment', False):
            tab2_users[uid]['tong_tien'] += float(kp.so_tien)

        loai_phat = kp.ma_loai_phat.loai_phat if kp.ma_loai_phat else 'Khác'
        tab2_users[uid]['ly_do_phat'].append(loai_phat)

    # Chuẩn hóa dữ liệu: loại bỏ trùng lặp lý do, và chuyển về danh sách
    for k, v in tab2_users.items():
        v['ly_do_phat'] = list(set(v['ly_do_phat']))

    # Hiển thị tất cả người dùng có khoản phạt (cả đã thanh toán và chưa thanh toán)
    tab2_data = list(tab2_users.values())

    # Tab 3: Danh sách báo mất (Hiện tất cả phiếu chưa trả để báo mất, cả những cái đã báo mất)
    lost_qs = ChiTietPhieuMuon.objects.filter(
        ngay_tra__isnull=True
    ).select_related('ma_phieu_muon', 'ma_sach_trong_kho', 'ma_phieu_muon__ma_nguoi_dung', 'ma_sach_trong_kho__ma_sach')
    
    tab3_grouped = {}
    for ct in lost_qs:
        pm = ct.ma_phieu_muon
        key = pm.ma_phieu_muon
        if key not in tab3_grouped:
            tab3_grouped[key] = {
                'ma_phieu_muon': pm.ma_phieu_muon,
                'ma_nguoi_dung': pm.ma_nguoi_dung.ma_nguoi_dung,
                'nguoi_muon': pm.ma_nguoi_dung.ho_ten,
                'trang_thai': pm.get_trang_thai_display(),
                'sach_list': []
            }
        sach_trong_kho = ct.ma_sach_trong_kho
        sach = sach_trong_kho.ma_sach
        is_lost = ct.ngay_khai_bao_mat is not None
        is_overdue = ct.han_tra < timezone.now().date() if not ct.ngay_tra else ct.han_tra < ct.ngay_tra
        
        tab3_grouped[key]['sach_list'].append({
            'ma_sach_trong_kho': sach_trong_kho.ma_sach_trong_kho,
            'ten_sach': sach.ten_sach,
            'han_tra': ct.han_tra,
            'is_lost': is_lost,
            'is_overdue': is_overdue,
            'ngay_mat': ct.ngay_khai_bao_mat,
            'so_ngay_qua_han': (timezone.now().date() - ct.han_tra).days if is_overdue and not ct.ngay_tra else 0,
        })
    tab3_data = list(tab3_grouped.values())

    # Tab 4: Danh sách hồ sơ chờ xác nhận đền sách (Chỉ các trường hợp chọn đền sách mới)
    comp_qs = ChiTietPhieuMuon.objects.filter(
        ngay_khai_bao_mat__isnull=False,
        phuong_an_boi_thuong='den_sach_moi'
    ).select_related('ma_phieu_muon', 'ma_sach_trong_kho', 'ma_phieu_muon__ma_nguoi_dung', 'ma_sach_trong_kho__ma_sach')
    
    tab4_grouped = {}
    for ct in comp_qs:
        pm = ct.ma_phieu_muon
        key = pm.ma_phieu_muon
        if key not in tab4_grouped:
            tab4_grouped[key] = {
                'ma_phieu_muon': pm.ma_phieu_muon,
                'ma_nguoi_dung': pm.ma_nguoi_dung.ma_nguoi_dung,
                'nguoi_muon': pm.ma_nguoi_dung.ho_ten,
                'trang_thai': pm.get_trang_thai_display(),
                'sach_list': []
            }
        sach_trong_kho = ct.ma_sach_trong_kho
        sach = sach_trong_kho.ma_sach
        if ct.ngay_tra is not None:
            comp_status_key = 'da_tra'
            comp_status_label = 'Đã hoàn thành'
            comp_confirmable = False
        elif ct.phuong_an_boi_thuong == 'den_sach_moi':
            comp_status_key = 'cho_den_sach'
            comp_status_label = 'Chờ đền sách'
            comp_confirmable = True
        elif ct.phuong_an_boi_thuong == 'den_bu_tien':
            comp_status_key = 'dang_xu_ly'
            comp_status_label = 'Đang xử lý'
            comp_confirmable = False
        else:
            comp_status_key = 'dang_muon'
            comp_status_label = 'Đang mượn'
            comp_confirmable = False
        tab4_grouped[key]['sach_list'].append({
            'ma_sach_trong_kho': sach_trong_kho.ma_sach_trong_kho,
            'ten_sach': sach.ten_sach,
            'ngay_khai_bao_mat': ct.ngay_khai_bao_mat,
            'status_key': comp_status_key,
            'status_label': comp_status_label,
            'can_confirm': comp_confirmable,
        })
    tab4_data = list(tab4_grouped.values())

    # Lấy tất cả chính sách phạt hư hỏng từ CSDL
    import json
    chinh_sach_hu_hong = ChinhSachPhat.objects.filter(muc_phat_hu_hong__isnull=False).order_by('muc_phat_hu_hong')
    damage_fines_dict = {}
    for cs in chinh_sach_hu_hong:
        if 'nhẹ' in cs.loai_phat.lower():
            damage_fines_dict['light'] = float(cs.muc_phat_hu_hong)
        elif 'vừa' in cs.loai_phat.lower():
            damage_fines_dict['medium'] = float(cs.muc_phat_hu_hong)
        elif 'nặng' in cs.loai_phat.lower():
            damage_fines_dict['severe'] = float(cs.muc_phat_hu_hong)
    damage_fines_json = json.dumps(damage_fines_dict)
    
    # Lấy mức phạt trễ hạn
    chinh_sach_tre_han = ChinhSachPhat.objects.filter(loai_phat__icontains='Trễ hạn').first()
    overdue_rate = float(chinh_sach_tre_han.muc_phat_moi_ngay) if chinh_sach_tre_han and chinh_sach_tre_han.muc_phat_moi_ngay else 0

    # Lấy phí phạt mất sách
    chinh_sach_mat_sach = ChinhSachPhat.objects.filter(loai_phat__icontains='Mất sách').first()
    lost_fee = float(chinh_sach_mat_sach.muc_den_bu_mat_sach) if chinh_sach_mat_sach and chinh_sach_mat_sach.muc_den_bu_mat_sach else 0

    context = {
        'tab1_data': tab1_data,
        'tab2_data': tab2_data,
        'tab3_data': tab3_data,
        'tab4_data': tab4_data,
        'damage_fines': damage_fines_json,
        'chinh_sach_hu_hong': chinh_sach_hu_hong,
        'overdue_rate': overdue_rate,
        'lost_fee': lost_fee,
    }
    return render(request, 'tra_sach/return_list.html', context)

@login_required
def return_list(request):
    return return_list_view(request)

@login_required
@require_POST
def api_xac_nhan_tra_sach(request):
    """
    API xác nhận trả sách: kiểm tra trạng thái, cập nhật trạng thái, tạo khoản phạt nếu cần.
    Yêu cầu POST: ma_phieu_muon, ma_sach_trong_kho, tinh_trang_khi_tra ('tot'/'hu_hong'), mo_ta_hu_hong (nếu có)
    """
    try:
        ma_phieu_muon = request.POST.get('ma_phieu_muon')
        ma_sach_trong_kho = request.POST.get('ma_sach_trong_kho')
        tinh_trang = request.POST.get('tinh_trang')
        mo_ta_hu_hong = request.POST.get('mo_ta_hu_hong', '')
        damage_level_id = request.POST.get('damage_level', '')  # ID của loại phạt hư hỏng
        nguoi_xac_nhan = request.user

        if not (ma_phieu_muon and ma_sach_trong_kho and tinh_trang):
            return HttpResponseBadRequest('Thiếu thông tin bắt buộc')

        with transaction.atomic():
            ctpm = ChiTietPhieuMuon.objects.select_for_update().get(
                ma_phieu_muon__ma_phieu_muon=ma_phieu_muon,
                ma_sach_trong_kho__ma_sach_trong_kho=ma_sach_trong_kho,
                ngay_tra__isnull=True
            )
            pm = ctpm.ma_phieu_muon
            
            ngay_tra = timezone.now().date()
            ctpm.ngay_tra = ngay_tra
            ctpm.tinh_trang_khi_tra = 'Tốt' if tinh_trang == 'tot' else f'Hư hỏng - {mo_ta_hu_hong}'
            ctpm.save(update_fields=['ngay_tra', 'tinh_trang_khi_tra'])

            sach_trong_kho = ctpm.ma_sach_trong_kho
            sach_trong_kho.trang_thai_sach = 'available' if tinh_trang == 'tot' else 'damaged'
            sach_trong_kho.save(update_fields=['trang_thai_sach'])

            # Xử lý phạt trễ hạn
            so_ngay_qua_han = (ngay_tra - ctpm.han_tra).days
            if so_ngay_qua_han > 0:
                chinh_sach_tre_han = ChinhSachPhat.objects.filter(loai_phat__icontains='Trễ hạn').first()
                if chinh_sach_tre_han and chinh_sach_tre_han.muc_phat_moi_ngay:
                    so_tien_phat = so_ngay_qua_han * chinh_sach_tre_han.muc_phat_moi_ngay
                    _create_fine(pm.ma_nguoi_dung, pm, sach_trong_kho, chinh_sach_tre_han, so_tien_phat, f'Trả sách trễ {so_ngay_qua_han} ngày', nguoi_xac_nhan)

            # Xử lý phạt hư hỏng
            if tinh_trang == 'hu_hong' and damage_level_id:
                try:
                    chinh_sach_hu_hong = ChinhSachPhat.objects.get(pk=damage_level_id)
                    if chinh_sach_hu_hong.muc_phat_hu_hong:
                        _create_fine(pm.ma_nguoi_dung, pm, sach_trong_kho, chinh_sach_hu_hong, chinh_sach_hu_hong.muc_phat_hu_hong, f'Làm hỏng sách: {mo_ta_hu_hong}', nguoi_xac_nhan)
                except ChinhSachPhat.DoesNotExist:
                    pass

            pm.sync_status()
            return JsonResponse({'success': True})

    except ChiTietPhieuMuon.DoesNotExist:
        return JsonResponse({'error': 'Không tìm thấy bản ghi mượn.'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def api_get_user_fines(request):
    """
    API lấy danh sách các khoản phạt (tất cả lịch sử) của một người dùng.
    """
    ma_nguoi_dung = request.GET.get('ma_nguoi_dung')
    if not ma_nguoi_dung:
        return JsonResponse({'error': 'Thiếu mã người dùng'}, status=400)

    _sync_fine_statuses()

    payment_detail_qs = ChiTietThanhToan.objects.filter(ma_phat=OuterRef('pk'))

    khoan_phats = (
        KhoanPhat.objects.filter(ma_nguoi_dung__ma_nguoi_dung=ma_nguoi_dung)
        .select_related('ma_sach_trong_kho__ma_sach', 'ma_loai_phat', 'ma_phieu_muon')
        .annotate(has_payment=Exists(payment_detail_qs))
    )

    data = []
    for kp in khoan_phats:
        status_text = PAID_STATUS if kp.has_payment else UNPAID_STATUS

        ma_sach_trong_kho = '-'
        ten_sach = 'N/A'
        try:
            if kp.ma_sach_trong_kho:
                ma_sach_trong_kho = kp.ma_sach_trong_kho.ma_sach_trong_kho
                if kp.ma_sach_trong_kho.ma_sach:
                    ten_sach = kp.ma_sach_trong_kho.ma_sach.ten_sach
        except Exception:
            pass

        data.append({
            'ma_phat': kp.ma_phat,
            'ma_sach_trong_kho': ma_sach_trong_kho,
            'ten_sach': ten_sach,
            'loai_phat': kp.ma_loai_phat.loai_phat if kp.ma_loai_phat else 'Khác',
            'ly_do': kp.ly_do or '-',
            'so_tien': float(kp.so_tien),
            'ngay_tao': kp.ngay_tao.strftime('%d/%m/%Y'),
            'ma_phieu_muon': kp.ma_phieu_muon.ma_phieu_muon if kp.ma_phieu_muon else '-',
            'trang_thai': status_text
        })
    
    return JsonResponse({'success': True, 'fines': data})

@login_required
@require_POST
def api_thanh_toan_phi_phat(request):
    """
    API xác nhận thanh toán phí phạt cho 1 hoặc nhiều khoản phạt.
    Yêu cầu POST: ma_nguoi_dung, danh_sach_ma_phat[], phuong_thuc
    """
    try:
        ma_nguoi_dung = request.POST.get('ma_nguoi_dung')
        phuong_thuc = request.POST.get('phuong_thuc')
        danh_sach_ma_phat = request.POST.getlist('danh_sach_ma_phat[]')
        nguoi_thu = request.user
        if not (ma_nguoi_dung and phuong_thuc and danh_sach_ma_phat):
            return JsonResponse({'error': 'Thiếu thông tin bắt buộc'}, status=400)

        _sync_fine_statuses()

        with transaction.atomic():
            khoan_phat_qs = (
                KhoanPhat.objects.select_for_update()
                .filter(ma_phat__in=danh_sach_ma_phat, chi_tiet_thanh_toan__isnull=True)
                .distinct()
            )
            if khoan_phat_qs.count() != len(danh_sach_ma_phat):
                return JsonResponse({'error': 'Có khoản phạt không hợp lệ hoặc đã thanh toán.'}, status=400)

            tong_tien = sum((kp.so_tien for kp in khoan_phat_qs), Decimal('0'))
            from .models import GiaoDichThanhToan, ChiTietThanhToan
            from quan_ly_nguoi_dung.models import NguoiDung
            nguoi_dung = NguoiDung.objects.get(pk=ma_nguoi_dung)
            gd = GiaoDichThanhToan.objects.create(
                ma_giao_dich=f'PAY-{timezone.now().strftime("%Y%m%d%H%M%S%f")}',
                ma_nguoi_dung=nguoi_dung,
                tong_so_tien=tong_tien,
                phuong_thuc=phuong_thuc,
                thoi_gian_thanh_toan=timezone.now(),
                trang_thai='Đã thanh toán',
                nguoi_thu=nguoi_thu
            )
            from muon_sach.models import PhieuMuon, ChiTietPhieuMuon
            
            for kp in khoan_phat_qs:
                ChiTietThanhToan.objects.create(
                    ma_giao_dich=gd,
                    ma_phat=kp,
                    so_tien_thanh_toan=kp.so_tien
                )
                kp.trang_thai_tt = PAID_STATUS
                kp.save()

                if kp.ma_loai_phat and 'mất sách' in kp.ma_loai_phat.loai_phat.lower():
                    if kp.ma_phieu_muon and kp.ma_sach_trong_kho:
                        pm = kp.ma_phieu_muon
                        try:
                            ctpm = ChiTietPhieuMuon.objects.get(
                                ma_phieu_muon=pm,
                                ma_sach_trong_kho=kp.ma_sach_trong_kho
                            )
                            if not ctpm.ngay_tra:
                                ctpm.ngay_tra = timezone.now().date()
                                ctpm.save(update_fields=['ngay_tra'])
                            
                            # Cập nhật trạng thái sách cũ thành đã xử lý
                            old_sach = kp.ma_sach_trong_kho
                            if old_sach and old_sach.trang_thai_sach == 'lost':
                                old_sach.trang_thai_sach = 'processed'
                                old_sach.save(update_fields=['trang_thai_sach'])
                            
                            pm.sync_status()
                        except ChiTietPhieuMuon.DoesNotExist:
                            pass

            return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_POST
def api_xu_ly_mat_sach(request):
    """
    API xử lý mất sách: cập nhật trạng thái, tạo khoản phạt hoặc chuyển trạng thái chờ đền sách.
    Yêu cầu POST: ma_phieu_muon, ma_sach_trong_kho, ngay_khai_bao_mat, phuong_an ('den_bu_tien'/'den_sach_moi'), ghi_chu
    """
    try:
        ma_phieu_muon = request.POST.get('ma_phieu_muon')
        ma_sach_trong_kho = request.POST.get('ma_sach_trong_kho')
        ngay_khai_bao_mat_str = request.POST.get('ngay_khai_bao_mat')
        phuong_an = request.POST.get('phuong_an')
        ghi_chu = request.POST.get('ghi_chu', '')
        nguoi_xu_ly = request.user

        if not (ma_phieu_muon and ma_sach_trong_kho and ngay_khai_bao_mat_str and phuong_an):
            return HttpResponseBadRequest('Thiếu thông tin bắt buộc')

        ngay_khai_bao_mat = timezone.datetime.strptime(ngay_khai_bao_mat_str, '%Y-%m-%d').date()

        with transaction.atomic():
            ctpm = ChiTietPhieuMuon.objects.select_for_update().get(
                ma_phieu_muon__ma_phieu_muon=ma_phieu_muon,
                ma_sach_trong_kho__ma_sach_trong_kho=ma_sach_trong_kho,
                ngay_tra__isnull=True
            )
            pm = ctpm.ma_phieu_muon

            ctpm.ngay_khai_bao_mat = ngay_khai_bao_mat
            ctpm.phuong_an_boi_thuong = phuong_an
            ctpm.save()

            sach_trong_kho = ctpm.ma_sach_trong_kho
            sach_trong_kho.trang_thai_sach = 'awaiting_replacement' if phuong_an == 'den_sach_moi' else 'lost'
            sach_trong_kho.save()
            
            sach = sach_trong_kho.ma_sach
            if sach.so_luong > 0:
                sach.so_luong -= 1
                sach.save()

            so_ngay_qua_han = (ngay_khai_bao_mat - ctpm.han_tra).days
            if so_ngay_qua_han > 0:
                chinh_sach_tre_han = ChinhSachPhat.objects.filter(loai_phat__icontains='Trễ hạn').first()
                if chinh_sach_tre_han and chinh_sach_tre_han.muc_phat_moi_ngay:
                    so_tien_phat_tre_han = so_ngay_qua_han * chinh_sach_tre_han.muc_phat_moi_ngay
                    _create_fine(pm.ma_nguoi_dung, pm, sach_trong_kho, chinh_sach_tre_han, so_tien_phat_tre_han, f'Trễ hạn {so_ngay_qua_han} ngày trước khi báo mất', nguoi_xu_ly)

            if phuong_an == 'den_bu_tien':
                chinh_sach_mat = ChinhSachPhat.objects.filter(loai_phat__icontains='Mất sách').first()
                if not chinh_sach_mat:
                    return JsonResponse({'error': 'Chưa cấu hình chính sách phạt mất sách.'}, status=400)
                
                so_tien_mat = Decimal(chinh_sach_mat.muc_den_bu_mat_sach or 0)
                _create_fine(pm.ma_nguoi_dung, pm, sach_trong_kho, chinh_sach_mat, so_tien_mat, f'Báo mất sách: {ghi_chu}', nguoi_xu_ly)
            
            pm.sync_status()
            return JsonResponse({'success': True})

    except ChiTietPhieuMuon.DoesNotExist:
        return JsonResponse({'error': 'Không tìm thấy bản ghi mượn.'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_POST
def api_xac_nhan_den_sach(request):
    """
    API xác nhận đền sách: cập nhật trạng thái phiếu mượn, nhập sách mới vào kho.
    Yêu cầu POST: ma_phieu_muon, ma_sach_trong_kho_moi, thong_tin_sach_moi
    """
    try:
        ma_phieu_muon = request.POST.get('ma_phieu_muon')
        ghi_chu = request.POST.get('ghi_chu', '')
        if not ma_phieu_muon:
            return JsonResponse({'error': 'Thiếu mã phiếu mượn.'}, status=400)
        
        with transaction.atomic():
            pm = PhieuMuon.objects.select_for_update().get(ma_phieu_muon=ma_phieu_muon)
            ctpm = (
                ChiTietPhieuMuon.objects.select_for_update()
                .filter(
                    ma_phieu_muon=pm,
                    phuong_an_boi_thuong='den_sach_moi',
                    ngay_tra__isnull=True,
                )
                .order_by('-ngay_khai_bao_mat')
                .first()
            )
            if not ctpm:
                return JsonResponse({'error': 'Không tìm thấy hồ sơ đền sách đang chờ xác nhận cho phiếu này.'}, status=400)
            
            from quan_ly_sach.models import SachTrongKho, Sach
            
            sach_goc = ctpm.ma_sach_trong_kho.ma_sach
            
            # Tự động sinh mã sách kho mới: mã gốc + (tổng số bản sao + 1)
            prefix = sach_goc.ma_sach
            total_count = sach_goc.sach_trong_kho.count()
            
            ma_sach_trong_kho_moi = None
            for i in range(total_count + 1, total_count + 100):
                candidate_code = f"{prefix}-{str(i).zfill(3)}"
                if not SachTrongKho.objects.filter(pk=candidate_code).exists():
                    ma_sach_trong_kho_moi = candidate_code
                    break
                    
            if not ma_sach_trong_kho_moi:
                return JsonResponse({'error': 'Không thể tạo mã sách mới.'}, status=500)

            SachTrongKho.objects.create(
                ma_sach_trong_kho=ma_sach_trong_kho_moi,
                ma_sach=sach_goc,
                ma_vach=f"BC-{ma_sach_trong_kho_moi}",
                trang_thai_sach='available'
            )
            
            sach_goc.so_luong += 1
            sach_goc.save(update_fields=['so_luong'])
            
            ctpm.ngay_tra = timezone.now().date()
            ghi_chu_suffix = f" - {ghi_chu}" if ghi_chu else ""
            ctpm.tinh_trang_khi_tra = f'Đền sách mới (mã: {ma_sach_trong_kho_moi}){ghi_chu_suffix}'
            ctpm.save(update_fields=['ngay_tra', 'tinh_trang_khi_tra'])
            
            # Cập nhật trạng thái sách cũ thành đã xử lý
            old_sach_trong_kho = ctpm.ma_sach_trong_kho
            old_sach_trong_kho.trang_thai_sach = 'processed'
            old_sach_trong_kho.save(update_fields=['trang_thai_sach'])
            
            pm.sync_status()
                
            return JsonResponse({'success': True})
    except PhieuMuon.DoesNotExist:
        return JsonResponse({'error': 'Không tìm thấy phiếu mượn.'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

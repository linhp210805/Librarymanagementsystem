from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.db.models import Q, Sum, Max, F
from muon_sach.models import ChiTietPhieuMuon
from tra_sach.models import KhoanPhat
from django.utils import timezone
import json


@login_required
def report_statistics(request):
    today = timezone.now().date()

    # ── Thống kê sách đã trả (dùng cho tab 1 & summary top) ──────────────
    returned_qs = ChiTietPhieuMuon.objects.filter(ngay_tra__isnull=False).select_related(
        'ma_phieu_muon__ma_nguoi_dung',
        'ma_sach_trong_kho__ma_sach',
    )
    total_returned = returned_qs.count()
    on_time        = returned_qs.filter(ngay_tra__lte=F('han_tra')).count()
    late           = returned_qs.filter(ngay_tra__gt=F('han_tra')).count()

    returned_rows = []
    for ct in returned_qs:
        pm = ct.ma_phieu_muon
        sach_trong_kho = ct.ma_sach_trong_kho
        sach = sach_trong_kho.ma_sach
        status = 'Trả quá hạn' if ct.ngay_tra and ct.ngay_tra > ct.han_tra else 'Trả đúng hạn'
        returned_rows.append([
            pm.ma_phieu_muon,
            sach.ten_sach,
            sach_trong_kho.ma_sach_trong_kho,
            pm.ma_nguoi_dung.ho_ten,
            pm.ngay_muon.strftime('%d/%m/%Y'),
            ct.ngay_tra.strftime('%d/%m/%Y') if ct.ngay_tra else '',
            status,
        ])

    # ── Thống kê phí phạt ─────────────────────────────────────────────────
    fines_qs = KhoanPhat.objects.select_related(
        'ma_nguoi_dung',
        'ma_sach_trong_kho__ma_sach',
        'ma_phieu_muon',
    )

    total_paid   = fines_qs.filter(
                       trang_thai_tt__iexact='Đã thanh toán'
                   ).aggregate(s=Sum('so_tien'))['s'] or 0

    total_unpaid = fines_qs.filter(
                       ~Q(trang_thai_tt__iexact='Đã thanh toán')
                   ).aggregate(s=Sum('so_tien'))['s'] or 0

    max_fine     = fines_qs.aggregate(m=Max('so_tien'))['m'] or 0

    top_user = (
        fines_qs.values('ma_nguoi_dung__ho_ten')
        .annotate(t=Sum('so_tien'))
        .order_by('-t')
        .first()
    )
    top_user_name = top_user['ma_nguoi_dung__ho_ten'] if top_user else '—'

    # ── Danh sách chi tiết khoản phạt ────────────────────────────────────
    fines_list = []
    for f in fines_qs.order_by('-ngay_tao'):
        fines_list.append({
            'nguoi':     f.ma_nguoi_dung.ho_ten,
            'ma_sach':   f.ma_sach_trong_kho.ma_sach.ma_sach,
            'ten_sach':  f.ma_sach_trong_kho.ma_sach.ten_sach,
            'ly_do':     f.ly_do or '',
            'so_tien':   f.so_tien,
            'ngay_tao':  f.ngay_tao,
            'ma_phieu':  f.ma_phieu_muon.ma_phieu_muon,
            'trang_thai': f.trang_thai_tt,
        })

    # ── Thống kê sách đang cho mượn (tab 2) ───────────────────────────────
    lending_qs = ChiTietPhieuMuon.objects.filter(ngay_tra__isnull=True).select_related(
        'ma_phieu_muon', 'ma_sach_trong_kho', 'ma_phieu_muon__ma_nguoi_dung', 'ma_sach_trong_kho__ma_sach'
    )
    lending_rows = []
    lending_on_time = 0
    lending_late = 0
    for ct in lending_qs:
        pm = ct.ma_phieu_muon
        sach_trong_kho = ct.ma_sach_trong_kho
        sach = sach_trong_kho.ma_sach
        is_late = ct.han_tra < today
        if is_late:
            lending_late += 1
        else:
            lending_on_time += 1
        lending_rows.append([
            pm.ma_phieu_muon,
            sach.ten_sach,
            sach_trong_kho.ma_sach_trong_kho,
            pm.ma_nguoi_dung.ho_ten,
            pm.ngay_muon.strftime('%d/%m/%Y'),
            ct.han_tra.strftime('%d/%m/%Y'),
            'Quá hạn' if is_late else 'Đang mượn',
        ])
    total_lending = len(lending_rows)

    # ── Thống kê sách còn trong kho (tab 3) ───────────────────────────────
    from quan_ly_sach.models import Sach
    stock_rows = []
    total_titles = Sach.objects.count()
    total_stock = 0
    low_stock = 0
    for sach in Sach.objects.all():
        kho_objs = sach.sach_trong_kho.all()

        # Còn lại trong kho = các bản không còn ở trạng thái đang lưu thông/đã mất.
        available_count = kho_objs.exclude(
            trang_thai_sach__in=['borrowed', 'overdue', 'awaiting_replacement', 'lost', 'processed']
        ).count()

        total_count = kho_objs.count()
        total_stock += total_count
        if available_count <= 3:
            low_stock += 1
        stock_rows.append([
            sach.ma_sach,
            sach.ten_sach,
            ', '.join([k.ma_sach_trong_kho for k in kho_objs]),
            total_count,
            available_count,
            'Còn sách' if available_count > 0 else 'Hết sách',
        ])

    context = {
        # Tab thống kê chung
        'total_returned': total_returned,
        'on_time':        on_time,
        'late':           late,
        # Thẻ tổng kê phí phạt
        'total_paid':     total_paid,
        'total_unpaid':   total_unpaid,
        'max_fine':       max_fine,
        'top_user_name':  top_user_name,
        'total_fines':    len(fines_list),
        # Bảng chi tiết phí phạt
        'fines': fines_list,

        'returned_rows': returned_rows,
        'lending_rows': lending_rows,
        'total_lending': total_lending,
        'lending_on_time': lending_on_time,
        'lending_late': lending_late,
        'stock_rows': stock_rows,
        'total_titles': total_titles,
        'total_stock': total_stock,
        'low_stock': low_stock,
    }

    # Truyền dữ liệu bảng ra template cho JS
    context['report_data'] = json.dumps({
        'returned': context['returned_rows'],
        'lending': context['lending_rows'],
        'stock': context['stock_rows'],
    }, ensure_ascii=False)

    return render(request, 'bao_cao/statistics.html', context)

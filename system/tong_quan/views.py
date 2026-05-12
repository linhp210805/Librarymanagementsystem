from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.shortcuts import render
from django.utils import timezone

from muon_sach.models import ChiTietPhieuMuon
from quan_ly_nguoi_dung.models import NguoiDung
from quan_ly_sach.models import SachTrongKho
from tra_sach.models import KhoanPhat


def _format_vnd(value):
    amount = int(value or 0)
    return f"{amount:,}".replace(",", ".") + "đ"

@login_required
def dashboard_view(request):
    today = timezone.localdate()

    active_borrow_qs = ChiTietPhieuMuon.objects.filter(ngay_tra__isnull=True)
    overdue_qs = active_borrow_qs.filter(han_tra__lt=today)

    total_books = SachTrongKho.objects.count()
    borrowed_from_status = SachTrongKho.objects.filter(
        trang_thai_sach__in=[
            SachTrongKho.TrangThai.BORROWED,
            SachTrongKho.TrangThai.OVERDUE,
            SachTrongKho.TrangThai.AWAITING_REPLACEMENT,
        ]
    ).count()
    borrowed_from_active_loans = active_borrow_qs.values('ma_sach_trong_kho_id').distinct().count()

    # Ưu tiên số đang mượn thực tế theo phiếu mượn đang mở, đồng thời chịu được dữ liệu cũ chưa đồng bộ trạng thái.
    borrowed_books = max(borrowed_from_status, borrowed_from_active_loans)
    available_books = max(total_books - borrowed_books, 0)

    total_readers = NguoiDung.objects.filter(loai_nguoi_dung='doc_gia').count()
    active_readers = NguoiDung.objects.filter(
        loai_nguoi_dung='doc_gia',
        trang_thai_tot_nghiep=False,
    ).count()
    inactive_readers = max(total_readers - active_readers, 0)

    overdue_slips = overdue_qs.values('ma_phieu_muon_id').distinct().count()

    unpaid_fines = (
        KhoanPhat.objects.filter(trang_thai_tt__iexact='Chưa thanh toán')
        .aggregate(total=Sum('so_tien'))['total']
        or 0
    )
    paid_fines = (
        KhoanPhat.objects.filter(trang_thai_tt__iexact='Đã thanh toán')
        .aggregate(total=Sum('so_tien'))['total']
        or 0
    )
    total_fines = unpaid_fines + paid_fines

    if total_fines > 0:
        unpaid_percent = int(round((float(unpaid_fines) / float(total_fines)) * 100))
        paid_percent = 100 - unpaid_percent
    else:
        unpaid_percent = 0
        paid_percent = 0

    # Fix: Change overdue trend to show new overdue slips per day
    weekday_labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    overdue_labels = []
    overdue_data = []
    for days_ago in range(6, -1, -1):
        day = today - timedelta(days=days_ago)
        overdue_labels.append(weekday_labels[day.weekday()])

        # Đếm tổng số phủ chi tiết phiếu mượn đang quá hạn tại ngày 'day':
        # han_tra < day (tức là đã quá hạn) và (chưa trả hoặc trả sau ngày 'day')
        count = ChiTietPhieuMuon.objects.filter(
            han_tra__lt=day
        ).filter(
            Q(ngay_tra__isnull=True) | Q(ngay_tra__gt=day)
        ).values('ma_phieu_muon_id').distinct().count()
        overdue_data.append(count)

    chart_data = {
        'books_status': {
            'labels': ['Trong kho', 'Đang mượn'],
            'data': [available_books, borrowed_books],
        },
        'readers': {
            'labels': ['Đang hoạt động', 'Ngừng hoạt động'],
            'data': [active_readers, inactive_readers],
        },
        'overdue': {
            'labels': overdue_labels,
            'data': overdue_data,
        },
    }

    context = {
        'total_books': total_books,
        'available_books': available_books,
        'borrowed_books': borrowed_books,
        'total_readers': total_readers,
        'active_readers': active_readers,
        'overdue_slips': overdue_slips,
        'unpaid_fines': unpaid_fines,
        'unpaid_fines_display': _format_vnd(unpaid_fines),
        'paid_fines_display': _format_vnd(paid_fines),
        'unpaid_percent': unpaid_percent,
        'paid_percent': paid_percent,
        'dashboard_chart_data': chart_data,
    }
    return render(request, 'tong_quan/index.html', context)

@login_required
def index(request):
    return dashboard_view(request)

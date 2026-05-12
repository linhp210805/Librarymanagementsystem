from django.contrib.auth.decorators import login_required
from django.db.models import Case, Count, DecimalField, IntegerField, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import render
from .models import NguoiDung


def _user_queryset(search_query='', filter_status='all', filter_class='all'):
    borrowed_books_sq = (
        NguoiDung.objects.filter(pk=OuterRef('pk'))
        .annotate(
            cnt=Count(
                'phieu_muon__chi_tiet_phieu_muon',
                filter=Q(phieu_muon__chi_tiet_phieu_muon__ngay_tra__isnull=True),
                distinct=True,
            )
        )
        .values('cnt')[:1]
    )

    unpaid_fines_sq = (
        NguoiDung.objects.filter(pk=OuterRef('pk'))
        .annotate(
            total=Sum(
                'khoan_phat__so_tien',
                filter=Q(khoan_phat__chi_tiet_thanh_toan__isnull=True),
            )
        )
        .values('total')[:1]
    )

    users = NguoiDung.objects.all().annotate(
        role_priority=Case(
            When(loai_nguoi_dung='thu_thu', then=Value(0)),
            When(loai_nguoi_dung='quan_tri', then=Value(1)),
            When(loai_nguoi_dung='doc_gia', then=Value(2)),
            default=Value(99),
            output_field=IntegerField(),
        ),
        borrowed_books=Coalesce(Subquery(borrowed_books_sq, output_field=IntegerField()), 0),
        unpaid_fines=Coalesce(
            Subquery(unpaid_fines_sq, output_field=DecimalField(max_digits=19, decimal_places=2)),
            Value(0, output_field=DecimalField(max_digits=19, decimal_places=2)),
        ),
    )

    if search_query:
        users = users.filter(
            Q(ma_nguoi_dung__icontains=search_query)
            | Q(ho_ten__icontains=search_query)
            | Q(email__icontains=search_query)
            | Q(so_dien_thoai__icontains=search_query)
            | Q(lop__icontains=search_query)
        )

    if filter_status == 'graduated':
        users = users.filter(trang_thai_tot_nghiep=True)
    elif filter_status == 'not_graduated':
        users = users.filter(trang_thai_tot_nghiep=False)

    if filter_class != 'all':
        users = users.filter(lop=filter_class)

    return users.order_by('role_priority', 'ma_nguoi_dung')


@login_required
def reader_list_view(request):
    class_options = (
        NguoiDung.objects.exclude(lop__isnull=True)
        .exclude(lop='')
        .values_list('lop', flat=True)
        .distinct()
        .order_by('lop')
    )

    context = {
        'users': _user_queryset(),
        'search_query': '',
        'filter_status': 'all',
        'filter_class': 'all',
        'class_options': class_options,
    }
    return render(request, 'quan_ly_nguoi_dung/user_list.html', context)


@login_required
def reader_list_data(request):
    search_query = request.GET.get('q', '').strip()
    filter_status = request.GET.get('status', 'all')
    filter_class = request.GET.get('class', 'all')

    users = _user_queryset(
        search_query=search_query,
        filter_status=filter_status,
        filter_class=filter_class,
    )

    data = []
    for user in users:
        data.append(
            {
                'id': user.ma_nguoi_dung,
                'name': user.ho_ten,
                'role': user.get_loai_nguoi_dung_display(),
                'class_name': user.lop or '',
                'graduation_status': 'Đã tốt nghiệp' if user.trang_thai_tot_nghiep else 'Chưa tốt nghiệp',
                'email': user.email or '',
                'phone': user.so_dien_thoai or '',
                'borrowed_books': user.borrowed_books or 0,
                'unpaid_fines': str(user.unpaid_fines or 0),
            }
        )

    return JsonResponse({'users': data})

@login_required
def reader_list(request):
    return reader_list_view(request)

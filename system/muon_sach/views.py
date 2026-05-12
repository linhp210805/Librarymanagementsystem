from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import permission_required
from django.http import JsonResponse
from django.contrib import messages
from django.views.decorators.http import require_POST, require_GET
from django.db import transaction
from django.utils import timezone
import json
from datetime import datetime
from .models import PhieuMuon, ChiTietPhieuMuon
from quan_ly_nguoi_dung.models import NguoiDung
from quan_ly_sach.models import SachTrongKho


def _is_doc_gia_user(user):
    return hasattr(user, 'nguoi_dung') and user.nguoi_dung.loai_nguoi_dung == 'doc_gia'


def _can_view_borrow_area(user):
    return user.is_superuser or user.has_perm('muon_sach.view_phieumuon') or _is_doc_gia_user(user)


@login_required
def borrow_list_view(request):
    if not _can_view_borrow_area(request.user):
        return JsonResponse({'success': False, 'message': 'Bạn không có quyền truy cập chức năng này.'}, status=403)
    return render(request, 'muon_sach/borrow_list.html')


@login_required
def borrow_list(request):
    return borrow_list_view(request)


@login_required
@require_GET
def api_get_borrow_list(request):
    if not _can_view_borrow_area(request.user):
        return JsonResponse({'success': False, 'message': 'Bạn không có quyền truy cập chức năng này.'}, status=403)

    slips = PhieuMuon.objects.all().select_related('ma_nguoi_dung').order_by('ma_phieu_muon')

    if _is_doc_gia_user(request.user):
        slips = slips.filter(ma_nguoi_dung=request.user.nguoi_dung)

    data = []
    today = timezone.now().date()

    for s in slips:
        status = s.sync_status()
        status_display = s.get_trang_thai_display()
        status_class = {
            'dang_muon': 'badge badge-blue-solid',
            'qua_han': 'badge badge-orange-solid',
            'da_tra': 'badge badge-green-solid',
            'dang_xu_ly': 'badge badge-red-solid',
            'cho_den_sach': 'badge badge-red-solid',
        }.get(status, 'badge badge-blue-solid')

        data.append({
            'id': s.pk,
            'slipCode': s.ma_phieu_muon,
            'userId': s.ma_nguoi_dung.ma_nguoi_dung,
            'userName': s.ma_nguoi_dung.ho_ten,
            'borrowDate': s.ngay_muon.strftime('%d/%m/%Y'),
            'dueDate': s.chi_tiet_phieu_muon.first().han_tra.strftime(
                '%d/%m/%Y') if s.chi_tiet_phieu_muon.exists() else '',
            'status': status_display,
            'statusClass': status_class,
            'books': [
                {'code': ct.ma_sach_trong_kho.ma_sach_trong_kho, 'title': ct.ma_sach_trong_kho.ma_sach.ten_sach,
                 'qty': 1}
                for ct in s.chi_tiet_phieu_muon.all()
            ]
        })
    return JsonResponse(data, safe=False)


@login_required
@require_GET
@permission_required('muon_sach.add_phieumuon', raise_exception=True)
def api_get_user_info(request):
    ma_nguoi_dung = request.GET.get('ma_nguoi_dung')
    try:
        user = NguoiDung.objects.get(ma_nguoi_dung=ma_nguoi_dung)
        if user.loai_nguoi_dung != 'doc_gia' or user.trang_thai_tot_nghiep:
            return JsonResponse({'success': False, 'message': 'Người dùng này không thể mượn sách'}, status=200)
        return JsonResponse({
            'success': True,
            'ho_ten': user.ho_ten
        })
    except NguoiDung.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy người dùng'}, status=200)


@login_required
@require_GET
@permission_required('muon_sach.add_phieumuon', raise_exception=True)
def api_get_book_info(request):
    ma_sach_trong_kho = request.GET.get('ma_sach_trong_kho')
    try:
        book = SachTrongKho.objects.get(ma_sach_trong_kho=ma_sach_trong_kho)
        # Kiểm tra trạng thái sách - chỉ cho mượn nếu 'available'
        if book.trang_thai_sach != 'available':
            return JsonResponse({
                'success': False,
                'message': 'Mã sách đã được mượn'
            }, status=200)

        return JsonResponse({
            'success': True,
            'ten_sach': book.ma_sach.ten_sach
        })
    except SachTrongKho.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy sách'}, status=200)


@login_required
@require_GET
@permission_required('muon_sach.add_phieumuon', raise_exception=True)
def api_search_books(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse([], safe=False)

    # Tìm sách trong kho có trạng thái 'available' và mã chứa query
    books = SachTrongKho.objects.filter(
        ma_sach_trong_kho__icontains=query,
        trang_thai_sach='available'
    ).select_related('ma_sach')[:10]  # Giới hạn 10 kết quả

    results = [
        {
            'code': b.ma_sach_trong_kho,
            'title': b.ma_sach.ten_sach
        }
        for b in books
    ]
    return JsonResponse(results, safe=False)


@login_required
@require_POST
@permission_required('muon_sach.add_phieumuon', raise_exception=True)
def api_create_borrow_slip(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('userId')
        borrow_date_str = data.get('borrowDate')
        due_date_str = data.get('dueDate')
        books = data.get('books', [])

        if not user_id or not borrow_date_str or not due_date_str or not books:
            return JsonResponse({'success': False, 'message': 'Thiếu thông tin bắt buộc'}, status=400)

        with transaction.atomic():
            nguoi_dung = NguoiDung.objects.get(ma_nguoi_dung=user_id)
            try:
                nguoi_tao = request.user.nguoi_dung
            except:
                nguoi_tao = NguoiDung.objects.filter(loai_nguoi_dung='thu_thu').first()

            pm = PhieuMuon.objects.create(
                ma_nguoi_dung=nguoi_dung,
                ngay_muon=borrow_date_str,
                nguoi_tao=nguoi_tao,
                trang_thai='dang_muon'
            )

            for b in books:
                try:
                    sach_kho = SachTrongKho.objects.get(ma_sach_trong_kho=b['code'])
                except SachTrongKho.DoesNotExist:
                    raise Exception("Không tìm thấy sách")

                # Backend validation: check status again in case of concurrent requests
                if sach_kho.trang_thai_sach == 'borrowed':
                    raise Exception("Mã sách đã được mượn")
                elif sach_kho.trang_thai_sach != 'available':
                    raise Exception(
                        f"Sách đang ở trạng thái '{sach_kho.get_trang_thai_sach_display()}', không thể mượn.")

                ChiTietPhieuMuon.objects.create(
                    ma_phieu_muon=pm,
                    ma_sach_trong_kho=sach_kho,
                    han_tra=due_date_str
                )
                sach_kho.trang_thai_sach = 'borrowed'
                sach_kho.save()

            pm.sync_status()

        return JsonResponse({'success': True, 'message': 'Thêm thông tin mượn sách thành công'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@require_POST
@permission_required('muon_sach.delete_phieumuon', raise_exception=True)
def api_delete_borrow_slip(request, pk):
    try:
        with transaction.atomic():
            pm = PhieuMuon.objects.get(pk=pk)

            if pm.trang_thai == 'dang_muon':
                messages.error(request, 'Không thể xóa phiếu mượn đang mượn')
                return JsonResponse({'success': False, 'action': 'reload'})

            if pm.trang_thai == 'qua_han':
                messages.error(request, 'Không thể xóa phiếu mượn quá hạn')
                return JsonResponse({'success': False, 'action': 'reload'})

            if pm.trang_thai != 'da_tra':
                messages.error(request, 'Chỉ có thể xóa phiếu mượn đã trả')
                return JsonResponse({'success': False, 'action': 'reload'})

            # Xóa các khoản phạt liên quan (nếu có) để tránh lỗi ProtectedError do khóa ngoại PROTECT
            pm.khoan_phat.all().delete()

            chi_tiet = pm.chi_tiet_phieu_muon.all()
            for ct in chi_tiet:
                sach_kho = ct.ma_sach_trong_kho
                sach_kho.trang_thai_sach = 'available'
                sach_kho.save()

            pm.delete()
        return JsonResponse({'success': True, 'message': 'Xóa phiếu mượn thành công'})
    except PhieuMuon.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy phiếu mượn'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@require_POST
@permission_required('muon_sach.extend_phieumuon', raise_exception=True)
def api_extend_borrow_slip(request, pk):
    try:
        data = json.loads(request.body)
        new_due_date = data.get('newDueDate')

        if not new_due_date:
            return JsonResponse({'success': False, 'message': 'Thiếu ngày gia hạn mới'}, status=400)

        with transaction.atomic():
            pm = PhieuMuon.objects.get(pk=pk)

            # Lấy hạn trả hiện tại (lấy từ chi tiết phiếu chưa trả)
            chi_tiet = pm.chi_tiet_phieu_muon.filter(ngay_tra__isnull=True).first()
            if not chi_tiet:
                return JsonResponse({'success': False, 'message': 'Không tìm thấy sách chưa trả trong phiếu mượn này.'}, status=400)

            current_due_date = chi_tiet.ngay_gia_han if chi_tiet.ngay_gia_han else chi_tiet.han_tra
            today = timezone.now().date()

            # Kiểm tra quá hạn: nếu hôm nay > hạn trả hiện tại thì không cho gia hạn
            if today > current_due_date:
                return JsonResponse({
                    'success': False,
                    'message': 'Sách đã quá hạn trả, không thể gia hạn. Vui lòng thực hiện trả sách và thanh toán phí phạt nếu có.'
                }, status=200)

            # Parse và validate ngày gia hạn mới
            try:
                new_date_obj = datetime.strptime(new_due_date, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'success': False, 'message': 'Định dạng ngày không hợp lệ'}, status=200)

            # Ngày gia hạn mới phải lớn hơn hạn trả hiện tại
            if new_date_obj <= current_due_date:
                return JsonResponse({
                    'success': False,
                    'message': 'Ngày gia hạn mới phải lớn hơn hạn trả hiện tại.'
                }, status=200)

            # Cập nhật ngày gia hạn cho toàn bộ sách chưa trả trong phiếu
            pm.chi_tiet_phieu_muon.filter(ngay_tra__isnull=True).update(ngay_gia_han=new_due_date)

            # Cập nhật lại trạng thái phiếu mượn
            pm.sync_status()

        return JsonResponse({'success': True, 'message': 'Gia hạn thành công'})
    except PhieuMuon.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy phiếu mượn'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=400)

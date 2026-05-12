from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
import django.shortcuts as shortcuts
from .models import Sach, SachTrongKho


def _book_queryset(keyword):
    books = Sach.objects.all()

    if keyword:
        books = books.filter(
            Q(ma_sach__icontains=keyword) |
            Q(ten_sach__icontains=keyword) |
            Q(ten_tac_gia__icontains=keyword) |
            Q(the_loai__icontains=keyword) |
            Q(ten_nha_xuat_ban__icontains=keyword)
        )

    # Các trạng thái sách được coi là vẫn còn trong bộ sưu tập của thư viện
    # (không tính sách đã mất, đã xử lý xong, hoặc ngừng sử dụng)
    collection_statuses = [
        SachTrongKho.TrangThai.AVAILABLE,
        SachTrongKho.TrangThai.BORROWED,
        SachTrongKho.TrangThai.OVERDUE,
        SachTrongKho.TrangThai.DAMAGED,  # Hư hỏng nhẹ vẫn được tính vào tổng số
    ]

    return books.annotate(
        # Fix: Tổng số lượng chỉ tính các sách còn trong bộ sưu tập
        total_quantity=Count(
            'sach_trong_kho',
            filter=Q(sach_trong_kho__trang_thai_sach__in=collection_statuses),
            distinct=True
        ),

        # Số lượng có sẵn chỉ tính những cuốn có trạng thái 'available'
        available_quantity=Count(
            'sach_trong_kho',
            filter=Q(sach_trong_kho__trang_thai_sach=SachTrongKho.TrangThai.AVAILABLE),
            distinct=True
        ),

        # Số lượng không có sẵn là các trạng thái còn lại trong bộ sưu tập
        not_available_quantity=Count(
            'sach_trong_kho',
            filter=Q(sach_trong_kho__trang_thai_sach__in=[
                SachTrongKho.TrangThai.BORROWED,
                SachTrongKho.TrangThai.OVERDUE,
                SachTrongKho.TrangThai.DAMAGED,
            ]),
            distinct=True
        ),

        overdue_quantity=Count(
            'sach_trong_kho',
            filter=Q(sach_trong_kho__trang_thai_sach=SachTrongKho.TrangThai.OVERDUE),
            distinct=True
        ),
    ).order_by('ma_sach')

def _build_book_context(request):
    """Xây dựng context cho trang danh sách sách"""
    keyword = request.GET.get('q', '').strip()
    detail_id = request.GET.get('detail', '').strip()
    edit_id = request.GET.get('edit', '').strip()

    books = _book_queryset(keyword)

    detail_book = None
    if detail_id:
        detail_book = Sach.objects.filter(ma_sach=detail_id).first()

    selected_book = None
    if edit_id:
        selected_book = Sach.objects.filter(ma_sach=edit_id).first()

    return {
        "books": books,
        "keyword": keyword,
        "detail_book": detail_book,
        "selected_book": selected_book,
    }


@login_required
def book_list_view(request):
    if request.method == "POST":
        action = request.POST.get("action", "").strip()
        book_id = request.POST.get("book_id", "").strip()

        if action == "delete":
            book = get_object_or_404(Sach, ma_sach=book_id)

            # Kiểm tra lịch sử mượn — bao gồm cả sách đang mượn lẫn đã trả
            # (vì sách đang mượn cũng có ChiTietPhieuMuon tương ứng)
            has_borrow_history = book.sach_trong_kho.filter(
                chi_tiet_phieu_muon__isnull=False
            ).exists()

            if has_borrow_history:
                # Có lịch sử (đang mượn hoặc đã từng mượn)
                # → Chuyển toàn bộ bản sao sang 'Ngừng sử dụng' để giữ lịch sử nguyên vẹn
                book.sach_trong_kho.all().update(
                    trang_thai_sach=SachTrongKho.TrangThai.DISCONTINUED
                )
                book.so_luong = 0
                book.save()
                messages.success(
                    request,
                    'Sách đã có lịch sử mượn, sách được chuyển sang trạng thái ngừng sử dụng.'
                )
            else:
                # Không có lịch sử mượn → xóa hoàn toàn
                book.delete()
                messages.success(request, 'Xóa thông tin sách thành công.')

            return redirect('book_list')

        elif action == "add_copies":
            num_to_add_raw = request.POST.get("num_to_add", "0")
            try:
                num_to_add = int(num_to_add_raw)
                if num_to_add <= 0:
                    raise ValueError("Số lượng thêm vào phải là số dương.")
                book = get_object_or_404(Sach, ma_sach=book_id)
                book.so_luong += num_to_add
                book.save()
                messages.success(request, f"Đã thêm {num_to_add} bản sao cho sách {book.ten_sach}.")
            except (ValueError, TypeError) as e:
                messages.error(request, f"Lỗi khi thêm bản sao: {e}")
            except Exception as e:
                messages.error(request, f"Đã xảy ra lỗi không xác định: {e}")
            return redirect("book_list")

        title = request.POST.get("title", "").strip()
        author = request.POST.get("author", "").strip()
        category = request.POST.get("category", "").strip()
        publisher = request.POST.get("publisher", "").strip()
        year_raw = request.POST.get("year", "").strip()
        quantity_raw = request.POST.get("quantity", "0").strip()
        original_id = request.POST.get("original_id", "").strip()

        if not (book_id and title and year_raw):
            messages.error(request, "Vui lòng điền đầy đủ các thông tin bắt buộc (Mã sách, Tên sách, Năm XB).")
            return redirect("book_list")

        try:
            year = int(year_raw)
            quantity = int(quantity_raw)
            if quantity < 0:
                 raise ValueError("Số lượng không thể là số âm.")
        except (ValueError, TypeError):
            messages.error(request, "Năm xuất bản hoặc số lượng không hợp lệ.")
            return redirect("book_list")

        if action == "create":
            if Sach.objects.filter(ma_sach=book_id).exists():
                messages.error(request, "Mã sách này đã tồn tại.")
            else:
                Sach.objects.create(
                    ma_sach=book_id, ten_sach=title, ten_tac_gia=author or None,
                    the_loai=category or None, ten_nha_xuat_ban=publisher or None,
                    nam_xuat_ban=year, so_luong=quantity
                )
                messages.success(request, f"Đã thêm mới sách '{title}'.")

        elif action == "update":
            book = get_object_or_404(Sach, ma_sach=original_id if original_id else book_id)
            if book_id != original_id and Sach.objects.filter(ma_sach=book_id).exists():
                messages.error(request, "Mã sách mới bị trùng với một sách khác.")
            else:
                book.ma_sach = book_id
                book.ten_sach = title
                book.ten_tac_gia = author or None
                book.the_loai = category or None
                book.ten_nha_xuat_ban = publisher or None
                book.nam_xuat_ban = year
                book.so_luong = quantity
                book.save()
                messages.success(request, 'Cập nhật thông tin sách thành công.')


        return redirect("book_list")

    context = _build_book_context(request)
    return shortcuts.render(request, "book_list.html", context)

@login_required
def book_list(request):
    return book_list_view(request)

@login_required
def quan_ly_kho_view(request):
    ma_sach_tu_url = request.GET.get('ma_sach')
    sach_chinh = get_object_or_404(Sach, ma_sach=ma_sach_tu_url)
    danh_sach_kho = SachTrongKho.objects.filter(ma_sach=sach_chinh)
    
    # Tính số lượng có sẵn
    so_luong_co_san = danh_sach_kho.filter(trang_thai_sach='available').count()
    
    # Tính tổng số lượng (active) y hệt như _book_queryset
    collection_statuses = [
        SachTrongKho.TrangThai.AVAILABLE,
        SachTrongKho.TrangThai.BORROWED,
        SachTrongKho.TrangThai.OVERDUE,
        SachTrongKho.TrangThai.DAMAGED,
    ]
    tong_so_luong_active = danh_sach_kho.filter(trang_thai_sach__in=collection_statuses).count()

    return shortcuts.render(request, 'sachtrongkho.html', {
        'sach': sach_chinh,
        'danh_sach_kho': danh_sach_kho,
        'so_luong_co_san': so_luong_co_san,
        'tong_so_luong_active': tong_so_luong_active
    })

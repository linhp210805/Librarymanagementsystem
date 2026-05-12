from django.http import JsonResponse
from django.shortcuts import redirect


class DocGiaAccessMiddleware:
    """Han che doc gia chi truy cap khu vuc muon sach va gia han."""

    ALLOWED_PATH_PREFIXES = (
        '/borrow-books/',
        '/api/danh_sach_phieu_muon/',
        '/logout/',
        '/forgot-password/',
        '/reset-password/',
        '/static/',
        '/admin/logout/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_restricted_doc_gia(request) and not self._is_allowed_path(request.path):
            if request.path.startswith('/api/'):
                return JsonResponse({'success': False, 'message': 'Bạn không có quyền truy cập chức năng này.'}, status=403)
            return redirect('borrow_list')

        return self.get_response(request)

    def _is_restricted_doc_gia(self, request):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_superuser:
            return False
        return hasattr(user, 'nguoi_dung') and user.nguoi_dung.loai_nguoi_dung == 'doc_gia'

    def _is_allowed_path(self, path):
        if path == '/':
            return True
        return any(path.startswith(prefix) for prefix in self.ALLOWED_PATH_PREFIXES)


from django import template


register = template.Library()


@register.filter
def role_label(user):
    """Tra ve dung 1 trong 3 vai tro he thong."""
    if not getattr(user, 'is_authenticated', False):
        return ''

    if user.is_superuser or user.groups.filter(name='QUAN_TRI').exists():
        return 'Quản trị viên'

    if user.groups.filter(name='THU_THU').exists() or user.is_staff:
        return 'Thủ thư'

    if user.groups.filter(name='DOC_GIA').exists():
        return 'Độc giả'

    try:
        nguoi_dung = user.nguoi_dung
    except Exception:
        nguoi_dung = None

    if nguoi_dung:
        if nguoi_dung.loai_nguoi_dung == 'quan_tri':
            return 'Quản trị viên'
        if nguoi_dung.loai_nguoi_dung == 'thu_thu':
            return 'Thủ thư'

    return 'Độc giả'


from django.contrib.auth.models import Permission


ROLE_PERMISSION_MAP = {
    'doc_gia': [
        'muon_sach.view_phieumuon',
        'muon_sach.view_chitietphieumuon',
    ],
    'thu_thu': [
        'quan_ly_sach.view_sach',
        'quan_ly_sach.add_sach',
        'quan_ly_sach.change_sach',
        'quan_ly_sach.delete_sach',
        'quan_ly_sach.view_sachtrongkho',
        'quan_ly_sach.add_sachtrongkho',
        'quan_ly_sach.change_sachtrongkho',
        'quan_ly_sach.delete_sachtrongkho',
        'muon_sach.view_phieumuon',
        'muon_sach.add_phieumuon',
        'muon_sach.change_phieumuon',
        'muon_sach.delete_phieumuon',
        'muon_sach.view_chitietphieumuon',
        'muon_sach.add_chitietphieumuon',
        'muon_sach.change_chitietphieumuon',
        'muon_sach.delete_chitietphieumuon',
        'tra_sach.view_khoanphat',
        'tra_sach.add_khoanphat',
        'tra_sach.change_khoanphat',
        'tra_sach.view_giaodichthanhtoan',
        'tra_sach.add_giaodichthanhtoan',
        'tra_sach.change_giaodichthanhtoan',
        'tra_sach.view_chitietthanhtoan',
        'tra_sach.add_chitietthanhtoan',
        'tra_sach.change_chitietthanhtoan',
        'quan_ly_nguoi_dung.view_nguoidung',
    ],
    'quan_tri': [
        'quan_ly_sach.view_sach',
        'quan_ly_sach.add_sach',
        'quan_ly_sach.change_sach',
        'quan_ly_sach.delete_sach',
        'quan_ly_sach.view_sachtrongkho',
        'quan_ly_sach.add_sachtrongkho',
        'quan_ly_sach.change_sachtrongkho',
        'quan_ly_sach.delete_sachtrongkho',
        'muon_sach.view_phieumuon',
        'muon_sach.add_phieumuon',
        'muon_sach.change_phieumuon',
        'muon_sach.delete_phieumuon',
        'muon_sach.view_chitietphieumuon',
        'muon_sach.add_chitietphieumuon',
        'muon_sach.change_chitietphieumuon',
        'muon_sach.delete_chitietphieumuon',
        'tra_sach.view_khoanphat',
        'tra_sach.add_khoanphat',
        'tra_sach.change_khoanphat',
        'tra_sach.delete_khoanphat',
        'tra_sach.view_giaodichthanhtoan',
        'tra_sach.add_giaodichthanhtoan',
        'tra_sach.change_giaodichthanhtoan',
        'tra_sach.delete_giaodichthanhtoan',
        'tra_sach.view_chitietthanhtoan',
        'tra_sach.add_chitietthanhtoan',
        'tra_sach.change_chitietthanhtoan',
        'tra_sach.delete_chitietthanhtoan',
        'tra_sach.view_chinhsachphat',
        'tra_sach.add_chinhsachphat',
        'tra_sach.change_chinhsachphat',
        'tra_sach.delete_chinhsachphat',
        'quan_ly_nguoi_dung.view_nguoidung',
        'auth.view_user',
        'auth.add_user',
        'auth.change_user',
        'auth.delete_user',
        'auth.view_group',
        'auth.add_group',
        'auth.change_group',
        'auth.delete_group',
        'auth.view_permission',
    ],
}


def sync_role_permissions(group, role_name):
    """Gan dong bo quyen cho group theo vai tro."""
    codename_list = ROLE_PERMISSION_MAP.get(role_name, [])
    permissions = Permission.objects.filter(codename__in=[item.split('.', 1)[1] for item in codename_list])

    # Lọc lại theo app_label + codename để tránh trùng codename giữa app khác nhau.
    permission_map = {f'{p.content_type.app_label}.{p.codename}': p for p in permissions}
    selected_permissions = [permission_map[item] for item in codename_list if item in permission_map]
    group.permissions.set(selected_permissions)


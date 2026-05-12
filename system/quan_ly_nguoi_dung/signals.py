from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from .models import NguoiDung
from .permission_setup import sync_role_permissions


DEFAULT_PASSWORD = '123456@abc'
User = get_user_model()

@receiver(post_save, sender=NguoiDung)
def dong_bo_group_sau_khi_luu_nguoi_dung(sender, instance, **kwargs):
    if not instance.user:
        username = instance.ma_nguoi_dung
        email_value = (instance.email or '').strip()

        # Tao User tu dong khi NguoiDung chua duoc lien ket tai khoan.
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User._default_manager.create_user(
                username=username,
                email=email_value,
                password=DEFAULT_PASSWORD,
                is_active=True,
            )
        elif email_value and not user.email:
            user.email = email_value
            user.save(update_fields=['email'])

        # Gan nguoc user vao NguoiDung ma khong gay loop save khong can thiet.
        NguoiDung.objects.filter(pk=instance.pk, user__isnull=True).update(user=user)
        instance.user = user

    mapping = {
        'doc_gia': 'DOC_GIA',
        'thu_thu': 'THU_THU',
        'quan_tri': 'QUAN_TRI',
    }

    user = instance.user

    # Xóa group cũ
    user.groups.clear()

    # Gán group mới theo loại người dùng
    ten_nhom = mapping.get(instance.loai_nguoi_dung)
    if ten_nhom:
        group, _ = Group.objects.get_or_create(name=ten_nhom)
        user.groups.add(group)
        sync_role_permissions(group, instance.loai_nguoi_dung)

    # Đồng bộ quyền quản trị
    if instance.loai_nguoi_dung == 'doc_gia':
        user.is_staff = False
        user.is_superuser = False
    elif instance.loai_nguoi_dung == 'thu_thu':
        user.is_staff = True
        user.is_superuser = False
    elif instance.loai_nguoi_dung == 'quan_tri':
        user.is_staff = True
        user.is_superuser = True

    user.save()
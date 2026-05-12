from django.apps import AppConfig


class QuanLyNguoiDungConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'quan_ly_nguoi_dung'

    def ready(self):
        import quan_ly_nguoi_dung.signals
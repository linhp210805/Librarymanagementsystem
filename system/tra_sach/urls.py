from django.urls import path
from . import views

urlpatterns = [
    path('return-books/', views.return_list_view, name='return_list'),
    path('api/xac_nhan_tra_sach/', views.api_xac_nhan_tra_sach, name='api_xac_nhan_tra_sach'),
    path('api/xu_ly_mat_sach/', views.api_xu_ly_mat_sach, name='api_xu_ly_mat_sach'),
    path('api/xac_nhan_den_sach/', views.api_xac_nhan_den_sach, name='api_xac_nhan_den_sach'),
    path('api/lay_danh_sach_phi_phat_nguoi_dung/', views.api_get_user_fines, name='api_get_user_fines'),
    path('api/thanh_toan_phi_phat/', views.api_thanh_toan_phi_phat, name='api_thanh_toan_phi_phat'),
]

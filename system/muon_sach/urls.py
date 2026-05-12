from django.urls import path
from . import views

urlpatterns = [
    path('borrow-books/', views.borrow_list, name='borrow_list'),
    path('api/danh_sach_phieu_muon/', views.api_get_borrow_list, name='api_get_borrow_list'),
    path('api/thong_tin_nguoi_dung/', views.api_get_user_info, name='api_get_user_info'),
    path('api/thong_tin_sach/', views.api_get_book_info, name='api_get_book_info'),
    path('api/tim_kiem_sach/', views.api_search_books, name='api_search_books'),
    path('api/tao_phieu_muon/', views.api_create_borrow_slip, name='api_create_borrow_slip'),

    path('api/xoa_phieu_muon/<str:pk>/', views.api_delete_borrow_slip, name='api_delete_borrow_slip'),
    path('api/gia_han_phieu_muon/<str:pk>/', views.api_extend_borrow_slip, name='api_extend_borrow_slip'),
]

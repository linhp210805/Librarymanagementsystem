from django.urls import path
from . import views

urlpatterns = [
    path('', views.book_list, name='book_list'),
    path('stock/', views.quan_ly_kho_view, name='quan_ly_kho'),
]

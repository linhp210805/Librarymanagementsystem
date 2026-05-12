from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView

urlpatterns = [
    re_path(r'^$', RedirectView.as_view(url='/login/', permanent=False)),
    path('admin/', admin.site.urls),
    path('', include('quan_ly_tai_khoan.urls')),
    path('dashboard/', include('tong_quan.urls')),
    path('', include('muon_sach.urls')),
    path('', include('tra_sach.urls')),
    path('books/', include('quan_ly_sach.urls')),
    path('users/', include('quan_ly_nguoi_dung.urls')),
    path('reports/', include('bao_cao.urls')),
]
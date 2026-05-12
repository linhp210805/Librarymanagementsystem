from django.urls import path
from . import views

urlpatterns = [
    path('', views.reader_list, name='reader_list'),
    path('data/', views.reader_list_data, name='reader_list_data'),
]

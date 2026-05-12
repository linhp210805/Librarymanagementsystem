from django.urls import path
from . import views

urlpatterns = [
    path('', views.report_statistics, name='report_statistics'),
]

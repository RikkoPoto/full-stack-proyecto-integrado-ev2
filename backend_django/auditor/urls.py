from django.urls import path
from . import views

urlpatterns = [
    path('rules', views.rules_catalog_view, name='rules-catalog'),
    path('scans', views.scans_collection_view, name='scans-collection'),
    path('scans/<str:scan_id>', views.scan_detail_view, name='scan-detail'),
    path('scans/<str:scan_id>/events', views.scan_events_view, name='scan-events'),
    path('scans/<str:scan_id>/cancel', views.scan_cancel_view, name='scan-cancel'),
    path('scans/<str:scan_id>/retry', views.scan_retry_view, name='scan-retry'),
    path('scans/<str:scan_id>/report', views.scan_report_view, name='scan-report'),
]

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls.auth')),
    path('api/owner/', include('core.urls.owner')),
    path('api/admin/', include('core.urls.admin_applications')),
    path('api/restaurants/', include('core.urls.restaurants')),
    path('api/evidence/', include('core.urls.evidence')),
    path('api/rubric/', include('core.urls.rubric')),
    path('api/score/', include('core.urls.scoring')),
    path('api/superadmin/', include('core.urls.superadmin')),
    path('api/crypto/', include('core.urls.crypto')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

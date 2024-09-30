from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from kaleem.users.api.views import AuthenticationViewSet
from kaleem.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("authentication", AuthenticationViewSet)


app_name = "api"
urlpatterns = router.urls

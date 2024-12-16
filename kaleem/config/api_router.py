from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from kaleem.messaging.api.views import ChatGroupViewSet
from kaleem.messaging.api.views import ChatMessageMediaViewSet
from kaleem.messaging.api.views import ChatMessageViewSet
from kaleem.users.api.views import AuthenticationViewSet
from kaleem.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("authentication", AuthenticationViewSet)
router.register("chat-group", ChatGroupViewSet)
router.register("chat-message", ChatMessageViewSet)
router.register("chat-message-media", ChatMessageMediaViewSet)


app_name = "api"
urlpatterns = router.urls

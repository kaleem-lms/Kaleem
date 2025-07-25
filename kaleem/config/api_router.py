from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from kaleem.dashboard.api.views import TeacherDashboardViewSet
from kaleem.messaging.api.views import ChatGroupViewSet
from kaleem.messaging.api.views import ChatMessageMediaViewSet
from kaleem.messaging.api.views import ChatMessageViewSet
from kaleem.reports.api.views import StudentSessionReportViewSet
from kaleem.resources.api.views import ResourceViewSet
from kaleem.subscriptions.api.views import CheckoutSessionViewSet
from kaleem.timetables.api.views import TimeSlotViewSet
from kaleem.users.api.views import AuthenticationViewSet
from kaleem.users.api.views import TeachersViewSet
from kaleem.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register(
    "users",
    UserViewSet,
)
router.register(
    "authentication",
    AuthenticationViewSet,
)
router.register(
    "chat-group",
    ChatGroupViewSet,
)
router.register(
    "chat-message",
    ChatMessageViewSet,
)
router.register(
    "chat-message-media",
    ChatMessageMediaViewSet,
)
router.register(
    "time-slots",
    TimeSlotViewSet,
)
router.register(
    "checkout",
    CheckoutSessionViewSet,
    basename="checkout",
)
router.register(
    "teacher-dashboard",
    TeacherDashboardViewSet,
    basename="teacher_dashboard",
)
router.register(
    "resources",
    ResourceViewSet,
)
router.register(
    "teachers",
    TeachersViewSet,
    basename="teachers",
)
router.register(
    "reports",
    StudentSessionReportViewSet,
)


app_name = "api"
urlpatterns = router.urls

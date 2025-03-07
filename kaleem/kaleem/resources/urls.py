from django.urls import path

from kaleem.resources.api.views import AssignResourceAPIView
from kaleem.resources.api.views import StudentAssignedResourcesAPIView

app_name = "resources"

urlpatterns = [
    path(
        "assign-resource/",
        AssignResourceAPIView.as_view(),
        name="assign_resource",
    ),
    path(
        "my-resources/",
        StudentAssignedResourcesAPIView.as_view(),
        name="student_resources",
    ),
]

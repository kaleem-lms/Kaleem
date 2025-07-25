from django.contrib.auth.models import User
from rest_framework import permissions
from rest_framework import viewsets
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from kaleem.resources.api.serializers import AssignedResourceSerializer
from kaleem.resources.api.serializers import ResourceCategorySerializer
from kaleem.resources.api.serializers import ResourceSerializer
from kaleem.resources.models import AssignedResource
from kaleem.resources.models import Resource
from kaleem.users.permissions import IsTeacher


class AssignResourceAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def post(self, request):
        resource_id = request.data.get("resource_id")
        student_id = request.data.get("student_id")

        try:
            resource = Resource.objects.get(id=resource_id)
        except Resource.DoesNotExist:
            return Response(
                {"error": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
            return Response(
                {"error": "Student not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create an assignment record.
        assigned = AssignedResource.objects.create(
            teacher=request.user,
            student=student,
            resource=resource,
        )
        serializer = AssignedResourceSerializer(assigned)
        return Response(
            {
                "message": "Resource assigned successfully.",
                "assignment": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentAssignedResourcesAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get assignments for the current student
        assignments = AssignedResource.objects.filter(
            student=request.user,
        ).select_related("resource__category")
        # Group resources by category
        category_dict = {}
        for assignment in assignments:
            category = assignment.resource.category
            if category.id not in category_dict:
                category_dict[category.id] = {
                    "category": ResourceCategorySerializer(
                        category,
                        context={"request": request},
                    ).data,
                    "resources": [],
                }
            category_dict[category.id]["resources"].append(
                ResourceSerializer(
                    assignment.resource,
                    context={"request": request},
                ).data,
            )

        # Convert dictionary to list
        grouped_data = list(category_dict.values())
        return Response({"assigned_resources": grouped_data})


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows resources to be viewed.
    """

    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacher]

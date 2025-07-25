from django.contrib.auth import get_user_model
from drf_spectacular.utils import OpenApiExample
from drf_spectacular.utils import OpenApiResponse
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework import serializers
from rest_framework import status
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from kaleem.resources.api.serializers import AssignedResourceSerializer
from kaleem.resources.api.serializers import AssignResourceInputSerializer
from kaleem.resources.api.serializers import ResourceCategorySerializer
from kaleem.resources.api.serializers import ResourceSerializer
from kaleem.resources.models import AssignedResource
from kaleem.resources.models import Resource
from kaleem.users.permissions import IsTeacher

User = get_user_model()


@extend_schema(
    request=AssignResourceInputSerializer,
    responses={
        201: OpenApiResponse(
            response=serializers.DictField(),  # or create a BulkAssignedResourceSerializer if needed
            description="Resources assigned successfully.",
        ),
        404: OpenApiResponse(
            response=serializers.DictField(child=serializers.CharField()),
            description="Resource or some students not found.",
        ),
    },
    examples=[
        OpenApiExample(
            name="Bulk Assign Resource",
            value={"resource_id": 1, "student_ids": [5, 6, 7]},
            request_only=True,
        ),
        OpenApiExample(
            name="Success Response",
            value={
                "message": "Resources assigned successfully.",
                "assignments": [
                    {
                        "id": 12,
                        "teacher": 1,
                        "student": 5,
                        "resource": 1,
                        "assigned_at": "2025-07-25T10:11:12.345Z",
                    },
                    {
                        "id": 13,
                        "teacher": 1,
                        "student": 6,
                        "resource": 1,
                        "assigned_at": "2025-07-25T10:11:12.678Z",
                    },
                ],
            },
            response_only=True,
        ),
    ],
    description="Bulk assign a resource to multiple students by an authenticated teacher.",
)
class AssignResourceAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacher]


    def post(self, request):
        serializer = AssignResourceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resource_id = serializer.validated_data["resource_id"]
        student_ids = serializer.validated_data["student_ids"]

        try:
            resource = Resource.objects.get(id=resource_id)
        except Resource.DoesNotExist:
            return Response(
                {"error": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        students = User.objects.filter(id__in=student_ids)
        found_ids = set(students.values_list("id", flat=True))
        missing_ids = list(set(student_ids) - found_ids)

        if missing_ids:
            return Response(
                {"error": f"Student(s) not found: {missing_ids}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        assignments = []
        for student in students:
            # Avoid duplicates
            already_exists = AssignedResource.objects.filter(
                teacher=request.user,
                student=student,
                resource=resource,
            ).exists()
            if not already_exists:
                assigned = AssignedResource.objects.create(
                    teacher=request.user,
                    student=student,
                    resource=resource,
                )
                assignments.append(assigned)

        output_serializer = AssignedResourceSerializer(assignments, many=True)

        return Response(
            {
                "message": "Resources assigned successfully.",
                "assignments": output_serializer.data,
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

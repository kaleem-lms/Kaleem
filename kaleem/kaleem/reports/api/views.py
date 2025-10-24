from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from kaleem.reports.models import StudentSessionReport

from .serializers import StudentSessionReportSerializer


# class StudentSessionReportViewSet(viewsets.ReadOnlyModelViewSet):
#     """
#     ViewSet to retrieve reports, including filtering by student ID.
#     """
#     queryset = StudentSessionReport.objects.all()
#     serializer_class = StudentSessionReportSerializer
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         """
#         Optionally filter by student ID if provided as a query parameter.
#         """
#         queryset = super().get_queryset()
#         student_id = self.request.query_params.get("student_id")
#         if student_id:
#             queryset = queryset.filter(student_id=student_id)
#         return queryset

#     @action(detail=False, methods=["get"], url_path="by-student/(?P<student_id>\\d+)")
#     def reports_by_student(self, request, student_id=None):
#         """
#         Custom action to fetch reports for a specific student by URL parameter.
#         """
#         reports = self.get_queryset().filter(student_id=student_id)
#         serializer = self.get_serializer(reports, many=True)
#         return Response(serializer.data)


class StudentSessionReportViewSet(viewsets.ModelViewSet):
    queryset = StudentSessionReport.objects.all()
    serializer_class = StudentSessionReportSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="by-student/(?P<student_id>\\d+)")
    def reports_by_student(self, request, student_id=None):
        reports = self.get_queryset().filter(student_id=student_id)
        serializer = self.get_serializer(reports, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Example: auto-assign teacher from request.user if user is a teacher
        # Uncomment if you want such logic
        # serializer.save(teacher=self.request.user.teacher)
        serializer.save()

from rest_framework import serializers

from kaleem.users.api.serializers import TeacherSerializer
from kaleem.reports.models import StudentSessionReport

1

# class StudentSessionReportSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = StudentSessionReport
#         fields = "__all__"


class StudentSessionReportSerializer(serializers.ModelSerializer):
    teacher = TeacherSerializer(read_only=True, source="session_slot.teacher")

    class Meta:
        model = StudentSessionReport
        fields = [
            "id",
            "teacher",
            "student",
            "session_slot",
            "created_at",
            "content",
            "rate",
        ]
        read_only_fields = ["id", "created_at"]

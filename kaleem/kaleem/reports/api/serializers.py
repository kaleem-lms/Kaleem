from rest_framework import serializers

from kaleem.reports.models import StudentSessionReport


# class StudentSessionReportSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = StudentSessionReport
#         fields = "__all__"


class StudentSessionReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentSessionReport
        fields = [
            "id",
            "student",
            "session_slot",
            "created_at",
            "content",
            "rate",
        ]
        read_only_fields = ["id", "created_at"]

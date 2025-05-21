from rest_framework import serializers

from kaleem.reports.models import StudentSessionReport


class StudentSessionReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentSessionReport
        fields = "__all__"

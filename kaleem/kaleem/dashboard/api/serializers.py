from rest_framework import serializers

from kaleem.reports.models import StudentSessionReport
from kaleem.timetables.models import SessionSlot


class WeeklyTimetableSerializer(serializers.ModelSerializer):
    students = serializers.SerializerMethodField()

    class Meta:
        model = SessionSlot
        fields = [
            "date",
            "start_time",
            "end_time",
            "students",
            "status",
        ]

    def get_students(self, obj):
        return [student.name for student in obj.students.all()]


class SubscribedStudentSerializer(serializers.Serializer):
    student = serializers.CharField()
    family = serializers.CharField(allow_null=True)
    taken_sessions_count = serializers.IntegerField()
    last_session = serializers.SerializerMethodField()
    current_resource = serializers.CharField(allow_null=True)

    def get_last_session(self, obj):
        session = obj.get("last_session")
        if session:
            return {
                "date": session.date,
                "start_time": session.start_time,
            }
        return None


class StudentReportSerializer(serializers.ModelSerializer):
    student = serializers.CharField(source="student.name")
    teacher = serializers.CharField(source="teacher.name")

    class Meta:
        model = StudentSessionReport
        fields = [
            "student",
            "teacher",
            "session_slot",
            "created_at",
            "content",
            "rate",
        ]

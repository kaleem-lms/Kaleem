from datetime import datetime

import pytz
from django.utils import timezone
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


class UpcomingSessionsSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next_session_timestamp = serializers.IntegerField(allow_null=True)


class PendingReportSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    student = serializers.CharField()
    due_date = serializers.DateField()


class TeacherDashboardSerializer(serializers.Serializer):
    upcoming_sessions = serializers.SerializerMethodField()
    pending_reports = serializers.SerializerMethodField()

    def get_upcoming_sessions(self, teacher):
        """
        Count all SessionSlot on today or later, and find the earliest one.
        """
        now = timezone.localtime()
        qs = SessionSlot.objects.filter(
            teacher=teacher,
            date__gte=now.date(),
        ).order_by("date", "start_time")

        count = qs.count()
        next_slot = qs.first()
        if next_slot:
            # combine date+time to a timezone‐aware datetime, then to epoch seconds  # noqa: E501, RUF003
            dt = datetime.combine(next_slot.date, next_slot.start_time)
            # assume project default timezone
            tz = pytz.timezone(timezone.get_current_timezone_name())
            aware = tz.localize(dt)
            ts = int(aware.timestamp())
        else:
            ts = None

        return {
            "count": count,
            "next_session_timestamp": ts,
        }

    def get_pending_reports(self, teacher):
        """
        For any past session (date < today) and each student in it,
        if no StudentSessionReport exists yet, include it here.
        """
        today = timezone.localdate()
        pending = []

        past_slots = SessionSlot.objects.filter(
            teacher=teacher,
            date__lt=today,
        ).prefetch_related("students")

        for slot in past_slots:
            for student in slot.students.all():
                # check if report exists
                exists = StudentSessionReport.objects.filter(
                    session_slot__teacher=teacher,
                    student=student,
                    session_slot=slot,
                ).exists()
                if not exists:
                    pending.append(
                        {
                            "session_id": slot.id,
                            "student": student.name,
                            "student_id": student.id,
                            "due_date": slot.date,
                        },
                    )

        return pending

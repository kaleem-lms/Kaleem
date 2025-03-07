from rest_framework import serializers  # noqa: EXE002

from kaleem.timetables.models import SessionSlot
from kaleem.users.models import Student
from kaleem.users.models import Teacher


class TimeSlotSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    teacher = serializers.HiddenField(
        default=serializers.CurrentUserDefault(),
    )
    day_of_week = serializers.IntegerField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    is_free = serializers.BooleanField(default=True)
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(),
        required=False,
        allow_null=True,
    )


class SessionSlotSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)
    students_names = serializers.SerializerMethodField()

    class Meta:
        model = SessionSlot
        fields = [
            "id",
            "teacher",
            "teacher_name",
            "students",
            "students_names",
            "date",
            "start_time",
            "end_time",
            "status",
            "created_at",
            "zoom_meeting_id",
            "zoom_meeting_link",
        ]
        read_only_fields = ["created_at"]

    def get_students_names(self, obj):
        return [student.name for student in obj.students.all()]


class OccupyTimeSerializer(serializers.Serializer):
    teacher_id = serializers.PrimaryKeyRelatedField(queryset=Teacher.objects.all())
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    day_of_week = serializers.IntegerField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()

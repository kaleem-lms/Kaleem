from django.db.models import Q
from drf_spectacular.utils import OpenApiResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kaleem.timetables.models import SessionSlot
from kaleem.timetables.models import TimeSlot

from .serializers import OccupyTimeSerializer
from .serializers import SessionSlotSerializer
from .serializers import TimeSlotSerializer


class TimeSlotViewSet(viewsets.ViewSet):
    """
    A ViewSet for managing time slots for teachers.
    """

    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer

    @extend_schema(
        description="Create multiple time slots in bulk.",
        request=TimeSlotSerializer(many=True),
        responses={201: TimeSlotSerializer(many=True)},
    )
    @action(detail=False, methods=["post"])
    def bulk_create(self, request):
        """
        Create multiple time slots in bulk.
        """
        # Check if the user is a teacher
        if not hasattr(request.user, "teacher") or not request.user.teacher:
            return Response(
                {"detail": "You must be a teacher to create time slots."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get the teacher instance
        teacher = request.user.teacher

        # Ensure the current user is set as the teacher for each time slot
        data = [{**item, "teacher": teacher.id} for item in request.data]

        serializer = TimeSlotSerializer(
            data=data,
            many=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        # Manually create the TimeSlot instances
        time_slots = []
        for valid_data in serializer.validated_data:
            time_slot = TimeSlot.objects.create(
                teacher=teacher,  # Assign the teacher instance
                day_of_week=valid_data["day_of_week"],
                start_time=valid_data["start_time"],
                end_time=valid_data["end_time"],
                is_free=valid_data.get("is_free", True),
                student=valid_data.get("student"),
            )
            time_slots.append(time_slot)

        # Serialize the created objects for the response
        response_serializer = TimeSlotSerializer(
            time_slots,
            many=True,
            context={"request": request},
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        description="Occupy a time range for a specific teacher.",
        request=OccupyTimeSerializer,
        responses={
            200: OpenApiResponse(description="Time slot occupied successfully."),
            400: OpenApiResponse(
                description="Bad request if no time slot is available.",
            ),
        },
    )
    @action(detail=False, methods=["post"])
    def occupy_time(self, request):
        """
        Occupy a specific time range for a teacher on a given day.
        """
        serializer = OccupyTimeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        teacher = serializer.validated_data["teacher_id"]
        student = serializer.validated_data["student_id"]
        day_of_week = serializer.validated_data["day_of_week"]
        start_time = serializer.validated_data["start_time"]
        end_time = serializer.validated_data["end_time"]

        try:
            TimeSlot.occupy_time(
                teacher=teacher,
                student=student,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
            )
            return Response(
                {"detail": "Time slot occupied successfully."},
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        description="List all time slots for a specific teacher.",
        responses={200: TimeSlotSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def teacher_slots(self, request, pk=None):
        """
        List all time slots for a specific teacher.
        """
        queryset = TimeSlot.objects.filter(teacher_id=pk)
        serializer = TimeSlotSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        description="List all sessions for a current user.",
        responses={200: TimeSlotSerializer(many=True)},
    )
    @action(detail=False, methods=["get"])
    def user_sessions(self, request):
        """
        List all sessions for a specific user.
        """
        queryset = SessionSlot.objects.filter(
            Q(students=request.user.id) | Q(teacher_id=request.user.id),
        )
        serializer = SessionSlotSerializer(queryset, many=True)
        return Response(serializer.data)

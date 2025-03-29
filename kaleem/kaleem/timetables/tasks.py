from datetime import datetime
from datetime import timedelta

from celery import shared_task

from .models import SessionSlot
from .models import Teacher
from .models import TimeSlot
from .services import ZoomService


@shared_task()
def create_weekly_sessions():
    today = datetime.today().date()

    days_until_next_saturday = (6 - today.weekday() + 1) % 7
    next_week_start = today + timedelta(days=days_until_next_saturday)

    zoom_service = ZoomService()

    teachers = Teacher.objects.all()
    for teacher in teachers:
        # Filter time slots for the upcoming week
        time_slots = TimeSlot.objects.filter(
            teacher=teacher,
            is_free=False,
        )

        for slot in time_slots:
            # Calculate the exact date for the time slot
            session_date = next_week_start + timedelta(
                days=(slot.day_of_week - next_week_start.weekday()) % 7,
            )

            # Calculate start and end times for the session
            start_time = datetime.combine(session_date, slot.start_time)
            end_time = datetime.combine(session_date, slot.end_time)

            # Create a Zoom meeting
            zoom_meeting = zoom_service.create_meeting(
                host_email=teacher.zoom_email,
                topic=f"Session with {teacher.name}",
                duration=int((end_time - start_time).total_seconds() / 60),
                start_time=start_time.isoformat(),
            )

            # Create a session slot with Zoom meeting details
            SessionSlot.objects.create(
                teacher=teacher,
                date=session_date,
                start_time=slot.start_time,
                end_time=slot.end_time,
                zoom_meeting_id=zoom_meeting["id"],
                zoom_meeting_link=zoom_meeting["join_url"],
            )

    return f"Sessions scheduled for the week starting {next_week_start}"

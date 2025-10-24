from collections import Counter
from datetime import datetime
from datetime import timedelta

from django.db.models import Avg
from django.db.models import Count
from django.utils import timezone
from rest_framework import permissions
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kaleem.reports.models import StudentSessionReport
from kaleem.timetables.choices import SessionStatus
from kaleem.timetables.models import SessionSlot
from kaleem.users.models import Student

from .serializers import TeacherDashboardSerializer


class TeacherDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        teacher = request.user
        serializer = TeacherDashboardSerializer(teacher)
        return Response(serializer.data)


def seconds_to_hms(seconds: int):
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    human = (
        f"{hours}h {minutes}m"
        if hours
        else f"{minutes}m {secs}s"
        if minutes
        else f"{secs}s"
    )
    return {
        "hours": hours,
        "minutes": minutes,
        "seconds": secs,
        "human_readable": human,
    }


def iterate_sessions_durations(qs):
    for s in qs:
        try:
            start_dt = datetime.combine(s.date, s.start_time)
            end_dt = datetime.combine(s.date, s.end_time)
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
            yield int((end_dt - start_dt).total_seconds())
        except Exception:
            continue


class StudentDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _get_student(self, request):
        user = request.user
        if (
            hasattr(user, "assigned_teacher")
            or getattr(user, "role", None) == "S"
            or user.__class__.__name__.lower() == "student"
        ):
            return user
        try:
            return Student.objects.get(pk=user.pk)
        except Student.DoesNotExist:
            return None

    def list(self, request):
        student = self._get_student(request)
        if student is None:
            return Response({"detail": "Student profile not found."}, status=404)

        now = timezone.now()
        today = now.date()
        year, month = now.year, now.month

        # Base querysets
        all_sessions = SessionSlot.objects.filter(students=student)
        completed_sessions = all_sessions.filter(status=SessionStatus.COMPLETED)
        upcoming_sessions = all_sessions.filter(
            status=SessionStatus.SCHEDULED,
            date__gte=today,
        )
        past_sessions = all_sessions.filter(date__lte=today)

        current_month_sessions = past_sessions.filter(
            date__year=year,
            date__month=month,
        )
        reports = StudentSessionReport.objects.filter(student=student)
        reports_month = reports.filter(created_at__year=year, created_at__month=month)

        # Compute durations
        all_durations = list(iterate_sessions_durations(completed_sessions))
        month_durations = list(iterate_sessions_durations(current_month_sessions))
        total_seconds_all = sum(all_durations)
        total_seconds_month = sum(month_durations)
        avg_session_length = (
            total_seconds_all / len(all_durations) if all_durations else 0
        )

        # Ratings
        avg_rating_all = reports.aggregate(avg=Avg("rate"))["avg"] or 0.0
        avg_rating_month = reports_month.aggregate(avg=Avg("rate"))["avg"] or 0.0
        rating_dist_raw = dict(
            reports.values_list("rate").annotate(count=Count("pk")).order_by("rate"),
        )
        rating_distribution = {str(i): rating_dist_raw.get(i, 0) for i in range(1, 6)}

        # Teachers
        teachers_count = all_sessions.values("teacher").distinct().count()
        teacher_time = Counter()
        for s, secs in zip(
            past_sessions.select_related("teacher"),
            iterate_sessions_durations(past_sessions),
        ):
            t = s.teacher
            teacher_time[(t.id, t.name)] += secs

        top_teachers = [
            {
                "teacher_id": pk,
                "teacher_name": name,
                "total_teaching_time": seconds_to_hms(secs),
            }
            for (pk, name), secs in teacher_time.most_common(5)
        ]

        # Attendance
        total_sessions_count = all_sessions.count()
        completed_sessions_count = completed_sessions.count()
        attendance_rate = (
            round((completed_sessions_count / total_sessions_count) * 100, 2)
            if total_sessions_count
            else 0
        )

        # Session streak (consecutive weeks with at least one session)
        past_weeks = past_sessions.values_list("date", flat=True).distinct()
        week_numbers = sorted({d.isocalendar()[1] for d in past_weeks})
        streak = 0
        if week_numbers:
            streak = 1
            for i in range(len(week_numbers) - 1, 0, -1):
                if week_numbers[i] - week_numbers[i - 1] == 1:
                    streak += 1
                else:
                    break

        # Earliest and latest sessions
        first_session = past_sessions.order_by("date").first()
        last_session = past_sessions.order_by("-date").first()

        # Ratings trend (last 6 months)
        trend = []
        y, m = year, month
        for i in range(5, -1, -1):
            mm = m - i
            yy = y
            while mm <= 0:
                mm += 12
                yy -= 1
            month_reports = reports.filter(created_at__year=yy, created_at__month=mm)
            avg_rate = month_reports.aggregate(avg=Avg("rate"))["avg"] or 0.0
            sessions_in_month = past_sessions.filter(date__year=yy, date__month=mm)
            total_secs = sum(iterate_sessions_durations(sessions_in_month))
            trend.append(
                {
                    "year": yy,
                    "month": mm,
                    "average_rating": round(avg_rate, 2),
                    "session_count": sessions_in_month.count(),
                    "total_session_duration": seconds_to_hms(total_secs),
                },
            )

        # Engagement score (synthetic metric)
        # Weighted combo of rating (out of 5) and attendance (out of 100)
        engagement_score = round(
            (avg_rating_all / 5 * 60) + (attendance_rate / 100 * 40),
            2,
        )

        # Final payload
        payload = {
            "metadata": {
                "student_id": student.id,
                "student_name": student.name,
                "generated_at": now.isoformat(),
            },
            "overview": {
                "total_sessions": total_sessions_count,
                "completed_sessions": completed_sessions_count,
                "upcoming_sessions": upcoming_sessions.count(),
                "attendance_rate_percent": attendance_rate,
                "average_session_length": seconds_to_hms(int(avg_session_length)),
                "total_time_spent_all_time": seconds_to_hms(total_seconds_all),
                "total_time_spent_current_month": seconds_to_hms(total_seconds_month),
                "teachers_interacted_with": teachers_count,
                "current_streak_weeks": streak,
                "first_session_date": first_session.date if first_session else None,
                "last_session_date": last_session.date if last_session else None,
                "engagement_score": engagement_score,
            },
            "ratings": {
                "average_rating_all_time": round(avg_rating_all, 2),
                "average_rating_current_month": round(avg_rating_month, 2),
                "rating_distribution": rating_distribution,
                "total_reports_all_time": reports.count(),
                "total_reports_current_month": reports_month.count(),
                "trend_last_6_months": trend,
            },
            "teachers": {
                "top_teachers_by_total_time": top_teachers,
                "total_teachers_count": teachers_count,
            },
        }

        return Response(payload)

    @action(detail=False, methods=["get"])
    def quick(self, request):
        student = self._get_student(request)
        if student is None:
            return Response({"detail": "Student profile not found."}, status=404)

        completed_sessions = SessionSlot.objects.filter(
            students=student,
            status=SessionStatus.COMPLETED,
        )
        reports = StudentSessionReport.objects.filter(student=student)

        total_seconds = sum(iterate_sessions_durations(completed_sessions))
        avg_rating = reports.aggregate(avg=Avg("rate"))["avg"] or 0.0

        return Response(
            {
                "student_id": student.pk,
                "summary": {
                    "total_sessions_completed": completed_sessions.count(),
                    "total_study_time": seconds_to_hms(total_seconds),
                    "average_rating": round(avg_rating, 2),
                },
            },
        )

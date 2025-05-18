from rest_framework import permissions
from rest_framework import viewsets
from rest_framework.response import Response

from .serializers import TeacherDashboardSerializer

# class TeacherDashboardViewSet(viewsets.ViewSet):
#     """
#     A ViewSet for handling teacher dashboard data.
#     """

#     permission_classes = [permissions.IsAuthenticated]

#     def list(self, request):
#         user = request.user
#         teacher = get_object_or_404(Teacher, id=user.id)

#         data = {
#             "weekly_timetable": self.get_weekly_timetable(user),
#             "subscribed_students": self.get_subscribed_students(teacher),
#             "students_reports": self.get_students_reports(user),
#         }
#         return Response(data)

#     def get_weekly_timetable(self, teacher):
#         today = datetime.now(tz=UTC).date()
#         start_week = today - timedelta(days=today.weekday())
#         end_week = start_week + timedelta(days=6)

#         sessions = SessionSlot.objects.filter(
#             teacher=teacher,
#             date__range=[start_week, end_week],
#         ).order_by("date", "start_time")

#         return WeeklyTimetableSerializer(sessions, many=True).data

#     def get_subscribed_students(self, teacher):
#         students = Student.objects.filter(assigned_teacher=teacher)
#         data = []

#         for student in students:
#             subscriptions = UserSubscription.objects.filter(
#                 user=student,
#             )
#             last_session = (
#                 SessionSlot.objects.filter(students=student).order_by("-date").first()
#             )

#             data.append(
#                 {
#                     "student": student.name,
#                     "family": student.assigned_parent.families.first().name
#                     if student.assigned_parent
#                     else None,
#                     "taken_sessions_count": SessionSlot.objects.filter(
#                         students=student,
#                     ).count(),
#                     "last_session": last_session,
#                     "current_resource": subscriptions.first().plan.name
#                     if subscriptions.exists()
#                     else None,
#                 },
#             )

#         return SubscribedStudentSerializer(data, many=True).data

#     def get_students_reports(self, teacher):
#         students = Student.objects.filter(assigned_teacher=teacher)
#         reports = StudentSessionReport.objects.filter(student__in=students).order_by(
#             "-created_at",
#         )

#         return StudentReportSerializer(reports, many=True).data


class TeacherDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        teacher = request.user
        serializer = TeacherDashboardSerializer(teacher)
        return Response(serializer.data)

from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from datetime import datetime

class TeacherDashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/teacher_dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Mock data for the dashboard
        context['dashboard_data'] = {
            'upcoming_sessions': [
                {'id': 1, 'student': "Ali Ahmed", 'date': "2025-04-01", 'time': "10:00 AM", 'status': "Scheduled"},
                {'id': 2, 'student': "Sara Khaled", 'date': "2025-04-02", 'time': "11:30 AM", 'status': "Scheduled"},
            ],
            'pending_reports': [
                {'session_id': 1, 'student': "Ali Ahmed", 'due_date': "2025-04-03"}
            ],
            'trial_requests': [
                {'id': 101, 'student': "Mohamed Hassan", 'request_date': "2025-03-29", 'status': "Pending"}
            ],
            'subscription': {
                'plan': "Pro",
                'expiry': "2025-06-01",
                'remaining_sessions': 12,
            }
        }
        return context

from rest_framework import permissions


class IsTeacher(permissions.BasePermission):
    """
    Custom permission to allow only teacher users.
    Here you might check if the user has a teacher flag or is_staff.
    """

    def has_permission(self, request, view):
        return request.user

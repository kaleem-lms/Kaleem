from rest_framework.permissions import SAFE_METHODS
from rest_framework.permissions import BasePermission

from .choices import GroupMemberRoleChoices
from .choices import GroupMemberStatusChoices


class IsGroupOwnerOrAdmin(BasePermission):
    """
    Permission for group owners and admins to manage group-related actions.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user is the group owner or an admin
        return (
            obj.author == request.user.userprofile
            or obj.chatgroupmember_set.filter(
                user=request.user.userprofile,
                role=GroupMemberRoleChoices.ADMIN,
                status=GroupMemberStatusChoices.ACTIVE,
            ).exists()
        )


class IsGroupOwner(BasePermission):
    """
    Permission for group owners to edit/delete groups.
    """

    def has_object_permission(self, request, view, obj):
        return obj.author == request.user.userprofile


class CanSendMessages(BasePermission):
    """
    Permission for all active group members to send messages.
    """

    def has_object_permission(self, request, view, obj):
        return obj.chatgroupmember_set.filter(
            user=request.user.userprofile,
            status=GroupMemberStatusChoices.ACTIVE,
        ).exists()


class CanEditOrDeleteMessage(BasePermission):
    """
    Permission for message authors, group owners, or group admins to edit/delete messages.
    """  # noqa: E501

    def has_object_permission(self, request, view, obj):
        # Check if the user is the message owner, group owner, or an admin
        return (
            request.user.userprofile in (obj.author, obj.group.author)
            or obj.group.chatgroupmember_set.filter(
                user=request.user.userprofile,
                role=GroupMemberRoleChoices.ADMIN,
                status=GroupMemberStatusChoices.ACTIVE,
            ).exists(),
        )


class CanAccessMediaFile(BasePermission):
    """
    Allow group members to view media files and message owners to upload/delete.
    """

    def has_object_permission(self, request, view, obj):
        # Allow all group members to access media files
        if request.method in SAFE_METHODS:
            return obj.message.group.chatgroupmember_set.filter(
                user=request.user.userprofile,
                status=GroupMemberStatusChoices.ACTIVE,
            ).exists()
        # Allow message author or group owner/admin to manage media
        return (
            request.user.userprofile in (obj.message.author, obj.message.group.author)
            or obj.message.group.chatgroupmember_set.filter(
                user=request.user.userprofile,
                role=GroupMemberRoleChoices.ADMIN,
                status=GroupMemberStatusChoices.ACTIVE,
            ).exists(),
        )

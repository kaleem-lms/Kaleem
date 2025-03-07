from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from kaleem.messaging.models import ChatGroup
from kaleem.messaging.models import ChatMessage
from kaleem.messaging.models import ChatMessageMedia
from kaleem.messaging.permissions import CanAccessMediaFile
from kaleem.messaging.permissions import CanEditOrDeleteMessage
from kaleem.messaging.permissions import CanSendMessages
from kaleem.messaging.permissions import IsGroupOwner
from kaleem.messaging.permissions import IsGroupOwnerOrAdmin
from kaleem.messaging.services import add_member_to_group
from kaleem.messaging.services import mark_message_as_seen
from kaleem.messaging.services import remove_member_from_group
from kaleem.messaging.services import send_message
from kaleem.users.models import UserProfile

from .serializers import ChatGroupMemberSerializer
from .serializers import ChatGroupSerializer
from .serializers import ChatMessageMediaSerializer
from .serializers import ChatMessageSerializer


class ChatGroupViewSet(viewsets.ModelViewSet):
    queryset = ChatGroup.objects.all()
    serializer_class = ChatGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsGroupOwner()]
        if self.action in ["add_member", "remove_member"]:
            return [IsGroupOwnerOrAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=["post"])
    def add_member(self, request, pk=None):
        group = get_object_or_404(ChatGroup, pk=pk)
        user = get_object_or_404(UserProfile, pk=request.data["user_id"])
        role = request.data.get("role", "member")
        member = add_member_to_group(group, user, role)
        return Response(ChatGroupMemberSerializer(member).data)

    @action(detail=True, methods=["post"])
    def remove_member(self, request, pk=None):
        group = get_object_or_404(ChatGroup, pk=pk)
        user = get_object_or_404(UserProfile, pk=request.data["user_id"])
        member = remove_member_from_group(group, user)
        return Response(ChatGroupMemberSerializer(member).data)


class ChatMessageViewSet(viewsets.ModelViewSet):
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [CanEditOrDeleteMessage()]
        if self.action in ["create"]:
            return [CanSendMessages()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Ensure the author of the message is the logged-in user
        serializer.save(author=self.request.user.userprofile)


class ChatMessageMediaViewSet(viewsets.ModelViewSet):
    queryset = ChatMessageMedia.objects.all()
    serializer_class = ChatMessageMediaSerializer
    permission_classes = [IsAuthenticated, CanAccessMediaFile]

    def perform_create(self, serializer):
        # Ensure the user is the message author
        message = serializer.validated_data["message"]
        if message.author != self.request.user.userprofile:
            msg = "You can only upload media for your own messages."
            raise PermissionDenied(msg)
        serializer.save()

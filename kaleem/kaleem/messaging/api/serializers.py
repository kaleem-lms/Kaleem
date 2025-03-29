from rest_framework import serializers

from kaleem.messaging.models import ChatGroup
from kaleem.messaging.models import ChatGroupMember
from kaleem.messaging.models import ChatMessage
from kaleem.messaging.models import ChatMessageMedia


class ChatGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatGroup
        fields = "__all__"


class ChatGroupMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatGroupMember
        fields = "__all__"


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = "__all__"


class ChatMessageMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessageMedia
        fields = ['id', 'message', 'media', 'media_type', 'created_at']

    def validate_media(self, value):
        # Add custom validation for file types or sizes
        if value.size > 10 * 1024 * 1024:  # Example: Max file size is 10MB
            raise serializers.ValidationError("Media file size cannot exceed 10MB.")
        return value

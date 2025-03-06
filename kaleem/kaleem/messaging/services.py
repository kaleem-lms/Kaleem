from datetime import timezone

from django.db import transaction

from kaleem.messaging.choices import ChatMessageMediaTypeChoices
from kaleem.messaging.choices import GroupMemberRoleChoices
from kaleem.messaging.choices import GroupMemberStatusChoices

from .models import ChatGroup
from .models import ChatGroupMember
from .models import ChatMessage
from .models import ChatMessageMedia


def create_chat_group(
    name,
    description,
    author,
):
    with transaction.atomic():
        group = ChatGroup.objects.create(
            name=name,
            description=description,
            author=author,
        )
        ChatGroupMember.objects.create(
            group=group,
            user=author,
            role=GroupMemberRoleChoices.OWNER,
        )
    return group


def add_member_to_group(
    group,
    user,
):
    member, created = ChatGroupMember.objects.get_or_create(
        group=group,
        user=user,
    )
    return member


def remove_member_from_group(
    group,
    user,
):
    member = ChatGroupMember.objects.filter(
        group=group,
        user=user,
    ).first()
    if member:
        member.status = GroupMemberStatusChoices.REMOVED
        member.left_at = timezone.now()
        member.save()
    return member


def send_message(
    group,
    author,
    content,
    message_type=ChatMessageMediaTypeChoices.TEXT,
    media=None,
):
    with transaction.atomic():
        message = ChatMessage.objects.create(
            content=content,
            author=author,
            group=group,
        )
        if media:
            ChatMessageMedia.objects.create(
                message=message,
                media=media,
                media_type=message_type,
            )
    return message


def mark_message_as_seen(message):
    message.seen_count += 1
    message.save()
    return message

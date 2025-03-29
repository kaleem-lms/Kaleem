from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from kaleem.users.api.serializers import ParentRegisterSerializer
from kaleem.users.api.serializers import StudentRegisterSerializer
from kaleem.users.api.serializers import TeacherRegisterSerializer
from kaleem.users.models import Parent
from kaleem.users.models import Student
from kaleem.users.models import Teacher

User = get_user_model()


class AuthenticationService:
    @staticmethod
    def authenticate_user(*, email: str, password: str) -> User:
        user = authenticate(email=email, password=password)
        if user is not None:
            return user
        msg = "Ivalid credentials"
        raise ValidationError(msg)

    @staticmethod
    def register_student(data: dict) -> Student:
        serializer = StudentRegisterSerializer(data=data)
        if serializer.is_valid():
            return serializer.save()
        raise ValidationError(serializer.errors)

    @staticmethod
    def register_teacher(data: dict) -> Teacher:
        serializer = TeacherRegisterSerializer(data=data)
        if serializer.is_valid():
            return serializer.save()
        raise ValidationError(serializer.errors)

    @staticmethod
    def register_parent(data: dict) -> Parent:
        serializer = ParentRegisterSerializer(data=data)
        if serializer.is_valid():
            return serializer.save()
        raise ValidationError(serializer.errors)

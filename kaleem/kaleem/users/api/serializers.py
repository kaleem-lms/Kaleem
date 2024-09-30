from rest_framework import serializers

from kaleem.users.models import Parent
from kaleem.users.models import Student
from kaleem.users.models import Teacher
from kaleem.users.models import User
from kaleem.users.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer[UserProfile]):
    picture = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "bio",
            "picture",
        )

    def get_picture(self, obj: UserProfile) -> str:
        return obj.profile_image.url if obj.profile_image else ""


class UserSerializer(serializers.ModelSerializer[User]):
    profile = UserProfileSerializer()
    gender = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "gender",
            "profile",
            "role",
            "url",
        )

        extra_kwargs = {
            "url": {"view_name": "api:user-detail", "lookup_field": "pk"},
        }

    def get_gender(self, obj: User) -> str:
        return obj.get_gender_display()


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="*")

    class Meta:
        model = Student
        fields = (
            "id",
            "age",
            "assigned_parent",
            "assigned_teacher",
            "user",
        )


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="*")

    class Meta:
        model = Teacher
        fields = (
            "id",
            "phone_number",
            "hire_date",
            "years_of_experience",
            "user",
        )


class ParentSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="*")

    class Meta:
        model = Parent
        fields = (
            "id",
            "phone_number",
            "user",
        )

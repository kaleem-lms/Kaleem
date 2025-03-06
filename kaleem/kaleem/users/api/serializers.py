from django.contrib.auth.password_validation import validate_password as vp
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
        request = self.context.get("request")
        if obj.profile_image and request:
            return request.build_absolute_uri(obj.profile_image.url)
        return ""


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

    def update(self, instance, validated_data):
        # Handle nested updates for profile
        profile_data = validated_data.pop("profile", None)

        # Update User fields
        instance.name = validated_data.get("name", instance.name)
        instance.email = validated_data.get("email", instance.email)
        instance.save()

        # Update or create the user's profile
        if profile_data:
            profile, created = UserProfile.objects.update_or_create(
                user=instance,
                defaults={
                    "bio": profile_data.get("bio", instance.profile.bio),
                    "profile_image": profile_data.get(
                        "profile_image", instance.profile.profile_image
                    ),
                },
            )
            profile.save()

        return instance


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "password",
            "name",
            "gender",
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


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="*")
    hire_date = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Teacher
        fields = (
            "id",
            "phone_number",
            "hire_date",
            "years_of_experience",
            "user",
        )


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(source="*")
    assigned_parent = ParentSerializer()
    assigned_teacher = TeacherSerializer()

    class Meta:
        model = Student
        fields = (
            "id",
            "age",
            "assigned_parent",
            "assigned_teacher",
            "user",
        )


class StudentRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Student
        fields = (
            "id",
            "age",
            "email",
            "password",
            "name",
            "gender",
        )

    def validate_password(self, value):
        vp(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        student = Student(**validated_data)
        student.set_password(password)
        student.save()
        return student


class TeacherRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Teacher
        fields = (
            "id",
            "phone_number",
            "email",
            "password",
            "name",
            "gender",
            "years_of_experience",
            "zoom_email",
        )

    def validate_password(self, value):
        vp(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        teacher = Teacher(**validated_data)
        teacher.set_password(password)
        teacher.save()
        return teacher


class ParentRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Parent
        fields = (
            "id",
            "phone_number",
            "email",
            "password",
            "name",
            "gender",
        )

    def validate_password(self, value):
        vp(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        parent = Parent(**validated_data)
        parent.set_password(password)
        parent.save()
        return parent

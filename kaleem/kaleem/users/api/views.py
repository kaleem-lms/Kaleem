from django.contrib.auth import login
from django.contrib.auth import logout
from django.core.exceptions import ValidationError
from drf_spectacular.utils import OpenApiResponse
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from kaleem.users.choices import Role
from kaleem.users.models import Parent
from kaleem.users.models import Student
from kaleem.users.models import Teacher
from kaleem.users.models import User
from kaleem.users.services import AuthenticationService

from .serializers import EditProfileSerializer
from .serializers import LoginSerializer
from .serializers import ParentProfileSerializer
from .serializers import ParentRegisterSerializer
from .serializers import StudentProfileSerializer
from .serializers import StudentRegisterSerializer
from .serializers import StudentSerializer
from .serializers import TeacherProfileSerializer
from .serializers import TeacherRegisterSerializer
from .serializers import UserSerializer


class UserViewSet(viewsets.ViewSet):
    """
    A viewset for viewing all users and editing the current user.
    """

    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.all()

    @extend_schema(
        summary="List all users",
        description="Retrieve a list of all users in the system.",
        responses={200: UserSerializer(many=True)},
    )
    def list(self, request):
        users = self.queryset.all()
        serializer = UserSerializer(users, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user, context={"request": request})
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

    @extend_schema(
        summary="Edit the current user",
        description="Update the authenticated user's profile information.",
        request=EditProfileSerializer,
        responses={
            200: EditProfileSerializer,
            403: OpenApiResponse(description="Forbidden"),
        },
    )
    @action(detail=False, methods=["put"])
    def edit(self, request):
        user = request.user

        serializer = EditProfileSerializer(
            user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get current user profile",
        description="Returns profile details based on the authenticated user's role.",
        responses={
            200: OpenApiResponse(description="Profile data returned successfully."),
            403: OpenApiResponse(description="User role not recognized."),
        },
    )
    @action(detail=False, methods=["get"])
    def profile(self, request):
        user = request.user
        role = user.role

        if role == Role.Student:
            student = Student.objects.get(id=user.id)
            serializer = StudentProfileSerializer(student, context={"request": request})
        elif role == Role.Teacher:
            teacher = Teacher.objects.get(id=user.id)
            serializer = TeacherProfileSerializer(teacher, context={"request": request})
        elif role == Role.Parent:
            parent = Parent.objects.get(id=user.id)
            serializer = ParentProfileSerializer(parent, context={"request": request})
        else:
            return Response(
                {"detail": "Unknown user role."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(serializer.data)


class AuthenticationViewSet(viewsets.ViewSet):
    queryset = Student.objects.all()
    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: UserSerializer,
            401: OpenApiResponse(
                description="Invalid credentials",
                examples=[
                    {"error": "Invalid credentials"},
                ],
            ),
            400: OpenApiResponse(
                description="Invalid request",
                examples=[
                    {"error": "Invalid request"},
                ],
            ),
        },
    )
    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            password = serializer.validated_data["password"]
            try:
                user = AuthenticationService.authenticate_user(
                    email=email,
                    password=password,
                )
                login(request, user)
                user_data = UserSerializer(user, context={"request": request}).data
                return Response(user_data, status=status.HTTP_200_OK)
            except ValidationError as e:
                return Response({"error": e}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        request=StudentRegisterSerializer,
        responses={
            201: UserSerializer,
            400: OpenApiResponse(
                description="Invalid request",
                examples=[{"error": "Invalid request"}],
            ),
        },
    )
    @action(detail=False, methods=["post"], url_path="register/students")
    def student_register(self, request):
        try:
            student = AuthenticationService.register_student(request.data)
            user_data = UserSerializer(student, context={"request": request}).data
            return Response(user_data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(dict(e), status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        request=TeacherRegisterSerializer,
        responses={
            201: UserSerializer,
            400: OpenApiResponse(
                description="Invalid request",
                examples=[{"error": "Invalid request"}],
            ),
        },
    )
    @action(detail=False, methods=["post"], url_path="register/teachers")
    def teacher_register(self, request):
        try:
            teacher = AuthenticationService.register_teacher(request.data)
            login(request, teacher, backend="django.contrib.auth.backends.ModelBackend")
            user_data = UserSerializer(teacher, context={"request": request}).data
            return Response(user_data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(dict(e), status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        request=ParentRegisterSerializer,
        responses={
            201: UserSerializer,
            400: OpenApiResponse(
                description="Invalid request",
                examples=[{"error": "Invalid request"}],
            ),
        },
    )
    @action(detail=False, methods=["post"], url_path="register/parents")
    def parent_register(self, request):
        try:
            parent = AuthenticationService.register_parent(request.data)
            user_data = UserSerializer(parent, context={"request": request}).data
            return Response(user_data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(dict(e), status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="logout")
    def logout_user(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeachersViewSet(viewsets.ViewSet):
    """
    ViewSet for teacher-related actions.
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def students(self, request):
        """Return students assigned to the authenticated teacher."""
        teacher = request.user

        students = Student.objects.filter(assigned_teacher=teacher)
        serializer = StudentSerializer(
            students,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

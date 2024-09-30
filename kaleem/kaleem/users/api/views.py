from django.contrib.auth import authenticate
from django.contrib.auth import login
from drf_spectacular.utils import OpenApiResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from kaleem.users.models import Student
from kaleem.users.models import User

from .serializers import LoginSerializer
from .serializers import UserSerializer


class UserViewSet(RetrieveModelMixin, ListModelMixin, UpdateModelMixin, GenericViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    lookup_field = "pk"

    def get_queryset(self, *args, **kwargs):
        assert isinstance(self.request.user.id, int)
        return self.queryset.filter(id=self.request.user.id)

    @action(detail=False)
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(status=status.HTTP_200_OK, data=serializer.data)


class AuthenticationViewSet(viewsets.ViewSet):
    queryset = Student.objects.all()

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
            user = authenticate(request, email=email, password=password)
            if user is not None:
                login(request, user)
                user_data = UserSerializer(user, context={"request": request}).data
                return Response(user_data, status=status.HTTP_200_OK)
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

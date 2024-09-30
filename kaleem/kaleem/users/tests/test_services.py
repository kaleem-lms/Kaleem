import pytest
from django.core.exceptions import ValidationError
from django.test import TestCase
from faker import Faker

from kaleem.users.models import User
from kaleem.users.services import AuthenticationService

fake = Faker()


class AuthenticationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=fake.unique.email(),
            password="authpassword",  # noqa: S106
        )

    def test_authenticate_user_success(self):
        authenticated_user = AuthenticationService.authenticate_user(
            email=self.user.email,
            password="authpassword",  # noqa: S106
        )
        assert authenticated_user == self.user

    def test_authenticate_user_failure(self):
        with pytest.raises(ValidationError):
            AuthenticationService.authenticate_user(
                email=self.user.email,
                password="wrongpassword",  # noqa: S106
            )

    def test_register_student(self):
        student_data = {
            "email": fake.unique.email(),
            "password": "studentpassword",
            "age": fake.random_int(min=5, max=18),
            "assigned_parent": None,  # Adjust as needed
        }
        student = AuthenticationService.register_student(student_data)
        assert student is not None
        assert student.email == student_data["email"]

    def test_register_teacher(self):
        teacher_data = {
            "email": fake.unique.email(),
            "password": "teacherpassword",
            "phone_number": fake.phone_number(),
            "hire_date": None,
        }
        teacher = AuthenticationService.register_teacher(teacher_data)
        assert teacher is not None
        assert teacher.email == teacher_data["email"]

    def test_register_parent(self):
        parent_data = {
            "email": fake.unique.email(),
            "password": "parentpassword",
            "phone_number": fake.phone_number(),
        }
        parent = AuthenticationService.register_parent(parent_data)
        assert parent is not None
        assert parent.email == parent_data["email"]

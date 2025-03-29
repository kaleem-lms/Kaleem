from django.test import TestCase
from faker import Faker

from kaleem.users.models import Parent
from kaleem.users.models import Student
from kaleem.users.models import Teacher
from kaleem.users.models import UserProfile

fake = Faker()


class SignalTests(TestCase):
    def test_user_profile_creation_on_student_save(self):
        student = Student.objects.create(
            email=fake.unique.email(),
            password="studentpassword",  # noqa: S106
            age=fake.random_int(min=5, max=18),
        )
        profile = UserProfile.objects.get(user=student)
        assert profile is not None

    def test_user_profile_creation_on_teacher_save(self):
        teacher = Teacher.objects.create(
            email=fake.unique.email(),
            password="teacherpassword",  # noqa: S106
        )
        profile = UserProfile.objects.get(user=teacher)
        assert profile is not None

    def test_user_profile_creation_on_parent_save(self):
        parent = Parent.objects.create(
            email=fake.unique.email(),
            password="parentpassword",  # noqa: S106
        )
        profile = UserProfile.objects.get(user=parent)
        assert profile is not None

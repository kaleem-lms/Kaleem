import pytest
from django.db.utils import IntegrityError
from django.test import TestCase
from faker import Faker

from kaleem.users.models import Family
from kaleem.users.models import FamilyMember
from kaleem.users.models import Parent
from kaleem.users.models import Student
from kaleem.users.models import Teacher
from kaleem.users.models import User
from kaleem.users.models import UserProfile

fake = Faker()


class UserModelTests(TestCase):
    def setUp(self):
        self.email = fake.unique.email()
        self.password = "testpassword"  # noqa: S105
        self.user = User.objects.create_user(email=self.email, password=self.password)

    def test_user_creation(self):
        assert self.user.email == self.email
        assert self.user.check_password(self.password)

    def test_user_role_default(self):
        assert self.user.role == "U"  # Assuming default role is Unknown


class StudentModelTests(TestCase):
    def setUp(self):
        self.parent = Parent.objects.create(
            email=fake.unique.email(),
            password="parentpassword",  # noqa: S106
        )
        self.student_data = {
            "email": fake.unique.email(),
            "password": "studentpassword",
            "age": fake.random_int(min=5, max=18),
            "assigned_parent": self.parent,
        }

    def test_student_creation(self):
        student = Student.objects.create(**self.student_data)
        assert student.assigned_parent == self.parent
        assert student.age == self.student_data["age"]

    def test_student_role(self):
        student = Student.objects.create(**self.student_data)
        assert student.role == "S"  # Role should be Student


class TeacherModelTests(TestCase):
    def setUp(self):
        self.teacher_data = {
            "email": fake.unique.email(),
            "password": "teacherpassword",
            "phone_number": fake.phone_number(),
            "hire_date": None,
        }

    def test_teacher_creation(self):
        teacher = Teacher.objects.create(**self.teacher_data)
        assert teacher.email == self.teacher_data["email"]

    def test_teacher_role(self):
        teacher = Teacher.objects.create(**self.teacher_data)
        assert teacher.role == "T"


class ParentModelTests(TestCase):
    def setUp(self):
        self.parent_data = {
            "email": fake.unique.email(),
            "password": "parentpassword",
            "phone_number": fake.phone_number(),
        }

    def test_parent_creation(self):
        parent = Parent.objects.create(**self.parent_data)
        assert parent.email == self.parent_data["email"]

    def test_parent_role(self):
        parent = Parent.objects.create(**self.parent_data)
        assert parent.role == "P"  # Role should be Parent


class FamilyModelTests(TestCase):
    def setUp(self):
        self.parent = Parent.objects.create(
            email=fake.unique.email(),
            password="parentpassword",  # noqa: S106
        )
        self.family_data = {
            "name": fake.name(),
            "guardian": self.parent,
        }

    def test_family_creation(self):
        family = Family.objects.create(**self.family_data)
        assert family.name == self.family_data["name"]
        assert family.guardian == self.parent


class FamilyMemberModelTests(TestCase):
    def setUp(self):
        self.parent = Parent.objects.create(
            email=fake.unique.email(),
            password="parentpassword",  # noqa: S106
        )
        self.student = Student.objects.create(
            email=fake.unique.email(),
            password="studentpassword",  # noqa: S106
            assigned_parent=self.parent,
            age=fake.random_int(min=5, max=18),
        )
        self.family = Family.objects.create(name=fake.name(), guardian=self.parent)

    def test_family_member_creation(self):
        family_member = FamilyMember.objects.create(
            user=self.student,
            family=self.family,
        )
        assert family_member.user == self.student
        assert family_member.family == self.family

    def test_unique_family_member(self):
        FamilyMember.objects.create(user=self.student, family=self.family)
        with pytest.raises(IntegrityError):
            FamilyMember.objects.create(
                user=self.student,
                family=self.family,
            )  # Should raise error due to uniqueness constraint


class UserProfileModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=fake.unique.email(),
            password="testpassword",  # noqa: S106
        )
        self.profile_data = {
            "user": self.user,
            "bio": fake.text(),
            "profile_image": None,
        }

    def test_user_profile_creation(self):
        profile = UserProfile.objects.create(**self.profile_data)
        assert profile.user == self.user
        assert profile.bio == self.profile_data["bio"]

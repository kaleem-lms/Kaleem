from rest_framework import serializers

from kaleem.resources.models import AssignedResource
from kaleem.resources.models import Resource
from kaleem.resources.models import ResourceCategory
from kaleem.users.models import Student


class ResourceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceCategory
        fields = [
            "id",
            "name",
            "description",
        ]

    def get_resources(self, obj):
        # Optionally include resources here (for teacher or student)
        resources = obj.resources.all()
        return ResourceSerializer(resources, many=True, context=self.context).data


class ResourceSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    category = serializers.CharField(source="category.name")
    students_assigned = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = "__all__"
        extra_kwargs = {
            "file": {"write_only": True},
        }

    def get_file(self, obj):
        request = self.context.get("request")
        if obj.file:
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_students_assigned(self, obj):
        request = self.context.get("request")
        teacher = request.user if request else None
        if not teacher:
            return []

        assigned_qs = AssignedResource.objects.filter(
            resource=obj,
            teacher=teacher,
        ).select_related("student")
        return [
            {
                "id": ar.student.id,
                "name": ar.student.name,
                "enrolled_at": Student.objects.get(pk=ar.student.id).enrolled_at,
                "email": ar.student.email,
            }
            for ar in assigned_qs
        ]


class AssignedResourceSerializer(serializers.ModelSerializer):
    resource = ResourceSerializer(read_only=True)
    teacher = serializers.StringRelatedField()
    student = serializers.StringRelatedField()

    class Meta:
        model = AssignedResource
        fields = [
            "id",
            "teacher",
            "student",
            "resource",
            "assigned_at",
        ]


class AssignResourceInputSerializer(serializers.Serializer):
    resource_id = serializers.IntegerField()
    student_ids = serializers.ListField(child=serializers.IntegerField())

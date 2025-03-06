from rest_framework import serializers

from kaleem.resources.models import AssignedResource
from kaleem.resources.models import Resource
from kaleem.resources.models import ResourceCategory


class ResourceCategorySerializer(serializers.ModelSerializer):
    resources = serializers.SerializerMethodField()

    class Meta:
        model = ResourceCategory
        fields = [
            "id",
            "name",
            "description",
            "resources",
        ]

    def get_resources(self, obj):
        # Optionally include resources here (for teacher or student)
        resources = obj.resources.all()
        return ResourceSerializer(resources, many=True, context=self.context).data


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = [
            "id",
            "title",
            "description",
            "category",
            "resource_type",
            "file",
            "video_url",
            "created_at",
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

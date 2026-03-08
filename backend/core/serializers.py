from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    OwnerApplication,
    Restaurant,
    RestaurantPhoto,
    Role,
    Evidence,
    RubricCategory,
    RubricSubCategory,
    Score,
    Audit,
    AuditEvidence,
    AuditScore,
)

User = get_user_model()

# Roles that super admin can assign (cannot create another SUPER_ADMIN via API)
ASSIGNABLE_ROLES = [Role.USER, Role.OWNER, Role.AUDITOR, Role.ADMIN]


class UserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'phone', 'role', 'profile_picture_url', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'role', 'profile_picture_url', 'is_active', 'created_at', 'updated_at')

    def get_profile_picture_url(self, obj):
        try:
            if obj.profile_picture_url:
                return obj.profile_picture_url
            if obj.profile_picture:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.profile_picture.url)
                return obj.profile_picture.url
        except (ValueError, OSError, AttributeError):
            pass
        return None


# Used by MeView for PATCH: role-based allowed fields (owner/user = all; admin/auditor/super_admin = phone + profile_picture only)
class ProfileUpdateSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = ('name', 'email', 'phone', 'profile_picture')

    def update(self, instance, validated_data):
        from django.conf import settings
        from core.utils.storage import upload_to_supabase

        request = self.context.get('request')
        if request and request.user and request.user.role in (Role.ADMIN, Role.AUDITOR, Role.SUPER_ADMIN):
            allowed_keys = ('phone', 'profile_picture')
        else:
            allowed_keys = ('name', 'email', 'phone', 'profile_picture')

        profile_file = validated_data.pop('profile_picture', None)
        if profile_file is not None:
            supabase_url = getattr(settings, 'SUPABASE_URL', None)
            supabase_key = getattr(settings, 'SUPABASE_SERVICE_KEY', None)
            if supabase_url and supabase_key:
                try:
                    public_url, _ = upload_to_supabase(profile_file, 'profiles')
                    instance.profile_picture_url = public_url
                    instance.profile_picture = None
                except Exception:
                    try:
                        profile_file.seek(0)
                        instance.profile_picture = profile_file
                        instance.profile_picture_url = None
                    except Exception:
                        instance.profile_picture_url = None
            else:
                try:
                    instance.profile_picture = profile_file
                    instance.profile_picture_url = None
                except Exception:
                    instance.profile_picture_url = None

        for attr, value in validated_data.items():
            if attr in allowed_keys:
                setattr(instance, attr, value)
        try:
            instance.save()
        except Exception as e:
            if profile_file is not None:
                raise serializers.ValidationError({
                    'profile_picture': ['Failed to save image. Try a smaller or different format (e.g. JPEG, PNG).']
                }) from e
            raise
        return instance


class SuperAdminUserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at')


class SuperAdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('name', 'email', 'phone', 'password', 'role')

    def validate_role(self, value):
        if value not in ASSIGNABLE_ROLES:
            raise serializers.ValidationError('Invalid role for creation.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            phone=validated_data.get('phone', ''),
            password=validated_data['password'],
            role=validated_data['role'],
        )


class SuperAdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('name', 'email', 'phone', 'role', 'is_active')

    def validate_role(self, value):
        if value not in ASSIGNABLE_ROLES:
            raise serializers.ValidationError('Invalid role.')
        return value


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('name', 'email', 'phone', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            phone=validated_data.get('phone', ''),
            password=validated_data['password'],
        )
        return user


class OwnerApplicationSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    proof_document_url = serializers.URLField(required=False, allow_blank=True)
    business_card_url = serializers.URLField(required=False, allow_blank=True)
    owner_photo_url = serializers.URLField(required=False, allow_blank=True)
    utility_bill_url = serializers.URLField(required=False, allow_blank=True)
    storefront_photo_url = serializers.URLField(required=False, allow_blank=True)
    dining_photo_url = serializers.URLField(required=False, allow_blank=True)
    google_maps_link = serializers.URLField(allow_blank=False)

    class Meta:
        model = OwnerApplication
        fields = (
            'id', 'user', 'user_email', 'user_name',
            'restaurant_name', 'business_address', 'city', 'google_maps_link', 'landmark',
            'contact_person_name', 'contact_phone', 'alternate_phone', 'operating_hours',
            'proof_document_url', 'business_card_url', 'owner_photo_url', 'utility_bill_url',
            'storefront_photo_url', 'dining_photo_url',
            'declaration_accepted',
            'status', 'review_notes', 'reviewed_by', 'reviewed_at', 'submitted_at',
        )
        read_only_fields = ('id', 'user', 'status', 'review_notes', 'reviewed_by', 'reviewed_at', 'submitted_at')

    def validate(self, data):
        if not data.get('declaration_accepted'):
            raise serializers.ValidationError({'declaration_accepted': 'You must accept the declaration.'})
        proof_fields = [
            data.get('proof_document_url'),
            data.get('business_card_url'),
            data.get('owner_photo_url'),
            data.get('utility_bill_url'),
        ]
        if not any(proof_fields):
            raise serializers.ValidationError(
                'At least one proof document is required (proof document, business card, owner photo, or utility bill).'
            )
        if not data.get('google_maps_link'):
            raise serializers.ValidationError({'google_maps_link': 'Google Maps link is required.'})
        return data

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class OwnerApplicationListSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = OwnerApplication
        fields = (
            'id', 'user', 'user_email', 'user_name', 'restaurant_name', 'city',
            'status', 'submitted_at', 'reviewed_at',
        )


class AdminApproveRejectSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True)


class RestaurantPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantPhoto
        fields = ('id', 'restaurant', 'image_url', 'caption', 'order')
        read_only_fields = ('id', 'restaurant')


class RestaurantSerializer(serializers.ModelSerializer):
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, allow_null=True, required=False
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, allow_null=True, required=False
    )
    operating_hours = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    google_maps_link = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = Restaurant
        fields = (
            'id', 'owner', 'name', 'address', 'city', 'google_maps_link',
            'latitude', 'longitude', 'operating_hours', 'phone', 'status', 'created_at', 'photos'
        )
        read_only_fields = ('id', 'owner', 'status', 'created_at')

    photos = RestaurantPhotoSerializer(many=True, read_only=True)

    def to_internal_value(self, data):
        """Normalize empty strings for decimals to None; preserve URL when blank on partial."""
        data = dict(data) if data is not None else {}
        for key in ('latitude', 'longitude'):
            if key in data and data[key] is not None:
                s = str(data[key]).strip()
                if s == '' or s.lower() == 'null':
                    data[key] = None
                else:
                    try:
                        data[key] = str(float(s))
                    except (TypeError, ValueError):
                        pass
        if self.partial and (data.get('google_maps_link') or '').strip() == '' and self.instance:
            data['google_maps_link'] = (self.instance.google_maps_link or '') or ''
        return super().to_internal_value(data)


class RestaurantPublicSerializer(serializers.ModelSerializer):
    """Public list/detail for browse; no owner; includes score for carousel/cards."""
    photos = RestaurantPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Restaurant
        fields = (
            'id', 'name', 'address', 'city', 'google_maps_link',
            'latitude', 'longitude', 'operating_hours', 'phone', 'photos',
            'credibility_score', 'last_audit_at',
        )


# --- Evidence & Rubric (Phase 1.2) ---


class RubricSubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricSubCategory
        fields = ('id', 'name', 'max_score', 'description', 'display_order')


class RubricCategorySerializer(serializers.ModelSerializer):
    subcategories = RubricSubCategorySerializer(many=True, read_only=True)

    class Meta:
        model = RubricCategory
        fields = ('id', 'name', 'weight', 'description', 'is_active', 'display_order', 'subcategories')


class EvidenceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = Evidence
        fields = (
            'id', 'restaurant', 'restaurant_name', 'uploaded_by', 'category', 'category_name',
            'file_url', 'file_type', 'original_filename', 'file_size_bytes', 'mime_type',
            'description', 'status', 'reviewed_by', 'review_notes',
            'upload_timestamp', 'reviewed_timestamp',
            'is_cryptographically_verified',
            'hash_value', 'previous_hash', 'chain_index', 'file_content_hash', 'is_chain_valid',
        )
        read_only_fields = (
            'id', 'restaurant', 'uploaded_by', 'file_url', 'file_type',
            'original_filename', 'file_size_bytes', 'mime_type', 'status',
            'reviewed_by', 'review_notes', 'upload_timestamp', 'reviewed_timestamp',
        )


class EvidenceUploadSerializer(serializers.Serializer):
    """Validation for evidence upload (category_id, description); files validated in view."""
    category_id = serializers.IntegerField()
    description = serializers.CharField(min_length=20)


class EvidenceReviewSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True)


class ScoreSubmitSubcategorySerializer(serializers.Serializer):
    subcategory_id = serializers.IntegerField()
    score = serializers.IntegerField(min_value=0, max_value=5)
    notes = serializers.CharField(required=False, allow_blank=True)


class ScoreSubmitSerializer(serializers.Serializer):
    restaurant_id = serializers.IntegerField()
    category_id = serializers.IntegerField()
    is_category_applicable = serializers.BooleanField(default=True)
    subcategories = ScoreSubmitSubcategorySerializer(many=True)


# --- Auditor-led audit serializers ---


class AuditSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)

    class Meta:
        model = Audit
        fields = (
            'id',
            'restaurant',
            'restaurant_name',
            'requested_by',
            'requested_by_name',
            'assigned_to',
            'assigned_to_name',
            'status',
            'requested_at',
            'assigned_at',
            'started_at',
            'submitted_at',
            'reviewed_at',
            'review_notes',
        )
        read_only_fields = (
            'id',
            'restaurant',
            'requested_by',
            'requested_by_name',
            'assigned_at',
            'started_at',
            'submitted_at',
            'reviewed_at',
        )


class AuditListSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)

    class Meta:
        model = Audit
        fields = (
            'id',
            'restaurant',
            'restaurant_name',
            'assigned_to',
            'assigned_to_name',
            'status',
            'requested_at',
            'submitted_at',
        )


class AuditEvidenceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = AuditEvidence
        fields = (
            'id',
            'audit',
            'restaurant',
            'category',
            'category_name',
            'file_url',
            'file_type',
            'original_filename',
            'file_size_bytes',
            'mime_type',
            'description',
            'upload_timestamp',
            'is_cryptographically_verified',
        )
        read_only_fields = (
            'id',
            'audit',
            'restaurant',
            'file_url',
            'file_type',
            'original_filename',
            'file_size_bytes',
            'mime_type',
            'upload_timestamp',
            'is_cryptographically_verified',
        )


class AuditEvidenceUploadSerializer(serializers.Serializer):
    """Validation for auditor evidence upload (category_id, description); files validated in view."""
    category_id = serializers.IntegerField()
    description = serializers.CharField(required=False, allow_blank=True)


class AuditScoreSubSerializer(serializers.Serializer):
    subcategory_id = serializers.IntegerField()
    score = serializers.IntegerField(min_value=0, max_value=5)
    notes = serializers.CharField(required=False, allow_blank=True)


class AuditScoreSubmitSerializer(serializers.Serializer):
    audit_id = serializers.IntegerField()
    category_id = serializers.IntegerField()
    subcategories = AuditScoreSubSerializer(many=True)

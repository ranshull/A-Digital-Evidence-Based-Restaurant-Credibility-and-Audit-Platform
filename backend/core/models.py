from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import URLValidator


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'SUPER_ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class Role(models.TextChoices):
    USER = 'USER', 'User'
    OWNER = 'OWNER', 'Owner'
    AUDITOR = 'AUDITOR', 'Auditor'
    ADMIN = 'ADMIN', 'Admin'
    SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'


class User(AbstractUser):
    """Custom user with email as unique identifier and role."""
    username = None
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email


class ApplicationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class OwnerApplication(models.Model):
    """Stores requests for owner access. Preserved for audit; never deleted."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owner_applications')

    # Business Information
    restaurant_name = models.CharField(max_length=255)
    business_address = models.TextField()
    city = models.CharField(max_length=100)
    google_maps_link = models.URLField(max_length=500, validators=[URLValidator()])
    landmark = models.CharField(max_length=255, blank=True)

    # Operational Contact
    contact_person_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=20)
    alternate_phone = models.CharField(max_length=20, blank=True)
    operating_hours = models.CharField(max_length=255, blank=True)

    # Proof of Association (at least one required)
    proof_document_url = models.URLField(max_length=500, blank=True)
    business_card_url = models.URLField(max_length=500, blank=True)
    owner_photo_url = models.URLField(max_length=500, blank=True)
    utility_bill_url = models.URLField(max_length=500, blank=True)

    # Restaurant Photos (optional)
    storefront_photo_url = models.URLField(max_length=500, blank=True)
    dining_photo_url = models.URLField(max_length=500, blank=True)

    # Consent
    declaration_accepted = models.BooleanField(default=False)

    # Workflow
    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.PENDING
    )
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_applications'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'owner_applications'
        ordering = ['-submitted_at']

    def __str__(self):
        return f'{self.restaurant_name} ({self.status})'

    def has_at_least_one_proof(self):
        return bool(
            self.proof_document_url or
            self.business_card_url or
            self.owner_photo_url or
            self.utility_bill_url
        )


class RestaurantStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class Restaurant(models.Model):
    """Created only after owner application is approved."""
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='restaurant')
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.CharField(max_length=100)
    google_maps_link = models.URLField(max_length=500, validators=[URLValidator()])
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    operating_hours = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(
        max_length=20,
        choices=RestaurantStatus.choices,
        default=RestaurantStatus.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Cached credibility scoring (Phase 1.2)
    credibility_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Overall 0-100 score'
    )
    last_audit_at = models.DateTimeField(null=True, blank=True)
    score_breakdown = models.JSONField(null=True, blank=True)
    # Work assignment: only assigned user (or unassigned) sees in pending work
    review_assigned_to = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_review_restaurants',
    )
    review_assigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'restaurants'

    def __str__(self):
        return self.name


class RubricCategory(models.Model):
    """Evidence/scoring category with weight, e.g. Kitchen Hygiene 30%."""
    name = models.CharField(max_length=255)
    weight = models.DecimalField(max_digits=5, decimal_places=2)  # e.g. 0.30
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'rubric_categories'
        ordering = ['display_order', 'id']

    def __str__(self):
        return self.name


class RubricSubCategory(models.Model):
    """Subcategory within a rubric category, scored 0 to max_score."""
    category = models.ForeignKey(
        RubricCategory, on_delete=models.CASCADE, related_name='subcategories'
    )
    name = models.CharField(max_length=255)
    max_score = models.PositiveIntegerField(default=5)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'rubric_subcategories'
        ordering = ['display_order', 'id']

    def __str__(self):
        return f'{self.category.name} / {self.name}'


class EvidenceStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    FLAGGED = 'FLAGGED', 'Flagged'


class EvidenceFileType(models.TextChoices):
    IMAGE = 'IMAGE', 'Image'
    VIDEO = 'VIDEO', 'Video'


class Evidence(models.Model):
    """Owner-uploaded evidence (images/videos) for a rubric category."""
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='evidence'
    )
    uploaded_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='uploaded_evidence'
    )
    category = models.ForeignKey(
        RubricCategory, on_delete=models.CASCADE, related_name='evidence'
    )
    file_url = models.URLField(max_length=500)
    file_type = models.CharField(
        max_length=10, choices=EvidenceFileType.choices
    )
    original_filename = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=EvidenceStatus.choices,
        default=EvidenceStatus.PENDING
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_evidence'
    )
    review_notes = models.TextField(blank=True)
    upload_timestamp = models.DateTimeField(auto_now_add=True)
    reviewed_timestamp = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'evidence'
        ordering = ['-upload_timestamp']

    def __str__(self):
        return f'{self.restaurant.name} - {self.category.name} ({self.status})'


class Score(models.Model):
    """Stores subcategory score for a restaurant (admin scoring)."""
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='scores'
    )
    category = models.ForeignKey(
        RubricCategory, on_delete=models.CASCADE, related_name='scores'
    )
    subcategory = models.ForeignKey(
        RubricSubCategory, on_delete=models.CASCADE, related_name='scores'
    )
    score = models.PositiveIntegerField()  # 0 to max_score
    scored_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='scores_given'
    )
    notes = models.TextField(blank=True)
    is_category_applicable = models.BooleanField(default=True)
    scored_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scores'
        ordering = ['category', 'subcategory']
        # One latest score per restaurant+subcategory (overwrite on resubmit)
        unique_together = [['restaurant', 'subcategory']]

    def __str__(self):
        return f'{self.restaurant.name} - {self.subcategory.name}: {self.score}'


class RestaurantPhoto(models.Model):
    """Photos for a restaurant: carousel, menu, kitchen, dining, etc. Caption = Storefront, Dining, Kitchen, Menu, Other."""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='photos')
    image_url = models.URLField(max_length=500)
    caption = models.CharField(max_length=100, blank=True)  # e.g. Storefront, Dining, Kitchen, Menu
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'restaurant_photos'
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.restaurant.name} - {self.caption or "Photo"}'


class AuditStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Requested'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    IN_PROGRESS = 'IN_PROGRESS', 'In progress'
    SUBMITTED_BY_AUDITOR = 'SUBMITTED_BY_AUDITOR', 'Submitted by auditor'
    REVIEWED_BY_ADMIN = 'REVIEWED_BY_ADMIN', 'Reviewed by admin'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Audit(models.Model):
    """On-site audit requested by owner or super admin and performed by an auditor."""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='audits')
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_audits',
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_audits',
    )
    status = models.CharField(
        max_length=40,
        choices=AuditStatus.choices,
        default=AuditStatus.REQUESTED,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'audits'
        ordering = ['-requested_at']

    def __str__(self):
        return f'Audit #{self.id} - {self.restaurant.name} ({self.status})'


class AuditEvidence(models.Model):
    """Evidence captured by an auditor during an audit."""
    audit = models.ForeignKey(Audit, on_delete=models.CASCADE, related_name='evidence')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='audit_evidence')
    category = models.ForeignKey(
        RubricCategory,
        on_delete=models.CASCADE,
        related_name='audit_evidence',
    )
    file_url = models.URLField(max_length=500)
    file_type = models.CharField(max_length=10, choices=EvidenceFileType.choices)
    original_filename = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    upload_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_evidence'
        ordering = ['-upload_timestamp']

    def __str__(self):
        return f'Audit #{self.audit_id} - {self.restaurant.name} - {self.category.name}'


class AuditScore(models.Model):
    """Scores given by auditor during an audit (per subcategory)."""
    audit = models.ForeignKey(Audit, on_delete=models.CASCADE, related_name='scores')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='audit_scores')
    category = models.ForeignKey(
        RubricCategory, on_delete=models.CASCADE, related_name='audit_scores'
    )
    subcategory = models.ForeignKey(
        RubricSubCategory, on_delete=models.CASCADE, related_name='audit_scores'
    )
    score = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    scored_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='audit_scores_given'
    )
    scored_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_scores'
        ordering = ['category', 'subcategory']
        unique_together = [['audit', 'subcategory']]

    def __str__(self):
        return f'Audit #{self.audit_id} - {self.restaurant.name} - {self.subcategory.name}: {self.score}'

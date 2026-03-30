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
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    profile_picture_url = models.URLField(blank=True, null=True)  # Supabase public URL when used
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
    review_completed_at = models.DateTimeField(null=True, blank=True)
    review_completed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_review_restaurants',
    )

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

    # Phase 2: Cryptographic verification
    hash_value = models.CharField(max_length=64, blank=True, null=True)
    previous_hash = models.CharField(max_length=64, blank=True, null=True)
    chain_index = models.PositiveIntegerField(null=True, blank=True)
    nonce = models.CharField(max_length=64, blank=True, null=True)
    file_content_hash = models.CharField(max_length=64, blank=True, null=True)
    is_chain_valid = models.BooleanField(null=True, blank=True)
    is_cryptographically_verified = models.BooleanField(default=False)

    class Meta:
        db_table = 'evidence'
        ordering = ['-upload_timestamp']

    def __str__(self):
        return f'{self.restaurant.name} - {self.category.name} ({self.status})'


class HashChain(models.Model):
    """One hash chain per restaurant; links evidence in order."""
    restaurant = models.OneToOneField(
        Restaurant, on_delete=models.CASCADE, related_name='hash_chain'
    )
    genesis_hash = models.CharField(max_length=64)
    current_hash = models.CharField(max_length=64)
    chain_length = models.PositiveIntegerField(default=0)
    last_verified = models.DateTimeField(null=True, blank=True)
    is_valid = models.BooleanField(default=True)

    class Meta:
        db_table = 'hash_chain'

    def __str__(self):
        return f'HashChain {self.restaurant.name} (len={self.chain_length})'


class TamperDetection(models.Model):
    """Record of tamper checks for a piece of evidence."""
    evidence = models.ForeignKey(
        Evidence, on_delete=models.CASCADE, related_name='tamper_checks'
    )
    detection_timestamp = models.DateTimeField(auto_now_add=True)
    is_tampered = models.BooleanField(default=False)
    detection_method = models.CharField(max_length=50)
    confidence_score = models.FloatField(default=0.0)
    findings = models.JSONField(default=dict, blank=True)
    flagged_by = models.CharField(max_length=50, default='system')

    class Meta:
        db_table = 'tamper_detection'
        ordering = ['-detection_timestamp']

    def __str__(self):
        return f'TamperCheck Evidence #{self.evidence_id} ({self.detection_method})'


class EvidenceTimestamp(models.Model):
    """Trusted timestamp token for evidence (Phase 2)."""
    evidence = models.OneToOneField(
        Evidence, on_delete=models.CASCADE, related_name='timestamp_record'
    )
    timestamp_token = models.TextField()
    server_time = models.DateTimeField()
    client_time = models.DateTimeField(null=True, blank=True)
    time_authority_signature = models.TextField(blank=True, null=True)
    hash_at_timestamp = models.CharField(max_length=64)
    is_verified = models.BooleanField(default=False)

    class Meta:
        db_table = 'evidence_timestamp'

    def __str__(self):
        return f'Timestamp Evidence #{self.evidence_id}'


class MerkleTree(models.Model):
    """Merkle tree for a restaurant's evidence (audit trail)."""
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='merkle_trees'
    )
    root_hash = models.CharField(max_length=64)
    tree_depth = models.PositiveIntegerField(default=0)
    evidence_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_valid = models.BooleanField(default=True)

    class Meta:
        db_table = 'merkle_tree'
        ordering = ['-created_at']

    def __str__(self):
        return f'MerkleTree {self.restaurant.name} (root={self.root_hash[:16]}...)'


class MerkleNode(models.Model):
    """Node in a Merkle tree (leaf or internal)."""
    tree = models.ForeignKey(
        MerkleTree, on_delete=models.CASCADE, related_name='nodes'
    )
    node_hash = models.CharField(max_length=64)
    left_child = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='parent_left'
    )
    right_child = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='parent_right'
    )
    evidence = models.ForeignKey(
        Evidence, on_delete=models.CASCADE, null=True, blank=True,
        related_name='merkle_leaf_nodes'
    )
    level = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'merkle_node'

    def __str__(self):
        return f'Node {self.node_hash[:16]}... (L{self.level})'


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


class RestaurantPrivateFeedback(models.Model):
    """
    Logged-in visitors can send private text feedback to a restaurant.
    Not shown on the public listing; only the restaurant owner sees it in the owner dashboard.
    """

    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='private_feedback'
    )
    author = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='restaurant_private_feedback_sent'
    )
    message = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'restaurant_private_feedback'
        ordering = ['-created_at']

    def __str__(self):
        return f'Feedback to {self.restaurant.name} by {self.author_id}'


class AuditWorkStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In progress'
    DONE = 'DONE', 'Done'


class AuditSubmissionStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED_TO_ADMIN = 'SUBMITTED_TO_ADMIN', 'Submitted to admin'
    PUBLISHED = 'PUBLISHED', 'Published'
    FLAGGED = 'FLAGGED', 'Flagged'


class AuditorWorkItem(models.Model):
    """Owner-requested work item shown to admins/auditors."""
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='audit_work_items'
    )
    requested_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='requested_audit_work_items'
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_audit_work_items'
    )
    status = models.CharField(
        max_length=20, choices=AuditWorkStatus.choices, default=AuditWorkStatus.PENDING
    )
    submission_status = models.CharField(
        max_length=30,
        choices=AuditSubmissionStatus.choices,
        default=AuditSubmissionStatus.DRAFT,
    )
    category_photos_saved = models.JSONField(default=list, blank=True)
    category_marked_na = models.JSONField(default=list, blank=True)
    submitted_to_admin_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_work_items_published',
    )
    flagged_at = models.DateTimeField(null=True, blank=True)
    staging_edit_log = models.JSONField(
        default=list,
        blank=True,
        help_text='Admin edits to staging scores: list of {at, admin_name, reason, category_id}.',
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'auditor_work_items'
        ordering = ['-requested_at']

    def __str__(self):
        return f'{self.restaurant.name} ({self.status})'


class AuditWorkCategoryPhoto(models.Model):
    """Photos captured on-site by an auditor during a visit, grouped by rubric category."""
    work_item = models.ForeignKey(
        AuditorWorkItem, on_delete=models.CASCADE, related_name='category_photos'
    )
    category = models.ForeignKey(
        'RubricCategory', on_delete=models.CASCADE, related_name='audit_work_category_photos'
    )
    image_url = models.URLField(max_length=500)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='audit_work_category_photos'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'audit_work_category_photos'
        ordering = ['category_id', 'display_order', 'id']

    def __str__(self):
        return f'Audit photo {self.work_item_id} / cat {self.category_id}'


class AuditVisitScore(models.Model):
    """Staged on-site audit scores per work item; published to Score only after admin approval."""
    work_item = models.ForeignKey(
        AuditorWorkItem, on_delete=models.CASCADE, related_name='staging_scores'
    )
    category = models.ForeignKey(
        'RubricCategory', on_delete=models.CASCADE, related_name='audit_visit_scores'
    )
    subcategory = models.ForeignKey(
        'RubricSubCategory', on_delete=models.CASCADE, related_name='audit_visit_scores'
    )
    score = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    is_category_applicable = models.BooleanField(default=True)
    scored_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='audit_visit_scores_given'
    )
    scored_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'audit_visit_scores'
        ordering = ['category_id', 'subcategory_id']
        unique_together = [['work_item', 'subcategory']]

    def __str__(self):
        return f'AuditVisitScore w{self.work_item_id} sub{self.subcategory_id}'



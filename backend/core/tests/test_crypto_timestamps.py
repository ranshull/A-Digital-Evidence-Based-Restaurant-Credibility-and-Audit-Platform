"""Unit tests for timestamp crypto."""
from django.test import TestCase
from django.utils import timezone
from core.models import User, Restaurant, Evidence, EvidenceTimestamp, RubricCategory
from core.crypto.timestamps import create_timestamp_token, verify_timestamp_token, detect_backdating_attempt


class TestTimestampToken(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='u@t.com', password='x', name='U', role='OWNER')
        self.restaurant = Restaurant.objects.create(owner=self.user, name='R', address='A', city='C', google_maps_link='https://x.com')
        self.category = RubricCategory.objects.create(name='Cat', weight=0.5, display_order=0)
        self.evidence = Evidence.objects.create(
            restaurant=self.restaurant,
            uploaded_by=self.user,
            category=self.category,
            file_url='https://example.com/f',
            file_type='IMAGE',
            original_filename='f.jpg',
            file_size_bytes=100,
            mime_type='image/jpeg',
            description='x' * 20,
        )

    def test_create_and_verify(self):
        token = create_timestamp_token(self.evidence.id, 'abc' * 20)
        self.assertTrue(len(token) > 0)
        EvidenceTimestamp.objects.create(
            evidence=self.evidence,
            timestamp_token=token,
            server_time=timezone.now(),
            hash_at_timestamp='abc' * 20,
            is_verified=False,
        )
        result = verify_timestamp_token(self.evidence.id)
        self.assertTrue(result['signature_valid'])
        self.assertTrue(result['is_valid'])

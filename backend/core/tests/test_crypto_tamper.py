"""Unit tests for tamper detection (integrity / metadata)."""
from django.test import TestCase
from unittest.mock import patch
from core.models import User, Restaurant, Evidence, RubricCategory
from core.crypto.tamper import verify_file_integrity, detect_metadata_tampering


class TestVerifyFileIntegrity(TestCase):
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
            file_size_bytes=3,
            mime_type='image/jpeg',
            description='x' * 20,
            file_content_hash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',  # SHA256 of b''
        )

    @patch('core.crypto.tamper._fetch_file_content')
    def test_intact_when_hash_matches(self, mock_fetch):
        import hashlib
        content = b'abc'
        mock_fetch.return_value = content
        self.evidence.file_content_hash = hashlib.sha256(content).hexdigest()
        self.evidence.save()
        result = verify_file_integrity(self.evidence.id)
        self.assertTrue(result['is_intact'])
        self.assertFalse(result['tampered'])

    @patch('core.crypto.tamper._fetch_file_content')
    def test_tampered_when_hash_mismatch(self, mock_fetch):
        mock_fetch.return_value = b'different'
        result = verify_file_integrity(self.evidence.id)
        self.assertFalse(result['is_intact'])
        self.assertTrue(result['tampered'])

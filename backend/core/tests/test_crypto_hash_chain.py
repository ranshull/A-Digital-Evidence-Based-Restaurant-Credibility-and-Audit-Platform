"""Unit tests for hash chain crypto."""
from django.test import TestCase
from core.models import User, Restaurant, HashChain, RubricCategory
from core.crypto.hash_chain import (
    generate_evidence_hash,
    create_genesis_hash,
    add_evidence_to_chain,
    verify_hash_chain,
    update_chain_after_append,
)


class TestGenerateEvidenceHash(TestCase):
    def test_deterministic(self):
        content = b'hello'
        prev = 'a' * 64
        meta = {'t': 1, 'x': 2}
        nonce = 'n' * 64
        h1 = generate_evidence_hash(content, prev, meta, nonce)
        h2 = generate_evidence_hash(content, prev, meta, nonce)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_different_input_different_hash(self):
        h1 = generate_evidence_hash(b'a', 'p' * 64, {}, 'n' * 64)
        h2 = generate_evidence_hash(b'b', 'p' * 64, {}, 'n' * 64)
        self.assertNotEqual(h1, h2)


class TestGenesisHash(TestCase):
    def test_genesis_is_64_hex(self):
        h = create_genesis_hash(restaurant_id=1)
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in '0123456789abcdef' for c in h))


class TestAddEvidenceToChain(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='o@test.com', password='x', name='Owner', role='OWNER')
        self.restaurant = Restaurant.objects.create(owner=self.user, name='R', address='A', city='C', google_maps_link='https://maps.example.com')
        self.category = RubricCategory.objects.create(name='Cat', weight=0.5, display_order=0)

    def test_first_evidence_creates_chain(self):
        content = b'file content'
        meta = {'timestamp': '2024-01-01T00:00:00', 'owner_id': self.user.id, 'category': 'Cat', 'filename': 'x.jpg'}
        out = add_evidence_to_chain(self.restaurant.id, content, meta)
        self.assertIn('hash_value', out)
        self.assertIn('previous_hash', out)
        self.assertEqual(out['chain_index'], 0)
        chain = HashChain.objects.get(restaurant_id=self.restaurant.id)
        self.assertEqual(chain.chain_length, 0)
        self.assertEqual(chain.genesis_hash, chain.current_hash)

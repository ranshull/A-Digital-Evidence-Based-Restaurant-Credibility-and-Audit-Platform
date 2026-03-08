"""Unit tests for Merkle tree crypto."""
from django.test import TestCase
from core.models import User, Restaurant, Evidence, MerkleTree, RubricCategory
from core.crypto.merkle import (
    _compute_merkle_root_from_hashes,
    _hash_pair,
    build_merkle_tree,
    generate_merkle_proof,
    verify_merkle_proof,
    rebuild_and_verify_tree,
)


class TestMerkleRoot(TestCase):
    def test_single_leaf(self):
        root = _compute_merkle_root_from_hashes(['a' * 64])
        self.assertEqual(root, 'a' * 64)

    def test_two_leaves(self):
        a, b = 'a' * 64, 'b' * 64
        root = _compute_merkle_root_from_hashes([a, b])
        self.assertEqual(root, _hash_pair(a, b))

    def test_verify_proof_pure(self):
        a, b = 'a' * 64, 'b' * 64
        root = _hash_pair(a, b)
        proof = [{'hash': b, 'position': 'right'}]
        self.assertTrue(verify_merkle_proof(a, proof, root))
        self.assertFalse(verify_merkle_proof('x' * 64, proof, root))


class TestMerkleTreeIntegration(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='u@t.com', password='x', name='U', role='OWNER')
        self.restaurant = Restaurant.objects.create(owner=self.user, name='R', address='A', city='C', google_maps_link='https://x.com')
        self.category = RubricCategory.objects.create(name='Cat', weight=0.5, display_order=0)

    def test_build_empty(self):
        root = build_merkle_tree(self.restaurant.id)
        self.assertEqual(root, '')

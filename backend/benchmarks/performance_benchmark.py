import io
import os
import statistics
import time
from typing import List, Dict, Any

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.test import Client
from django.contrib.auth import get_user_model

from core.models import Restaurant, RubricCategory


def _make_dummy_file(size_bytes: int, name: str = "bench.jpg") -> SimpleUploadedFile:
    buf = io.BytesIO(os.urandom(size_bytes))
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


class EvidenceBenchmark:
    """
    Simple, in-process benchmark harness for the owner evidence pipeline.
    Intended for manual runs, not as part of the unit test suite.
    """

    def __init__(self):
        self.client = Client()
        self.User = get_user_model()

    def _ensure_owner_and_restaurant(self):
        owner, _ = self.User.objects.get_or_create(
            email="bench-owner@example.com",
            defaults={"name": "Bench Owner", "role": "OWNER"},
        )
        restaurant, _ = Restaurant.objects.get_or_create(
            owner=owner,
            defaults={
                "name": "Bench Restaurant",
                "address": "Bench Street",
                "city": "Bench City",
                "google_maps_link": "https://maps.example.com",
            },
        )
        category, _ = RubricCategory.objects.get_or_create(
            name="Benchmark Category",
            defaults={"weight": 0.5, "display_order": 0},
        )
        return owner, restaurant, category

    def benchmark_upload_pipeline(self, sizes_mb: List[int]) -> List[Dict[str, Any]]:
        owner, restaurant, category = self._ensure_owner_and_restaurant()

        # Log in via Django test client session (assumes JWT/session auth is not required for this path).
        self.client.force_login(owner)

        results: List[Dict[str, Any]] = []
        for size in sizes_mb:
            size_bytes = size * 1024 * 1024
            test_file = _make_dummy_file(size_bytes)

            data = {
                "category_id": str(category.id),
                "description": f"Benchmark upload {size}MB",
                "file": test_file,
            }

            start = time.time()
            response = self.client.post(
                "/api/evidence/upload/",
                data,
            )
            total_ms = (time.time() - start) * 1000.0

            results.append(
                {
                    "size_mb": size,
                    "status_code": response.status_code,
                    "total_time_ms": total_ms,
                }
            )

        return results


class Command(BaseCommand):
    help = "Run simple performance benchmarks for the FOODAS evidence pipeline."

    def handle(self, *args, **options):
        bench = EvidenceBenchmark()
        sizes = [1, 5, 10]
        upload_results = bench.benchmark_upload_pipeline(sizes)

        self.stdout.write("Upload pipeline benchmark (single upload per size):")
        for row in upload_results:
            self.stdout.write(
                f"  {row['size_mb']}MB -> {row['status_code']} in {row['total_time_ms']:.2f} ms"
            )


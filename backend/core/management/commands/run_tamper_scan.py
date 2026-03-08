"""
Run tamper detection scan on evidence. For cron/scheduler.
Usage: python manage.py run_tamper_scan [--status APPROVED] [--limit N]
"""
from django.core.management.base import BaseCommand

from core.models import EvidenceStatus
from core.crypto.tamper import run_tamper_detection_scan


class Command(BaseCommand):
    help = 'Scan evidence for tampering (integrity + metadata checks).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--status',
            type=str,
            default=EvidenceStatus.APPROVED,
            help='Evidence status to scan (default: APPROVED). Use empty string for all.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Max number of evidence records to scan.',
        )

    def handle(self, *args, **options):
        status = options['status'] or None
        limit = options['limit']
        result = run_tamper_detection_scan(status_filter=status, limit=limit)
        self.stdout.write(
            f"Scanned: {result['scanned']}, Tampered: {result['tampered_count']}, Errors: {result['errors']}"
        )

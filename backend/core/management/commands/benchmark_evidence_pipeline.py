from django.core.management.base import BaseCommand

from benchmarks.performance_benchmark import EvidenceBenchmark


class Command(BaseCommand):
    help = "Run simple performance benchmarks for the FOODAS evidence upload pipeline."

    def handle(self, *args, **options):
        bench = EvidenceBenchmark()
        sizes = [1, 5, 10]
        results = bench.benchmark_upload_pipeline(sizes)

        self.stdout.write("Upload pipeline benchmark (single upload per size):")
        for row in results:
            self.stdout.write(
                f"  {row['size_mb']}MB -> {row['status_code']} in {row['total_time_ms']:.2f} ms"
            )


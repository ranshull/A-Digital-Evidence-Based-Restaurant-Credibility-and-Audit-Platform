# Generated migration for review assignment fields

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_evidence_rubric_scoring'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='review_assigned_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='review_assigned_to',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_review_restaurants',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

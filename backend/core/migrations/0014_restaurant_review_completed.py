from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_auditor_work_item'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='review_completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='review_completed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='completed_review_restaurants',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

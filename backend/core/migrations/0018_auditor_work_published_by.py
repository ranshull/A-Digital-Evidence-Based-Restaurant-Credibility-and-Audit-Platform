from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0017_auditor_work_staging_edit_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditorworkitem',
            name='published_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='audit_work_items_published',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

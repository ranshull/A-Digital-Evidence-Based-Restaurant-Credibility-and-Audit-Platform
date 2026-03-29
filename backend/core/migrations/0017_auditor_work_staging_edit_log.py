from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_audit_visit_staging'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditorworkitem',
            name='staging_edit_log',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Admin edits to staging scores: list of {at, admin_name, reason, category_id}.',
            ),
        ),
    ]

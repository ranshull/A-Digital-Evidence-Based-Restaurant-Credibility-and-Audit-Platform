import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_audit_work_category_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditorworkitem',
            name='submission_status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('SUBMITTED_TO_ADMIN', 'Submitted to admin'),
                    ('PUBLISHED', 'Published'),
                    ('FLAGGED', 'Flagged'),
                ],
                default='DRAFT',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='auditorworkitem',
            name='category_photos_saved',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='auditorworkitem',
            name='category_marked_na',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='auditorworkitem',
            name='submitted_to_admin_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='auditorworkitem',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='auditorworkitem',
            name='flagged_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='AuditVisitScore',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('score', models.PositiveIntegerField()),
                ('notes', models.TextField(blank=True)),
                ('is_category_applicable', models.BooleanField(default=True)),
                ('scored_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_visit_scores', to='core.rubriccategory')),
                ('scored_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_visit_scores_given', to=settings.AUTH_USER_MODEL)),
                ('subcategory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_visit_scores', to='core.rubricsubcategory')),
                ('work_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='staging_scores', to='core.auditorworkitem')),
            ],
            options={
                'db_table': 'audit_visit_scores',
                'ordering': ['category_id', 'subcategory_id'],
                'unique_together': {('work_item', 'subcategory')},
            },
        ),
    ]

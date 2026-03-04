from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_restaurant_review_assignment'),
    ]

    operations = [
        migrations.CreateModel(
            name='Audit',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('REQUESTED', 'Requested'), ('ASSIGNED', 'Assigned'), ('IN_PROGRESS', 'In progress'), ('SUBMITTED_BY_AUDITOR', 'Submitted by auditor'), ('REVIEWED_BY_ADMIN', 'Reviewed by admin'), ('CANCELLED', 'Cancelled')], default='REQUESTED', max_length=40)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('assigned_at', models.DateTimeField(blank=True, null=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('review_notes', models.TextField(blank=True)),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_audits', to=settings.AUTH_USER_MODEL)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_audits', to=settings.AUTH_USER_MODEL)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audits', to='core.restaurant')),
            ],
            options={
                'db_table': 'audits',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.CreateModel(
            name='AuditEvidence',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_url', models.URLField(max_length=500)),
                ('file_type', models.CharField(choices=[('IMAGE', 'Image'), ('VIDEO', 'Video')], max_length=10)),
                ('original_filename', models.CharField(max_length=255)),
                ('file_size_bytes', models.BigIntegerField()),
                ('mime_type', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('upload_timestamp', models.DateTimeField(auto_now_add=True)),
                ('audit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evidence', to='core.audit')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_evidence', to='core.restaurant')),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_evidence', to='core.rubriccategory')),
            ],
            options={
                'db_table': 'audit_evidence',
                'ordering': ['-upload_timestamp'],
            },
        ),
        migrations.CreateModel(
            name='AuditScore',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('score', models.PositiveIntegerField()),
                ('notes', models.TextField(blank=True)),
                ('scored_timestamp', models.DateTimeField(auto_now_add=True)),
                ('audit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='scores', to='core.audit')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_scores', to='core.restaurant')),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_scores', to='core.rubriccategory')),
                ('subcategory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_scores', to='core.rubricsubcategory')),
                ('scored_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_scores_given', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'audit_scores',
                'ordering': ['category', 'subcategory'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='auditscore',
            unique_together={('audit', 'subcategory')},
        ),
    ]


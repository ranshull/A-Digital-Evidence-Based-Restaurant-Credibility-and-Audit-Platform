# Audit evidence separate cryptographic chain (Phase 2)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_add_profile_picture_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditevidence',
            name='hash_value',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='previous_hash',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='chain_index',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='nonce',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='file_content_hash',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='is_chain_valid',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='auditevidence',
            name='is_cryptographically_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='AuditHashChain',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('genesis_hash', models.CharField(max_length=64)),
                ('current_hash', models.CharField(max_length=64)),
                ('chain_length', models.PositiveIntegerField(default=0)),
                ('last_verified', models.DateTimeField(blank=True, null=True)),
                ('is_valid', models.BooleanField(default=True)),
                ('audit', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='hash_chain', to='core.audit')),
            ],
            options={
                'db_table': 'audit_hash_chain',
            },
        ),
        migrations.CreateModel(
            name='AuditEvidenceTimestamp',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp_token', models.TextField()),
                ('server_time', models.DateTimeField()),
                ('client_time', models.DateTimeField(blank=True, null=True)),
                ('hash_at_timestamp', models.CharField(max_length=64)),
                ('is_verified', models.BooleanField(default=False)),
                ('audit_evidence', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='timestamp_record', to='core.auditevidence')),
            ],
            options={
                'db_table': 'audit_evidence_timestamp',
            },
        ),
        migrations.CreateModel(
            name='AuditMerkleTree',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('root_hash', models.CharField(max_length=64)),
                ('tree_depth', models.PositiveIntegerField(default=0)),
                ('evidence_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_valid', models.BooleanField(default=True)),
                ('audit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='merkle_trees', to='core.audit')),
            ],
            options={
                'db_table': 'audit_merkle_tree',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AuditTamperDetection',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('detection_timestamp', models.DateTimeField(auto_now_add=True)),
                ('is_tampered', models.BooleanField(default=False)),
                ('detection_method', models.CharField(max_length=50)),
                ('confidence_score', models.FloatField(default=0.0)),
                ('findings', models.JSONField(blank=True, default=dict)),
                ('flagged_by', models.CharField(default='system', max_length=50)),
                ('audit_evidence', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tamper_checks', to='core.auditevidence')),
            ],
            options={
                'db_table': 'audit_tamper_detection',
                'ordering': ['-detection_timestamp'],
            },
        ),
        migrations.CreateModel(
            name='AuditMerkleNode',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('node_hash', models.CharField(max_length=64)),
                ('level', models.PositiveIntegerField(default=0)),
                ('audit_evidence', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='merkle_leaf_nodes', to='core.auditevidence')),
                ('left_child', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='parent_left', to='core.auditmerklenode')),
                ('right_child', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='parent_right', to='core.auditmerklenode')),
                ('tree', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='nodes', to='core.auditmerkletree')),
            ],
            options={
                'db_table': 'audit_merkle_node',
            },
        ),
    ]

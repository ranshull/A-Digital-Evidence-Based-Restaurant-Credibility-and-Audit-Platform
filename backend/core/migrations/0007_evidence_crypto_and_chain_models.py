from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_audit_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='evidence',
            name='hash_value',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='previous_hash',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='chain_index',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='nonce',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='file_content_hash',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='is_chain_valid',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='evidence',
            name='is_cryptographically_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='HashChain',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('genesis_hash', models.CharField(max_length=64)),
                ('current_hash', models.CharField(max_length=64)),
                ('chain_length', models.PositiveIntegerField(default=0)),
                ('last_verified', models.DateTimeField(blank=True, null=True)),
                ('is_valid', models.BooleanField(default=True)),
                ('restaurant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='hash_chain', to='core.restaurant')),
            ],
            options={
                'db_table': 'hash_chain',
            },
        ),
        migrations.CreateModel(
            name='MerkleTree',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('root_hash', models.CharField(max_length=64)),
                ('tree_depth', models.PositiveIntegerField(default=0)),
                ('evidence_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_valid', models.BooleanField(default=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='merkle_trees', to='core.restaurant')),
            ],
            options={
                'db_table': 'merkle_tree',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TamperDetection',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('detection_timestamp', models.DateTimeField(auto_now_add=True)),
                ('is_tampered', models.BooleanField(default=False)),
                ('detection_method', models.CharField(max_length=50)),
                ('confidence_score', models.FloatField(default=0.0)),
                ('findings', models.JSONField(blank=True, default=dict)),
                ('flagged_by', models.CharField(default='system', max_length=50)),
                ('evidence', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tamper_checks', to='core.evidence')),
            ],
            options={
                'db_table': 'tamper_detection',
                'ordering': ['-detection_timestamp'],
            },
        ),
        migrations.CreateModel(
            name='EvidenceTimestamp',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp_token', models.TextField()),
                ('server_time', models.DateTimeField()),
                ('client_time', models.DateTimeField(blank=True, null=True)),
                ('time_authority_signature', models.TextField(blank=True, null=True)),
                ('hash_at_timestamp', models.CharField(max_length=64)),
                ('is_verified', models.BooleanField(default=False)),
                ('evidence', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='timestamp_record', to='core.evidence')),
            ],
            options={
                'db_table': 'evidence_timestamp',
            },
        ),
        migrations.CreateModel(
            name='MerkleNode',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('node_hash', models.CharField(max_length=64)),
                ('level', models.PositiveIntegerField(default=0)),
                ('evidence', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='merkle_leaf_nodes', to='core.evidence')),
                ('left_child', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='parent_left', to='core.merklenode')),
                ('right_child', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='parent_right', to='core.merklenode')),
                ('tree', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='nodes', to='core.merkletree')),
            ],
            options={
                'db_table': 'merkle_node',
            },
        ),
    ]

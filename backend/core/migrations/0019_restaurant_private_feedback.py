from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0018_auditor_work_published_by'),
    ]

    operations = [
        migrations.CreateModel(
            name='RestaurantPrivateFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField(max_length=2000)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'author',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='restaurant_private_feedback_sent',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'restaurant',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='private_feedback',
                        to='core.restaurant',
                    ),
                ),
            ],
            options={
                'db_table': 'restaurant_private_feedback',
                'ordering': ['-created_at'],
            },
        ),
    ]

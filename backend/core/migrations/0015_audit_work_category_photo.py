import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_restaurant_review_completed'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditWorkCategoryPhoto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image_url', models.URLField(max_length=500)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('display_order', models.PositiveIntegerField(default=0)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_work_category_photos', to='core.rubriccategory')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_work_category_photos', to=settings.AUTH_USER_MODEL)),
                ('work_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='category_photos', to='core.auditorworkitem')),
            ],
            options={
                'db_table': 'audit_work_category_photos',
                'ordering': ['category_id', 'display_order', 'id'],
            },
        ),
    ]

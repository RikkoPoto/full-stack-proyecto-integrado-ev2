from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Scan',
            fields=[
                ('id', models.CharField(max_length=32, primary_key=True, serialize=False)),
                ('url', models.URLField(max_length=500)),
                ('scope', models.IntegerField(default=10)),
                ('status', models.CharField(choices=[('running', 'En curso'), ('done', 'Completado'), ('error', 'Error'), ('cancelled', 'Interrumpido')], default='running', max_length=16)),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('step', models.IntegerField(default=0)),
                ('total', models.IntegerField(default=17)),
                ('retries', models.IntegerField(default=0)),
                ('score', models.IntegerField(blank=True, null=True)),
                ('classification', models.CharField(blank=True, choices=[('bajo', 'Bajo'), ('parcial', 'Parcial'), ('alto', 'Alto')], max_length=16, null=True)),
                ('rules', models.JSONField(default=list)),
                ('log', models.JSONField(default=list)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('error_code', models.CharField(blank=True, max_length=64, null=True)),
                ('integrity_hash', models.CharField(blank=True, max_length=64, null=True)),
            ],
            options={
                'ordering': ['-started_at'],
            },
        ),
    ]

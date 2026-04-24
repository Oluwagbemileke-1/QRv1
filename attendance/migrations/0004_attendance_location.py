from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0003_make_location_required"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendance",
            name="location",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]

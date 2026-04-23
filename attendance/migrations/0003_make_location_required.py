from django.db import migrations, models


def backfill_attendance_coordinates(apps, schema_editor):
    Attendance = apps.get_model("attendance", "Attendance")
    Attendance.objects.filter(latitude__isnull=True).update(latitude=0.0)
    Attendance.objects.filter(longitude__isnull=True).update(longitude=0.0)


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0002_remove_attendance_qr_data"),
    ]

    operations = [
        migrations.RunPython(backfill_attendance_coordinates, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="attendance",
            name="latitude",
            field=models.FloatField(),
        ),
        migrations.AlterField(
            model_name="attendance",
            name="longitude",
            field=models.FloatField(),
        ),
    ]

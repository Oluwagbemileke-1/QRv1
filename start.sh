#!/usr/bin/env bash
gunicorn qr_attendance_project.wsgi:application
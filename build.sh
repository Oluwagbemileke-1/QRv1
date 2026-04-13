#!/usr/bin/env bash
pip install -r requirements.txt
python manage.py collectstatcic --noinput
python manage.py migrate
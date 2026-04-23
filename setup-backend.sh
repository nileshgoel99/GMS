#!/bin/bash

echo "==================================="
echo "GMS Backend Setup Script"
echo "==================================="

cd backend

echo "Creating virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "Please update the .env file with your database credentials!"
fi

echo ""
echo "==================================="
echo "Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your PostgreSQL credentials"
echo "2. Create PostgreSQL database: psql -U postgres -c 'CREATE DATABASE gms_db;'"
echo "3. Run migrations: cd backend && source venv/bin/activate && python manage.py migrate"
echo "4. Create superuser: python manage.py createsuperuser"
echo "5. Start backend: python manage.py runserver"
echo "==================================="

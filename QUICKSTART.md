# Quick Start Guide

Follow these steps to get your GMS application running:

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL 12+

## Step 1: Database Setup

Create a PostgreSQL database:

```bash
# Log into PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE gms_db;

# Exit
\q
```

## Step 2: Backend Setup

```bash
# Make setup script executable
chmod +x setup-backend.sh

# Run setup (or follow manual steps below)
./setup-backend.sh
```

### Manual Backend Setup:

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and update database credentials
# Then run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser account
python manage.py createsuperuser

# Start backend server
python manage.py runserver
```

Backend will be running at: http://localhost:8000

## Step 3: Frontend Setup

In a new terminal:

```bash
# Make setup script executable
chmod +x setup-frontend.sh

# Run setup (or follow manual steps below)
./setup-frontend.sh
```

### Manual Frontend Setup:

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start frontend server
npm start
```

Frontend will be running at: http://localhost:3000

## Step 4: Access the Application

1. Open your browser and go to http://localhost:3000
2. Log in with the superuser credentials you created
3. Start using the GMS application!

## Default Module URLs

- Dashboard: http://localhost:3000/
- Orders (PI): http://localhost:3000/orders
- Inventory: http://localhost:3000/inventory
- Procurement: http://localhost:3000/procurement
- Production: http://localhost:3000/production

## Admin Panel

Access Django admin at: http://localhost:8000/admin

## Troubleshooting

### Backend Issues

1. **Database connection error**: Check your .env file has correct PostgreSQL credentials
2. **Module not found**: Make sure virtual environment is activated
3. **Port already in use**: Change port with `python manage.py runserver 8001`

### Frontend Issues

1. **Cannot connect to backend**: Ensure backend is running on port 8000
2. **npm install fails**: Try deleting node_modules and package-lock.json, then run npm install again
3. **Port already in use**: Frontend will prompt to use a different port

## Need Help?

Check the main README.md for detailed documentation and API endpoints.

# GMS - Garment Manufacturing System

A comprehensive web application for managing garment manufacturing operations including order management, inventory control, procurement, and production tracking.

## Features

- **Client Order Management (PI System)**: Create and track orders with unique PI Numbers
- **Inventory Management**: Manage raw materials with full tracking
- **Purchase Order Management**: Generate and track POs with multiple suppliers
- **Production Issue Handling**: Record and track material issuance to production
- **Inventory Summary Dashboard**: Complete inventory lifecycle reporting

## Tech Stack

### Backend
- Django 5.0
- Django REST Framework
- PostgreSQL
- JWT Authentication

### Frontend
- React 18
- Material-UI (MUI)
- React Router
- Axios

## Project Structure

```
gms/
├── backend/              # Django backend
│   ├── gms_backend/     # Main project settings
│   ├── orders/          # PI/Order management
│   ├── inventory/       # Inventory management
│   ├── procurement/     # Purchase order management
│   ├── production/      # Production issue management
│   └── manage.py
└── frontend/            # React frontend
    ├── public/
    └── src/
        ├── components/  # Reusable components
        ├── context/     # Auth context
        ├── pages/       # Page components
        ├── services/    # API services
        └── App.js
```

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from example:
```bash
cp .env.example .env
```

5. Update `.env` with your database credentials:
```
DB_NAME=gms_db
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
```

6. Create PostgreSQL database:
```bash
psql -U postgres
CREATE DATABASE gms_db;
\q
```

7. Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

8. Create superuser:
```bash
python manage.py createsuperuser
```

9. Run development server:
```bash
python manage.py runserver
```

Backend will be available at http://localhost:8000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Update `.env` if needed (default is fine for local development):
```
REACT_APP_API_URL=http://localhost:8000/api
```

5. Start development server:
```bash
npm start
```

Frontend will be available at http://localhost:3000

## Default Login

After creating a superuser, use those credentials to log in to the application.

## API Endpoints

### Authentication
- POST `/api/token/` - Login
- POST `/api/token/refresh/` - Refresh token

### Orders (PI)
- GET `/api/orders/pi/` - List all PIs
- POST `/api/orders/pi/` - Create new PI
- GET `/api/orders/pi/{id}/` - Get PI details
- PUT `/api/orders/pi/{id}/` - Update PI
- DELETE `/api/orders/pi/{id}/` - Delete PI
- GET `/api/orders/pi/{id}/planning_sheet/` - Get planning sheet
- POST `/api/orders/pi/{id}/planning_sheet/` - Update planning sheet

### Inventory
- GET `/api/inventory/items/` - List all items
- POST `/api/inventory/items/` - Create new item
- GET `/api/inventory/items/{id}/` - Get item details
- PUT `/api/inventory/items/{id}/` - Update item
- DELETE `/api/inventory/items/{id}/` - Delete item
- GET `/api/inventory/items/low_stock/` - Get low stock items
- GET `/api/inventory/items/{id}/summary/` - Get item summary
- GET `/api/inventory/logs/` - Get inventory logs

### Procurement
- GET `/api/procurement/po/` - List all POs
- POST `/api/procurement/po/` - Create new PO
- GET `/api/procurement/po/{id}/` - Get PO details
- PUT `/api/procurement/po/{id}/` - Update PO
- DELETE `/api/procurement/po/{id}/` - Delete PO
- POST `/api/procurement/receipts/` - Record PO receipt

### Production
- GET `/api/production/issues/` - List all production issues
- POST `/api/production/issues/` - Create new production issue
- GET `/api/production/issues/{id}/` - Get issue details
- PUT `/api/production/issues/{id}/` - Update issue
- DELETE `/api/production/issues/{id}/` - Delete issue
- POST `/api/production/issues/{id}/issue_materials/` - Issue materials

## Features in Detail

### Order Management (PI System)
- Create orders with unique PI numbers
- Link planning sheets to calculate inventory needs
- Track order status through workflow
- Client details management

### Inventory Management
- Track multiple material categories (Buttons, Thread, Zippers, etc.)
- Monitor stock levels with reorder alerts
- Detailed item attributes (color, size, finish)
- Complete transaction logging

### Purchase Order Management
- Generate POs linked to PIs
- Support for multiple vendors
- Partial delivery tracking
- Automatic status updates

### Production Issue Management
- Issue materials to production teams
- Link to specific PIs
- Track material consumption
- Handle returns

### Inventory Summary Dashboard
- Complete lifecycle tracking
- Transaction history
- Date-based reporting
- Reference tracking (PI/PO linkage)

## Development

### Running Tests
```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm test
```

### Code Style
- Backend: Follow PEP 8
- Frontend: ESLint with React recommended rules

## Deployment

### Backend Deployment
1. Set `DEBUG=False` in production
2. Configure proper `ALLOWED_HOSTS`
3. Use environment variables for sensitive data
4. Set up proper database (PostgreSQL)
5. Configure static files serving
6. Use gunicorn or similar WSGI server

### Frontend Deployment
1. Build the production bundle:
```bash
npm run build
```
2. Serve the `build` directory with nginx or similar
3. Update `REACT_APP_API_URL` to production backend URL

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary software.

## Support

For support, contact your system administrator.

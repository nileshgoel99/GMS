#!/bin/bash

echo "==================================="
echo "GMS Frontend Setup Script"
echo "==================================="

cd frontend

echo "Installing dependencies..."
npm install

if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
fi

echo ""
echo "==================================="
echo "Frontend setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure backend is running on http://localhost:8000"
echo "2. Start frontend: cd frontend && npm start"
echo "3. Open browser at http://localhost:3000"
echo "==================================="

# MealMate

Student: Hima Teja Raju Sangaraju (001437527)  
University of Greenwich

---

## Install

**Prerequisites:** Node.js, Python 3.8+, MongoDB

---

## Setup

**Backend:**
```bash
cd backend
npm install
npm start
```

**ML Service:**
```bash
cd ml-service
pip install -r requirements.txt
python ml_service.py
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3000`

---

## Environment Variables

**backend/.env:**
```
MONGO_URI=mongodb://localhost:27017/mealmate
JWT_SECRET=your_secret_key
STRIPE_SECRET_KEY=sk_test_your_key
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
PORT=5000
FRONTEND_URL=http://localhost:3000
```

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_GOOGLE_MAPS_API_KEY=your_key
```

---

**Tech:** React, Node.js, MongoDB, Python Flask, Socket.io

## Docker Setup

### Prerequisites
- Docker
- Docker Compose

### Running with Docker

1. Build and start all services:
```bash
docker-compose up --build
```

2. Access the application:
- Frontend: http://localhost
- Backend API: http://localhost:5000
- ML Service: http://localhost:5001

3. Stop all services:
```bash
docker-compose down
```

### Rebuilding After Changes

If you modify dependencies:
```bash
docker-compose build --no-cache backend
docker-compose up
```
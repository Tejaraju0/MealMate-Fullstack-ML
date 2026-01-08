# MealMate: Food Waste Reduction Platform

<div align="right">

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Click_Here-success?style=for-the-badge)](https://mealmate-frontend-h4a8.onrender.com)

</div>

**An MSc Computer Science dissertation project combining ML-based waste prediction with real-time food redistribution.**

Student: Hima Teja Raju Sangaraju (001437527)  
University of Greenwich

---

## About MealMate

MealMate is a web platform that tackles food waste from two angles:

1. **For Restaurants & Cafes**: Uses machine learning to predict tomorrow's food waste, enabling proactive adjustments to preparation quantities
2. **For Everyone**: Connects surplus food with people who need it through an interactive map-based sharing system

**Key Features:**
- 🤖 ML waste prediction achieving R²=0.75 on real-world bakery data
- 🗺️ Geospatial search with interactive Google Maps integration
- 💬 Real-time messaging via WebSocket for pickup coordination
- 💳 Flexible payment options (free sharing, cash, or Stripe escrow)
- 📊 Analytics dashboard showing waste trends and environmental impact

**Tech Stack:** React, Node.js, MongoDB, Python Flask, Socket.io

> ⚠️ **Note:** Live demo hosted on Render's free tier. Services may take 30-60 seconds to wake up after inactivity.

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

---

## Academic Context

**Research Contribution:** This dissertation demonstrates successful integration of machine learning waste forecasting with operational food redistribution, validated through a two-stage methodology using both synthetic training data (313,033 records) and real-world bakery data (5,142 observations over 28 months).


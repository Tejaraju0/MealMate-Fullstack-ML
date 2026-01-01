require('dotenv').config();

const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const foodListingRoutes = require('./routes/foodRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const wasteRoutes = require('./routes/wasteRoutes');
const { scheduleExpiryCheck } = require('./services/expiryService');
const socketService = require('./services/socketService');
// Load environment variables
dotenv.config();
scheduleExpiryCheck();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app); // Create HTTP server

// Initialize Socket.io
socketService.initialize(server);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('MealMate API is running...');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/foodRoutes', foodListingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/waste', wasteRoutes);

// Test route
app.post('/api/test', (req, res) => {
  res.status(200).json({ message: 'Test route is working' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
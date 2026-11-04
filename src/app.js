const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes');
const placeRoutes = require('./routes/placeRoutes');
const visitRoutes = require('./routes/visitRoutes');
const masterRoutes = require('./routes/masterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const storageRoutes = require('./routes/storageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Inisialisasi
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ message: "Dinery Backend API is Ready! 🚀" });
});

// Register Routes (Support both '/api/*' and '/*' to guarantee 100% Vercel Serverless Function compatibility)
const registerRoutes = (prefix = '') => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/couples`, coupleRoutes);
  app.use(`${prefix}/places`, placeRoutes);
  app.use(`${prefix}/visits`, visitRoutes);
  app.use(`${prefix}/master`, masterRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/storage`, storageRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/dashboard`, dashboardRoutes);
};

registerRoutes('/api');
registerRoutes('');

app.use(express.static(path.join(__dirname, '../public')));
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});

// Error Handler
app.use((req, res) => {
  res.status(404).json({ 
    message: "Endpoint tidak ditemukan", 
    method: req.method,
    path: req.originalUrl || req.url 
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    console.log(`👉 Docs    : http://localhost:${PORT}/docs`);
    console.log(`👉 Auth    : http://localhost:${PORT}/api/auth`);
    console.log(`👉 Places  : http://localhost:${PORT}/api/places`);
    console.log(`👉 Visits  : http://localhost:${PORT}/api/visits`);
    console.log(`========================================\n`);
  });
}

module.exports = app;

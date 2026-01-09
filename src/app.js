const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes'); // <--- [BARU]
const placeRoutes = require('./routes/placeRoutes'); // <--- [BARU]
const visitRoutes = require('./routes/visitRoutes');   // [BARU]
const masterRoutes = require('./routes/masterRoutes'); // [BARU]
const adminRoutes = require('./routes/adminRoutes');
const storageRoutes = require('./routes/storageRoutes'); // <--- [BARU]
const notificationRoutes = require('./routes/notificationRoutes');

// Inisialisasi
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ message: "Dinery Backend API is Ready! 🚀" });
});

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/couples', coupleRoutes); // <--- [BARU]
app.use('/api/places', placeRoutes); // <--- [BARU]
app.use('/api/visits', visitRoutes);   // [BARU]
app.use('/api/master', masterRoutes);  // [BARU]
app.use('/api/admin', adminRoutes); // <--- [BARU]
app.use('/api/storage', storageRoutes); // <--- [BARU]
app.use('/api/notifications', notificationRoutes); // <--- [BARU]

// Error Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
  console.log(`👉 Auth    : http://localhost:${PORT}/api/auth`);
  console.log(`👉 Places  : http://localhost:${PORT}/api/places`);
  console.log(`👉 Visits  : http://localhost:${PORT}/api/visits`);
  console.log(`========================================\n`);
});
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes'); // <--- [BARU]

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

// Error Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SERVER RUNNING ON PORT ${PORT}`);
  console.log(`👉 Auth    : http://localhost:${PORT}/api/auth`);
  console.log(`👉 Couple  : http://localhost:${PORT}/api/couples`);
});
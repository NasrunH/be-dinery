const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ==========================================
// 1. SETUP SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: File .env tidak terbaca atau kosong!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. SETUP SERVER
// ==========================================
const app = express();
// Gunakan Port 5000 kalau di .env tidak terbaca
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ==========================================
// 3. ROUTES
// ==========================================

// Route Utama
app.get('/', (req, res) => {
  res.json({
    message: `✅ Server Dinery Berjalan di Port ${PORT}`,
    status: "Active" 
  });
});

// Route Cek DB
app.get('/api/health-check', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Mencoba ping ke Supabase...`);
    
    // Coba ambil data dummy untuk tes koneksi
    // Pastikan tabel 'm_categories' sudah kamu buat di Supabase SQL Editor
    const { data, error, count } = await supabase
      .from('m_categories')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error("❌ Supabase Error Detail:", error);
      throw error;
    }

    console.log("✅ Koneksi DB Sukses!");
    res.json({
      status: "SUKSES_GANTI_PORT",
      port: PORT,
      message: "Koneksi Supabase Aman.",
      total_data_kategori: count
    });

  } catch (err) {
    console.error("❌ Error Handler:", err.message);
    res.status(500).json({
      status: "GAGAL",
      port: PORT,
      error_message: err.message,
      hint: "Pastikan tabel 'm_categories' sudah dibuat via SQL Editor di Dashboard Supabase."
    });
  }
});

// ==========================================
// 4. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SERVER DINERY JALAN DI PORT: ${PORT}`);
  console.log(`👉 Link Utama : http://localhost:${PORT}`);
  console.log(`👉 Cek DB     : http://localhost:${PORT}/api/health-check`);
  console.log(`==================================================\n`);
});
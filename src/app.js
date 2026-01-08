const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import langsung tanpa kurung kurawal {}
const supabase = require('./config/supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// === ROUTES ===

// 1. Cek Server Nyala
app.get('/', (req, res) => {
  res.json({ message: "Server Dinery ON 🔥" });
});

// 2. Cek Koneksi Database
app.get('/api/health-check', async (req, res) => {
  try {
    // Kita coba select 1 data dari tabel m_categories
    // Gunakan .select('*') agar pasti valid
    const { data, error, count } = await supabase
      .from('m_categories')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw error; // Lempar ke catch di bawah
    }

    res.json({
      status: "Sukses",
      message: "Koneksi ke Supabase Berhasil! ✅",
      total_data: count
    });

  } catch (err) {
    console.error("❌ Error Database:", err.message);
    res.status(500).json({
      status: "Gagal",
      pesan_error: err.message,
      saran: "Cek apakah tabel 'm_categories' sudah dibuat di Supabase?"
    });
  }
});

// === JALANKAN SERVER ===
app.listen(PORT, () => {
  console.log(`\n🚀 Dinery Server siap di http://localhost:${PORT}`);
});
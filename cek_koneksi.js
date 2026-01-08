require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log("========================================");
console.log("🕵️  DIAGNOSA KONEKSI DINERY BACKEND");
console.log("========================================");

// 1. Cek Apakah File .env Terbaca?
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

console.log("\n[1] Memeriksa Variabel Environment (.env):");

if (!url) {
    console.error("❌ GAGAL: SUPABASE_URL tidak ditemukan. Cek nama variabel di .env!");
} else {
    console.log(`✅ URL ditemukan: ${url}`);
}

if (!key) {
    console.error("❌ GAGAL: SUPABASE_KEY tidak ditemukan.");
} else {
    // Tampilkan 10 karakter pertama saja untuk keamanan
    console.log(`✅ KEY ditemukan: ${key.substring(0, 15)}...`);
}

// Jika env kosong, berhenti di sini
if (!url || !key) {
    console.log("\n🛑 Diagnosa berhenti. Perbaiki file .env dulu!");
    process.exit(1);
}

// 2. Cek Koneksi ke Supabase
console.log("\n[2] Mencoba menghubungi Server Supabase...");
const supabase = createClient(url, key);

async function testConnection() {
    try {
        // Coba ambil data dari tabel m_categories
        const { data, error, count } = await supabase
            .from('m_categories')
            .select('*', { count: 'exact', head: true });

        if (error) {
            throw error; // Lempar error jika ada response error dari Supabase
        }

        console.log("✅ KONEKSI SUKSES!");
        console.log(`📊 Status Database: Terhubung.`);
        console.log(`📂 Jumlah Kategori terbaca: ${count}`);
        console.log("\n🎉 Kesimpulan: Backend aman, masalahnya mungkin di kode App.js sebelumnya.");

    } catch (err) {
        console.error("\n❌ KONEKSI GAGAL!");
        console.error("Penyebab:", err.message);
        
        if (err.code === 'PGRST301') {
            console.log("💡 Hint: Row Level Security (RLS) mungkin memblokir akses anonim.");
        } else if (err.message.includes('fetch')) {
            console.log("💡 Hint: URL Supabase salah atau internet kamu memblokir koneksi.");
        } else if (err.code === '42P01') {
            console.log("💡 Hint: Tabel 'm_categories' belum dibuat di database.");
        }
    }
}

testConnection();
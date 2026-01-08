require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Kita pakai module.exports langsung (tanpa kurung kurawal) biar simpel
module.exports = supabase;
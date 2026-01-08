require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ FATAL: Supabase URL/Key tidak ditemukan di .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Export langsung object-nya biar gak ribet destructuring
module.exports = supabase;
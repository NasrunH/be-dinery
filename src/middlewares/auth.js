const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
  try {
    // 1. Ambil token dari Header (Authorization: Bearer <token>)
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: "Token otentikasi tidak ditemukan" });
    }

    const token = authHeader.split(' ')[1]; // Ambil string setelah "Bearer"
    
    // 2. Cek keaslian token ke Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Token tidak valid atau kadaluarsa" });
    }

    // 3. Simpan data user di request object biar bisa dipakai di Controller
    req.user = user;
    
    // 4. Lanjut ke Controller
    next();

  } catch (err) {
    console.error("Auth Error:", err.message);
    res.status(401).json({ message: "Gagal verifikasi user", error: err.message });
  }
};

module.exports = requireAuth;
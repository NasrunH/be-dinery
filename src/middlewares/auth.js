const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
  try {
    // 1. Ambil token dari Header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: "Akses ditolak. Token tidak ditemukan." });
    }

    const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"

    // 2. Verifikasi token ke Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Token tidak valid atau kadaluarsa." });
    }

    // 3. Simpan data user di request agar bisa dipakai di controller
    req.user = user;
    
    next();

  } catch (err) {
    res.status(500).json({ message: "Server Error pada Auth Middleware" });
  }
};

module.exports = requireAuth;
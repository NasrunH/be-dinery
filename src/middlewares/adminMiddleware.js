const supabase = require('../config/supabase');

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id; // Didapat dari requireAuth sebelumnya

    // Cek ke tabel app_admins
    const { data: admin, error } = await supabase
      .from('app_admins')
      .select('id, role')
      .eq('user_id', userId)
      .single();

    if (error || !admin) {
      return res.status(403).json({ 
        message: "Akses Ditolak. Anda bukan Administrator." 
      });
    }

    // Lanjut jika admin valid
    req.adminRole = admin.role;
    next();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = requireAdmin;
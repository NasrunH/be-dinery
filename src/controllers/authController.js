const supabase = require('../config/supabase');

const authController = {
  // 1. REGISTER USER BARU
  register: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email dan Password wajib diisi" });
      }

      // Panggil Supabase Auth SignUp
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
      });

      if (error) throw error;

      // Jika sukses, data user akan otomatis masuk ke tabel auth_users 
      // (karena trigger SQL yang sudah kita buat sebelumnya di Database)

      res.status(201).json({
        message: "Registrasi Berhasil! Silakan cek email untuk verifikasi (jika aktif) atau langsung Login.",
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });

    } catch (err) {
      res.status(400).json({ message: "Gagal Register", error: err.message });
    }
  },

  // 2. LOGIN USER
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Panggil Supabase Auth SignIn
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      res.json({
        message: "Login Berhasil!",
        token: data.session.access_token, // JWT Token ini yang dipakai untuk request selanjutnya
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });

    } catch (err) {
      res.status(401).json({ message: "Email atau Password salah", error: err.message });
    }
  },

  // 3. CEK PROFILE SAYA (Test Token)
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id; // Didapat dari middleware auth
      const { display_name, birth_date, phone, avatar_url } = req.body;

      // Update data ke tabel auth_users
      const { data, error } = await supabase
        .from('auth_users')
        .update({
          display_name,
          birth_date,
          phone,
          avatar_url // Nanti ini diisi URL dari Supabase Storage (kita bahas next)
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        message: "Profile berhasil diperbarui!",
        data: data
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [UPDATE] GET ME (Supaya data biodata baru ikut muncul)
  getMe: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const { data, error } = await supabase
        .from('auth_users')
        .select('*') // Ini akan otomatis mengambil display_name, dll
        .eq('id', userId)
        .single();
      
      if (error) throw error;

      res.json({
        message: "Data User Ditemukan",
        data: data
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = authController;
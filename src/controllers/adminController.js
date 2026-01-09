const supabase = require('../config/supabase');

const adminController = {
  // [GET] DASHBOARD STATS
  getStats: async (req, res) => {
    try {
      // Hitung total user
      const { count: userCount } = await supabase
        .from('auth_users')
        .select('*', { count: 'exact', head: true });

      // Hitung total couple
      const { count: coupleCount } = await supabase
        .from('couples')
        .select('*', { count: 'exact', head: true });

      // Hitung total places (wishlist)
      const { count: placeCount } = await supabase
        .from('places')
        .select('*', { count: 'exact', head: true });

      res.json({
        message: "Statistik Aplikasi",
        data: {
          total_users: userCount,
          total_couples: coupleCount,
          total_places: placeCount
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // MASTER CATEGORIES
  // ==========================================
  
  // Create Category
  createCategory: async (req, res) => {
    try {
      const { name, icon } = req.body;
      if (!name) return res.status(400).json({ message: "Nama kategori wajib." });

      const { data, error } = await supabase
        .from('m_categories')
        .insert({ name, icon })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "Kategori berhasil dibuat", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Update Category
  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, icon } = req.body;

      const { data, error } = await supabase
        .from('m_categories')
        .update({ name, icon })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ message: "Kategori berhasil diupdate", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Delete Category
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('m_categories').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "Kategori berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // MASTER GLOBAL TAGS
  // ==========================================

  // Create Global Tag (couple_id = NULL)
  createGlobalTag: async (req, res) => {
    try {
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ message: "Nama tag wajib." });

      const { data, error } = await supabase
        .from('m_tags')
        .insert({
          name,
          color: color || '#000000',
          couple_id: null // PENTING: Null artinya Global
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "Global Tag berhasil dibuat", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Delete Tag (Hati-hati, admin bisa hapus tag apapun)
  deleteTag: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('m_tags').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "Tag berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [GET] List All Users (Pagination simple)
  getAllUsers: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const { data, error, count } = await supabase
        .from('auth_users')
        .select('id, email, display_name, created_at, avatar_url', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      res.json({
        message: "Data Users",
        page: parseInt(page),
        total_data: count,
        data
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [GET] List All Couples
  getAllCouples: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const { data, error, count } = await supabase
        .from('couples')
        .select('id, name, created_at, invite_code', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      res.json({
        message: "Data Couples",
        page: parseInt(page),
        total_data: count,
        data
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [DELETE] Ban/Hapus User (Hati-hati!)
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params; // ID User yang mau dihapus

      // Hapus dari tabel auth_users kita
      // Note: Idealnya hapus juga dari supabase.auth.admin.deleteUser(id) 
      // tapi itu butuh Service Role Key (akses level dewa).
      // Untuk MVP, hapus dari tabel kita sudah cukup memutus akses data.
      
      const { error } = await supabase.from('auth_users').delete().eq('id', id);
      
      if (error) throw error;
      res.json({ message: "User berhasil dihapus dari sistem." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = adminController;
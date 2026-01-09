const supabase = require('../config/supabase');

const visitController = {
  // [POST] TAMBAH REVIEW (Check-in)
  addVisit: async (req, res) => {
    try {
      const userId = req.user.id;
      const { place_id, rating, review_text, repeat_order, photo_urls, visit_date } = req.body;

      if (!place_id || !rating) {
        return res.status(400).json({ message: "Place ID dan Rating wajib diisi." });
      }

      // 1. Validasi: Pastikan tempat ini milik couple si user
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.status(403).json({ message: "Akses ditolak." });

      // 2. Insert ke tabel visits
      const { data, error } = await supabase
        .from('visits')
        .insert({
          place_id,
          user_id: userId,
          rating,
          review_text,
          repeat_order: repeat_order || false,
          photo_urls: photo_urls || [], // Array URL foto
          visit_date: visit_date || new Date()
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ 
        message: "Kunjungan berhasil dicatat! Masuk ke History.", 
        data 
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [GET] RIWAYAT KUNJUNGAN
  getHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.json({ data: [] });

      // Ambil Places yang SUDAH pernah dikunjungi (punya relasi ke visits)
      // Kita pakai teknik inner join (!inner) biar yang belum dikunjungi ga muncul
      const { data, error } = await supabase
        .from('places')
        .select(`
          *,
          m_categories(name, icon),
          visits!inner (
            id, rating, review_text, visit_date, photo_urls
          )
        `)
        .eq('couple_id', member.couple_id)
        .order('visit_date', { foreignTable: 'visits', ascending: false });

      if (error) throw error;

      res.json({ data });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = visitController;
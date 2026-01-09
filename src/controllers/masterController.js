const supabase = require('../config/supabase');

const masterController = {
  // GET Categories
  getCategories: async (req, res) => {
    const { data, error } = await supabase.from('m_categories').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },

  // GET Price Ranges
  getPrices: async (req, res) => {
    const { data, error } = await supabase.from('m_price_ranges').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  },

  // GET Tags (Global + Custom)
  getTags: async (req, res) => {
    try {
      const userId = req.user.id;

      // 1. Ambil Couple ID User
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();
      
      const coupleId = member ? member.couple_id : null;

      // 2. Query Hybrid: Ambil yang Global (NULL) ATAU Custom (couple_id user)
      let query = supabase.from('m_tags').select('*');

      if (coupleId) {
        // Syntax .or di Supabase agak unik: column.operator.value
        query = query.or(`couple_id.is.null,couple_id.eq.${coupleId}`);
      } else {
        query = query.is('couple_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ data });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // CREATE Custom Tag
  createTag: async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, color } = req.body;

      if (!name) return res.status(400).json({ message: "Nama Tag wajib diisi" });

      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.status(400).json({ message: "User belum punya couple" });

      const { data, error } = await supabase
        .from('m_tags')
        .insert({
          name,
          color: color || '#FFC0CB', // Default pink kalau gak diisi
          couple_id: member.couple_id // Menandakan ini Custom Tag
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "Tag kustom berhasil dibuat", data });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = masterController;
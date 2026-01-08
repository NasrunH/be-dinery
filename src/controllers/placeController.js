const supabase = require('../config/supabase');
const scraperService = require('../services/scraperService');

const placeController = {
  // [POST] /api/places/preview
  // User paste link -> System return Judul & Foto
  previewLink: async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: "URL wajib diisi" });

      const metadata = await scraperService.getMetadata(url);
      
      res.json({
        message: "Preview berhasil",
        data: metadata
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // [POST] /api/places
  // Simpan tempat ke Wishlist
  addPlace: async (req, res) => {
    try {
      const { 
        name, target_menu, 
        original_link, meta_title, meta_image, platform,
        category_id, price_range_id,
        lat, long, address_text 
      } = req.body;
      
      const userId = req.user.id;

      // 1. Cari couple_id milik user ini
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.status(403).json({ message: "Kamu belum memiliki pasangan (Couple)." });
      }

      // 2. Siapkan Object Lokasi (PostGIS Point)
      // Format WKT (Well-Known Text): 'POINT(longitude latitude)'
      const locationPoint = (lat && long) ? `POINT(${long} ${lat})` : null;

      // 3. Insert ke Supabase
      const { data, error } = await supabase
        .from('places')
        .insert({
          couple_id: member.couple_id,
          created_by: userId,
          name: name || meta_title, // Pakai meta_title kalau nama kosong
          target_menu,
          original_link,
          platform,
          meta_title,
          meta_image,
          category_id,
          price_range_id,
          location: locationPoint, // Supabase akan otomatis convert string ini ke geography
          address_text
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: "Tempat berhasil disimpan ke Wishlist!",
        data
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Gagal menyimpan tempat", detail: err.message });
    }
  }
};

module.exports = placeController;
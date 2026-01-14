const supabase = require('../config/supabase');
const scraperService = require('../services/scraperService');
const geoService = require('../services/geoService');
const sendNotification = require('../utils/notificationHelper');

const placeController = {
  
  // ==========================================
  // 1. PREVIEW LINK (Scraping)
  // ==========================================
  preview: async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: "URL wajib diisi" });

      const data = await scraperService.getMetadata(url);
      res.json({ message: "Preview didapatkan", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 2. ADD PLACE (Simpan Wishlist + Tags)
  // ==========================================
  addPlace: async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        name, target_menu, 
        original_link, platform, meta_title, meta_image,
        maps_link, address_text, 
        category_id, price_range_id,
        tag_ids // Array of ID [1, 3]
      } = req.body;

      // 1. Cek Couple ID
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.status(400).json({ message: "Couple tidak ditemukan." });

      // 2. Auto-Detect Koordinat
      let locationPoint = null;
      if (maps_link) {
        const coords = await geoService.extractCoordinates(maps_link);
        if (coords) locationPoint = `POINT(${coords.long} ${coords.lat})`;
      }

      // 3. Insert Tempat
      const { data: placeData, error: placeError } = await supabase
        .from('places')
        .insert({
          couple_id: member.couple_id,
          created_by: userId,
          name: name || meta_title || 'Tanpa Nama',
          target_menu,
          original_link, platform, meta_title, meta_image,
          maps_link, address_text, location: locationPoint,
          category_id, price_range_id
        })
        .select()
        .single();

      if (placeError) throw placeError;

      // 4. Insert Tags (Jika ada)
      if (tag_ids && tag_ids.length > 0) {
        const tagInsertData = tag_ids.map(tagId => ({
          place_id: placeData.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase.from('place_tags').insert(tagInsertData);
        if (tagError) console.error("Gagal simpan tags:", tagError.message);
      }

      // 5. Kirim Notifikasi
      const { data: userData } = await supabase.from('auth_users').select('display_name').eq('id', userId).single();
      const senderName = userData?.display_name || "Pasanganmu";

      await sendNotification(
        userId,
        "Wishlist Baru! 😋",
        `${senderName} menambahkan '${name || meta_title}' ke wishlist. Cek yuk!`,
        "wishlist",
        placeData.id
      );

      res.status(201).json({ 
        message: "Berhasil disimpan ke Wishlist!", 
        data: placeData 
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 3. UPDATE PLACE (Edit + Update Tags)
  // ==========================================
  updatePlace: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { 
        name, target_menu, category_id, price_range_id, 
        maps_link, address_text,
        tag_ids // Array ID Tag Baru
      } = req.body;

      // 1. Validasi Kepemilikan
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.status(403).json({ message: "Akses ditolak." });

      // 2. Update Koordinat jika maps berubah
      let locationPoint = undefined;
      if (maps_link) {
        const coords = await geoService.extractCoordinates(maps_link);
        if (coords) locationPoint = `POINT(${coords.long} ${coords.lat})`;
      }

      // 3. Update Data Utama
      const { error: updateError } = await supabase
        .from('places')
        .update({
          name, target_menu, category_id, price_range_id, maps_link, address_text,
          ...(locationPoint && { location: locationPoint })
        })
        .eq('id', id)
        .eq('couple_id', member.couple_id);

      if (updateError) throw updateError;

      // 4. Update Tags (Hapus Lama -> Ganti Baru)
      if (tag_ids) {
        // A. Hapus tag lama
        await supabase.from('place_tags').delete().eq('place_id', id);

        // B. Insert tag baru
        if (tag_ids.length > 0) {
          const tagInsertData = tag_ids.map(tagId => ({
            place_id: id,
            tag_id: tagId
          }));
          await supabase.from('place_tags').insert(tagInsertData);
        }
      }

      // 5. Re-fetch Data Lengkap
      const { data: finalData, error: fetchError } = await supabase
        .from('places')
        .select(`
          *,
          m_categories(name, icon),
          m_price_ranges(label),
          place_tags (
            m_tags (id, name, color)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Formatting JSON Tags
      if (finalData.place_tags) {
        finalData.tags = finalData.place_tags.map(pt => pt.m_tags);
        delete finalData.place_tags;
      }

      res.json({ message: "Data tempat berhasil diperbarui!", data: finalData });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 4. GET WISHLIST (List + Tags)
  // ==========================================
  getWishlist: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.json({ data: [] });

      const { data, error } = await supabase
        .from('places')
        .select(`
          *,
          m_categories(name, icon),
          m_price_ranges(label),
          place_tags (
            m_tags (id, name, color)
          )
        `)
        .eq('couple_id', member.couple_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Formatting JSON Tags
      const formattedData = data.map(place => ({
        ...place,
        tags: place.place_tags.map(pt => pt.m_tags)
      }));

      res.json({ data: formattedData });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 5. GET DETAIL (Secure + Visits Included)
  // ==========================================
  getDetail: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 1. Cek Couple ID User (Security Check)
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.status(403).json({ message: "Akses ditolak. Anda tidak memiliki pasangan." });

      // 2. Query Detail (Wajib filter by couple_id & id)
      const { data, error } = await supabase
        .from('places')
        .select(`
            *,
            m_categories(name, icon),
            m_price_ranges(label, description),
            created_by_user:auth_users!created_by(display_name),
            place_tags (
              m_tags (id, name, color)
            ),
            visits (
              id, rating, review_text, repeat_order, visit_date, photo_urls,
              user:auth_users (display_name, avatar_url)
            )
        `)
        .eq('id', id)
        .eq('couple_id', member.couple_id) // <--- PENGECEKAN KEAMANAN (Hanya milik couple ini)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: "Data tidak ditemukan atau Anda tidak memiliki akses." });
      }
      
      // Formatting Tags
      if (data.place_tags) {
        data.tags = data.place_tags.map(pt => pt.m_tags);
        delete data.place_tags;
      }

      // Formatting Visits (Sort Terbaru)
      if (data.visits) {
        data.visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      }

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 6. DELETE PLACE
  // ==========================================
  deletePlace: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.status(403).json({ message: "Akses ditolak." });

      const { error } = await supabase
        .from('places')
        .delete()
        .eq('id', id)
        .eq('couple_id', member.couple_id);

      if (error) throw error;

      res.json({ message: "Tempat berhasil dihapus dari Wishlist." });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 7. GET NEARBY (Radius)
  // ==========================================
  getNearby: async (req, res) => {
    try {
      const userId = req.user.id;
      const { lat, long, radius } = req.query; 

      if (!lat || !long) return res.status(400).json({ message: "Koordinat wajib diisi." });

      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.status(400).json({ message: "Couple tidak ditemukan." });

      const radiusMeters = radius ? parseFloat(radius) * 1000 : 5000;

      const { data, error } = await supabase.rpc('get_nearby_places', {
        user_lat: parseFloat(lat),
        user_long: parseFloat(long),
        radius_meters: radiusMeters,
        filter_couple_id: member.couple_id
      });

      if (error) throw error;

      res.json({
        message: `Ditemukan ${data.length} tempat di sekitar kamu`,
        search_params: { lat, long, radius_km: radiusMeters / 1000 },
        data
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 8. GACHA (Randomizer)
  // ==========================================
  gacha: async (req, res) => {
    try {
      const userId = req.user.id;
      const { category_id, price_range_id } = req.query;

      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.status(400).json({ message: "Couple tidak ditemukan." });

      let query = supabase
        .from('places')
        .select(`*, visits(id), m_categories(name), m_price_ranges(label)`)
        .eq('couple_id', member.couple_id);

      if (category_id) query = query.eq('category_id', category_id);
      if (price_range_id) query = query.eq('price_range_id', price_range_id);

      const { data, error } = await query;
      if (error) throw error;

      // Filter: Hanya yang belum dikunjungi
      const wishlist = data.filter(place => place.visits.length === 0);

      if (wishlist.length === 0) {
        return res.status(404).json({ message: "Tidak ada wishlist yang cocok untuk digacha." });
      }

      const randomIndex = Math.floor(Math.random() * wishlist.length);
      const winner = wishlist[randomIndex];

      res.json({
        message: "🎉 PEMENANG GACHA DITENTUKAN! 🎉",
        winner_data: winner
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = placeController;
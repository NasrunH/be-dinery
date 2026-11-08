const supabase = require('../config/supabase');
const scraperService = require('../services/scraperService');
const geoService = require('../services/geoService');
const imageService = require('../services/imageService');
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

      // Jika URL Google Maps, auto-resolve alamat dan koordinat langsung
      const isMaps = url.includes('google.com/maps') || url.includes('goo.gl') || url.includes('share.google');
      if (isMaps || data.platform === 'Google Maps') {
        const resolved = await geoService.resolveLocationAndAddress(url);
        if (resolved) {
          data.address_text = resolved.address_text || null;
          data.lat = resolved.lat || null;
          data.long = resolved.long || null;

          if (resolved.finalUrl) {
            const match = resolved.finalUrl.match(/\/maps\/place\/([^/?#]+)/);
            if (match && match[1]) {
              let decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
              decoded = decoded.replace(/@.*$/, '').trim();
              const parts = decoded.split(/[,·•\uFFFD]/);
              if (parts.length > 0 && parts[0].trim()) {
                data.suggested_name = parts[0].trim();
              }
            }
          }
        }
      }

      res.json({ message: "Preview didapatkan", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 1B. RESOLVE MAPS (Auto-detect Address & Location)
  // ==========================================
  resolveMaps: async (req, res) => {
    try {
      const { maps_link, location, lat, long } = req.body;
      if (!maps_link && !location && (lat === undefined || long === undefined)) {
        return res.status(400).json({ message: "maps_link, location, atau lat/long wajib diisi" });
      }

      let resolved = null;
      let cleanSuggestedName = "";

      if (maps_link) {
        resolved = await geoService.resolveLocationAndAddress(maps_link);
        if (resolved?.finalUrl) {
          try {
            const match = resolved.finalUrl.match(/\/maps\/place\/([^/?#]+)/);
            if (match && match[1]) {
              let decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
              decoded = decoded.replace(/@.*$/, '').trim();
              const parts = decoded.split(/[,·•\uFFFD]/);
              if (parts.length > 0 && parts[0].trim()) {
                cleanSuggestedName = parts[0].trim();
              }
            }
          } catch {}
        }
      }

      let address = resolved?.address_text || null;
      let targetLat = resolved?.lat || null;
      let targetLong = resolved?.long || null;

      // Jika belum dapat alamat tapi ada location atau lat/long
      if (!address && (location || (lat !== undefined && long !== undefined))) {
        address = await geoService.resolveAddressFromCoordsOrLocation(location, maps_link);
        if (!targetLat || !targetLong) {
          const parsed = geoService.parseLocation(location) || (lat && long ? { lat: parseFloat(lat), long: parseFloat(long) } : null);
          if (parsed && geoService.isValidIndo(parsed.lat, parsed.long)) {
            targetLat = parsed.lat;
            targetLong = parsed.long;
          }
        }
      }

      res.json({
        message: address ? "Maps & Alamat berhasil dideteksi" : "Maps berhasil dideteksi",
        data: {
          address_text: address && !geoService.isForeignAddress(address) ? address : null,
          lat: targetLat,
          long: targetLong,
          suggested_name: cleanSuggestedName || null
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ==========================================
  // 1C. REVERSE GEOCODE (Backend OpenStreetMap)
  // ==========================================
  reverseGeocode: async (req, res) => {
    try {
      const { lat, long, location, maps_link } = req.body;
      let targetLat = typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null);
      let targetLong = typeof long === 'number' ? long : (long ? parseFloat(long) : null);

      let address = null;

      // 1. Jika koordinat lat & long langsung dikirim
      if (targetLat !== null && targetLong !== null && geoService.isValidIndo(targetLat, targetLong)) {
        address = await geoService.reverseGeocode(targetLat, targetLong);
      } 
      // 2. Jika location (PostGIS Point) atau maps_link dikirim
      else if (location || maps_link) {
        address = await geoService.resolveAddressFromCoordsOrLocation(location, maps_link);
        const parsedCoords = geoService.parseLocation(location);
        if (parsedCoords) {
          targetLat = parsedCoords.lat;
          targetLong = parsedCoords.long;
        }
      }

      res.json({
        message: address ? "Alamat berhasil didapatkan via Backend Geocoding" : "Alamat tidak ditemukan",
        data: {
          address_text: address && !geoService.isForeignAddress(address) ? address : null,
          lat: targetLat,
          long: targetLong
        }
      });
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

      // 2. Auto-Detect Koordinat & Alamat Otomatis dari Google Maps
      let locationPoint = null;
      let finalAddressText = (address_text && !geoService.isForeignAddress(address_text)) ? address_text : null;
      if (maps_link) {
        const resolved = await geoService.resolveLocationAndAddress(maps_link);
        if (resolved) {
          if (resolved.lat && resolved.long && geoService.isValidIndo(resolved.lat, resolved.long)) {
            locationPoint = `POINT(${resolved.long} ${resolved.lat})`;
          }
          if (!finalAddressText && resolved.address_text && !geoService.isForeignAddress(resolved.address_text)) {
            finalAddressText = resolved.address_text;
          }
        }
      }

      // Auto-compress meta_image ke WebP Base64 agar tersimpan permanen
      let finalMetaImage = meta_image;
      if (finalMetaImage && finalMetaImage.startsWith('http')) {
        const compressed = await imageService.compressUrlToWebpBase64(finalMetaImage);
        if (compressed) finalMetaImage = compressed;
      }

      // 3. Insert Tempat
      const { data: placeData, error: placeError } = await supabase
        .from('places')
        .insert({
          couple_id: member.couple_id,
          created_by: userId,
          name: name || meta_title || 'Tanpa Nama',
          target_menu,
          original_link, platform, meta_title, 
          meta_image: finalMetaImage,
          maps_link, address_text: finalAddressText, location: locationPoint,
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
        maps_link, address_text, original_link,
        tag_ids // Array ID Tag Baru
      } = req.body;

      // 1. Validasi Kepemilikan
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) return res.status(403).json({ message: "Akses ditolak." });

      // 2. Update Koordinat & Alamat jika maps berubah
      let locationPoint = undefined;
      let finalAddressText = (address_text && !geoService.isForeignAddress(address_text)) ? address_text : undefined;
      if (maps_link) {
        const resolved = await geoService.resolveLocationAndAddress(maps_link);
        if (resolved) {
          if (resolved.lat && resolved.long && geoService.isValidIndo(resolved.lat, resolved.long)) {
            locationPoint = `POINT(${resolved.long} ${resolved.lat})`;
          }
          if (!finalAddressText && resolved.address_text && !geoService.isForeignAddress(resolved.address_text)) {
            finalAddressText = resolved.address_text;
          }
        }
      }

      // 3. Update Data Utama
      const { error: updateError } = await supabase
        .from('places')
        .update({
          name, target_menu, category_id, price_range_id, maps_link,
          ...(original_link !== undefined && { original_link }),
          ...(finalAddressText && { address_text: finalAddressText }),
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
          ),
          visits (
            id, rating, visit_date
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

      // Auto-resolve address_text jika masih kosong atau tidak akurat (Amerika/Virginia)
      const isBadAddress = !data.address_text || 
        data.address_text.trim() === '' ||
        geoService.isForeignAddress(data.address_text);

      if (isBadAddress) {
        // Hapus alamat asing/cacat agar tidak pernah dikirim ke user
        data.address_text = null;
        try {
          let resolvedAddress = null;
          let resolvedLat = null;
          let resolvedLong = null;

          if (data.maps_link) {
            const resolved = await geoService.resolveLocationAndAddress(data.maps_link);
            if (resolved) {
              if (resolved.address_text && !geoService.isForeignAddress(resolved.address_text)) {
                resolvedAddress = resolved.address_text;
              }
              if (resolved.lat && resolved.long && geoService.isValidIndo(resolved.lat, resolved.long)) {
                resolvedLat = resolved.lat;
                resolvedLong = resolved.long;
              }
            }
          }

          // Jika belum dapat alamat dari maps_link tapi ada location Point PostGIS
          if (!resolvedAddress && data.location) {
            resolvedAddress = await geoService.resolveAddressFromCoordsOrLocation(data.location, data.maps_link);
          }

          const updatePayload = {};
          if (resolvedAddress && !geoService.isForeignAddress(resolvedAddress)) {
            data.address_text = resolvedAddress;
            updatePayload.address_text = resolvedAddress;
          }
          if (resolvedLat && resolvedLong) {
            updatePayload.location = `POINT(${resolvedLong} ${resolvedLat})`;
          }

          if (Object.keys(updatePayload).length > 0) {
            await supabase.from('places').update(updatePayload).eq('id', id);
          }
        } catch (err) {
          console.warn('Auto resolve address in getDetail error:', err.message);
        }
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
  // 8. GACHA (Randomizer dengan Filter Radius & Jarak)
  // ==========================================
  gacha: async (req, res) => {
    try {
      const userId = req.user.id;
      const { category_id, price_range_id, lat, long, radius } = req.query;

      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      if (!member) return res.status(400).json({ message: "Couple tidak ditemukan." });

      let query = supabase
        .from('places')
        .select(`*, visits(id), m_categories(name, icon), m_price_ranges(label)`)
        .eq('couple_id', member.couple_id);

      if (category_id) query = query.eq('category_id', category_id);
      if (price_range_id) query = query.eq('price_range_id', price_range_id);

      const { data, error } = await query;
      if (error) throw error;

      // Filter: Hanya yang belum dikunjungi
      let wishlist = data.filter(place => place.visits.length === 0);

      // Filter Radius jika koordinat user & radius diberikan
      const userLat = lat ? parseFloat(lat) : null;
      const userLong = long ? parseFloat(long) : null;
      const radiusKm = radius ? parseFloat(radius) : null;

      if (userLat !== null && userLong !== null && !isNaN(userLat) && !isNaN(userLong)) {
        wishlist = wishlist.map(place => {
          const coords = geoService.parseLocation(place.location);
          if (coords) {
            const dist = geoService.calculateDistance(userLat, userLong, coords.lat, coords.long);
            return {
              ...place,
              distance_km: dist !== null ? Math.round(dist * 10) / 10 : null,
              distance_meters: dist !== null ? Math.round(dist * 1000) : null
            };
          }
          return { ...place, distance_km: null, distance_meters: null };
        });

        // Jika radius dipilih (misal 3, 5, 10 km)
        if (radiusKm && !isNaN(radiusKm)) {
          wishlist = wishlist.filter(p => p.distance_km !== null && p.distance_km <= radiusKm);
        }
      }

      if (wishlist.length === 0) {
        return res.status(404).json({ 
          message: radiusKm 
            ? `Tidak ada tempat wishlist yang cocok dalam radius ${radiusKm} km. Coba perbesar radiusnya ya!` 
            : "Tidak ada wishlist yang cocok untuk digacha." 
        });
      }

      const randomIndex = Math.floor(Math.random() * wishlist.length);
      const winner = wishlist[randomIndex];

      res.json({
        message: "🎉 PEMENANG GACHA DITENTUKAN! 🎉",
        winner_data: winner,
        total_candidates: wishlist.length
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  // ==========================================
  // 7. SYNC MISSING / INVALID ADDRESSES (Batch Service)
  // ==========================================
  syncAddresses: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).single();
      const coupleId = member ? member.couple_id : null;

      let query = supabase.from('places').select('id, name, maps_link, address_text, location');
      if (coupleId) {
        query = query.eq('couple_id', coupleId);
      }

      const { data: places, error } = await query;
      if (error) throw error;

      const needsSync = places.filter(p => 
        !p.address_text || 
        p.address_text.trim() === '' || 
        geoService.isForeignAddress(p.address_text)
      );

      console.log(`[syncAddresses] Total places needing sync: ${needsSync.length}`);

      const results = [];
      for (const p of needsSync) {
        let resolved = null;
        if (p.maps_link) {
          resolved = await geoService.resolveLocationAndAddress(p.maps_link);
        }

        let resolvedAddress = resolved?.address_text;
        if (!resolvedAddress && p.location) {
          resolvedAddress = await geoService.resolveAddressFromCoordsOrLocation(p.location, p.maps_link);
        }

        const updatePayload = {};
        if (resolvedAddress && !geoService.isForeignAddress(resolvedAddress)) {
          updatePayload.address_text = resolvedAddress;
        } else if (geoService.isForeignAddress(p.address_text)) {
          updatePayload.address_text = null;
        }
        if (resolved?.lat && resolved?.long && geoService.isValidIndo(resolved.lat, resolved.long)) {
          updatePayload.location = `POINT(${resolved.long} ${resolved.lat})`;
        }
        if (Object.keys(updatePayload).length > 0) {
          await supabase.from('places').update(updatePayload).eq('id', p.id);
          results.push({ id: p.id, name: p.name, ...updatePayload });
        }
      }

      res.json({
        message: `Sinkronisasi alamat selesai. ${results.length} tempat berhasil diperbarui.`,
        synced_count: results.length,
        total_checked: needsSync.length,
        data: results
      });
    } catch (err) {
      console.error('[placeController.syncAddresses] Error:', err);
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = placeController;
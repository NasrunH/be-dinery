const supabase = require('../config/supabase');

const dashboardController = {
  // GET /api/dashboard/summary
  // Versi: POWERFUL (Stats + Insights + Recent Activity)
  getSummary: async (req, res) => {
    try {
      const userId = req.user.id;

      // 1. Ambil Couple ID User
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      // Default jika user jomblo / belum bind
      if (!member) {
        return res.json({
          status: "success",
          data: {
            stats: { wishlist_count: 0, visited_count: 0 },
            insights: { top_categories: [], total_spending_estimate: 0 },
            recent: { last_visited: null, new_wishlists: [] },
            unread_notif: 0
          }
        });
      }

      const coupleId = member.couple_id;

      // 2. QUERY PARALEL (Heavy Lifting di sini)
      // Kita jalankan 5 query sekaligus biar ngebut
      const [
        allPlacesRes,     // Untuk hitung total wishlist & kontribusi
        visitedPlacesRes, // Untuk hitung kategori favorit & estimasi harga
        recentWishlistRes,// 3 Wishlist terbaru
        lastVisitRes,     // 1 History terakhir
        unreadNotifRes    // Notifikasi
      ] = await Promise.all([
        
        // Query A: Semua Places (id, visits, created_by)
        supabase
          .from('places')
          .select('id, created_by, visits(id)')
          .eq('couple_id', coupleId),

        // Query B: Places yang SUDAH dikunjungi (Join Kategori & Harga)
        // Kita butuh ini untuk analitik "Kebiasaan Makan"
        supabase
          .from('visits')
          .select(`
            id, 
            places!inner (
              category_id, 
              price_range_id,
              m_categories(name),
              m_price_ranges(label)
            )
          `)
          .eq('places.couple_id', coupleId),

        // Query C: 3 Wishlist Terbaru (Biar ingat mau kemana)
        // Syarat: visits-nya kosong (belum dikunjungi)
        supabase
          .from('places')
          .select('id, name, meta_image, created_at, visits(id)')
          .eq('couple_id', coupleId)
          .order('created_at', { ascending: false })
          .range(0, 20), // Ambil agak banyak dulu, nanti filter di JS

        // Query D: Last Visited Place
        supabase
          .from('visits')
          .select(`
            visit_date, rating, review_text,
            places!inner (id, name, meta_image)
          `)
          .eq('places.couple_id', coupleId)
          .order('visit_date', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Query E: Notifikasi
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
      ]);

      // ==========================================
      // 3. DATA PROCESSING (JS Logic)
      // ==========================================

      // A. Statistik Dasar
      const allPlaces = allPlacesRes.data || [];
      const wishlistItems = allPlaces.filter(p => p.visits.length === 0);
      const visitedItems = allPlaces.filter(p => p.visits.length > 0);

      // B. Insight: Top Categories (Favorit Makan Apa?)
      // Kita hitung frekuensi kategori dari visitedPlacesRes
      const visitsData = visitedPlacesRes.data || [];
      const categoryMap = {};
      
      visitsData.forEach(v => {
        const catName = v.places?.m_categories?.name || 'Lainnya';
        categoryMap[catName] = (categoryMap[catName] || 0) + 1;
      });

      // Sortir dan ambil Top 3
      const topCategories = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a) // Urutkan dari terbanyak
        .slice(0, 3) // Ambil 3 besar
        .map(([name, count]) => ({ name, count }));

      // C. Insight: Estimasi Pengeluaran (Gamification)
      // Asumsi: $ = 50k, $$ = 100k, $$$ = 200k (Bisa disesuaikan)
      let totalEstimate = 0;
      visitsData.forEach(v => {
        const priceLabel = v.places?.m_price_ranges?.label; // $, $$, $$$
        if (priceLabel === '$') totalEstimate += 50000;
        else if (priceLabel === '$$') totalEstimate += 100000;
        else if (priceLabel === '$$$') totalEstimate += 200000;
        else totalEstimate += 50000; // Default
      });

      // D. Recent Wishlist (Filter manual karena Supabase filter relation agak ribet)
      const recentWishlistRaw = recentWishlistRes.data || [];
      const recentWishlist = recentWishlistRaw
        .filter(p => p.visits.length === 0) // Pastikan belum visited
        .slice(0, 3) // Ambil 3 teratas
        .map(p => ({
          id: p.id,
          name: p.name,
          image: p.meta_image,
          added_at: p.created_at
        }));

      // E. Last Visited Formatting
      const lastVisitData = lastVisitRes.data ? {
        id: lastVisitRes.data.places.id,
        name: lastVisitRes.data.places.name,
        image: lastVisitRes.data.places.meta_image,
        rating: lastVisitRes.data.rating,
        date: lastVisitRes.data.visit_date
      } : null;

      // ==========================================
      // 4. RETURN RESPONSE
      // ==========================================
      res.json({
        status: "success",
        data: {
          // Angka-angka Utama
          stats: {
            wishlist_count: wishlistItems.length,
            visited_count: visitedItems.length,
            total_places: allPlaces.length
          },
          
          // Wawasan Menarik (Biar user senyum)
          insights: {
            top_categories: topCategories, // Contoh: [{name: "Bakso", count: 5}, ...]
            spending_estimate_idr: totalEstimate, // Contoh: 1500000
            couple_level: visitedItems.length > 10 ? "Couple Sultan 👑" : "Couple Pemula 🌱"
          },

          // Aktivitas Terkini (Untuk List Horizontal di Home)
          recent: {
            last_visited: lastVisitData,
            new_wishlists: recentWishlist
          },

          unread_notif: unreadNotifRes.count || 0
        }
      });

    } catch (err) {
      console.error("[Dashboard Error]:", err);
      res.status(500).json({ status: "error", message: err.message });
    }
  }
};

module.exports = dashboardController;
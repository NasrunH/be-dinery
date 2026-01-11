const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // 1. HTTP REQUEST (Handle Redirect & Ambil HTML)
      try {
        const response = await axios.get(mapsLink, {
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        finalUrl = response.request.res.responseUrl || mapsLink;
        htmlContent = response.data;
        console.log(`[GeoService] ➡️  Link Akhir: ${finalUrl}`);
      } catch (err) {
        console.error(`[GeoService] ⚠️ Gagal fetch URL: ${err.message}`);
        return null;
      }

      // ==========================================
      // STRATEGI 1: CEK URL (Pola Umum)
      // ==========================================
      let lat = null, long = null;

      const regexPatterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,       // @-7.123,110.123
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,   // !3d...!4d...
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,  // ?q=...
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ?ll=...
        /sll=(-?\d+\.\d+),(-?\d+\.\d+)/     // sll=...
      ];

      for (const regex of regexPatterns) {
        const match = finalUrl.match(regex);
        if (match) {
          lat = parseFloat(match[1]);
          long = parseFloat(match[2]);
          console.log(`[GeoService] ✅ Koordinat ditemukan di URL (Pola: ${regex})`);
          break;
        }
      }

      // ==========================================
      // STRATEGI 2: CEK HTML BODY (Fallback Kuat)
      // ==========================================
      
      if (!lat || !long) {
        console.log("[GeoService] ⚠️ URL clean, mencoba bedah HTML...");

        // A. Cek Meta Tag (og:image) - Seringkali berisi static map
        // Pattern: center=-7.123,110.123 atau center=-7.123%2C110.123
        const metaRegex = /content=".*?center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/;
        const metaMatch = htmlContent.match(metaRegex);

        if (metaMatch) {
          lat = parseFloat(metaMatch[1]);
          long = parseFloat(metaMatch[2]);
          console.log(`[GeoService] ✅ Koordinat ditemukan di Meta Tag`);
        } 
        
        // B. Cek Script JSON (Pola [null, null, lat, long])
        // Ini adalah pola internal Google Maps untuk detail lokasi
        else {
          // Cari pola: [null, null, -7.xxx, 110.xxx]
          const deepJsonRegex = /\[\s*null\s*,\s*null\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/;
          const deepMatch = htmlContent.match(deepJsonRegex);

          if (deepMatch) {
            lat = parseFloat(deepMatch[1]);
            long = parseFloat(deepMatch[2]);
            console.log(`[GeoService] ✅ Koordinat ditemukan di Deep JSON: ${lat}, ${long}`);
          }
          
          // C. Fallback Terakhir: Cari SEMUA pola [angka, angka]
          else {
            console.log("[GeoService] ⚠️ Mencoba scan semua array angka...");
            // Regex: [ -7.1234, 110.1234 ]
            // Menangkap angka desimal dengan presisi minimal 4 digit agar tidak menangkap tahun/ID
            const allMatches = [...htmlContent.matchAll(/\[\s*(-?\d+\.\d{4,})\s*,\s*(-?\d+\.\d{4,})\s*\]/g)];
            
            for (const m of allMatches) {
              const tempLat = parseFloat(m[1]);
              const tempLong = parseFloat(m[2]);

              // Filter Validasi Geografis (Valid Lat/Long Bumi)
              if (tempLat >= -90 && tempLat <= 90 && tempLong >= -180 && tempLong <= 180) {
                  // Prioritas: Koordinat Indonesia (Lat -11 s/d 6, Long 95 s/d 141)
                  // Biar gak salah ambil koordinat default Google (US/Europe)
                  if (tempLat >= -11 && tempLat <= 6 && tempLong >= 95 && tempLong <= 141) {
                    lat = tempLat;
                    long = tempLong;
                    console.log(`[GeoService] ✅ Koordinat ditemukan (Heuristic ID): ${lat}, ${long}`);
                    break;
                  }
                  
                  // Jika belum ketemu yg Indonesia, simpan yang valid bumi dulu
                  if (!lat) {
                    lat = tempLat;
                    long = tempLong;
                  }
              }
            }
          }
        }
      }

      // FINAL CHECK & RETURN
      if (lat && long) {
        return { lat, long };
      } else {
        console.log(`[GeoService] ❌ Gagal Total. HTML content length: ${htmlContent.length}`);
        // Log sebagian HTML untuk debug (optional)
        // console.log(htmlContent.substring(0, 500));
        return null;
      }

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
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
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });
        
        finalUrl = response.request.res.responseUrl || mapsLink;
        htmlContent = response.data;
        console.log(`[GeoService] ➡️  Link Akhir: ${finalUrl}`);
      } catch (err) {
        console.error(`[GeoService] ⚠️ Gagal fetch URL: ${err.message}`);
        return null;
      }

      let lat = null;
      let long = null;

      // ==========================================
      // STRATEGI 1: CEK URL (Paling Akurat)
      // ==========================================
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
          return { lat, long };
        }
      }

      // ==========================================
      // STRATEGI 2: AGGRESSIVE HTML SCAN (Fallback)
      // ==========================================
      console.log("[GeoService] ⚠️ URL clean, memulai scan HTML agresif...");

      // Regex ini mencari DUA angka desimal yang dipisahkan oleh koma dan spasi opsional
      // Contoh yang tertangkap:
      // [ -7.75, 110.40 ]
      // center=-7.75,110.40
      // "lat":-7.75,"lng":110.40
      // -7.75, 110.40
      
      const broadRegex = /(-?\d+\.\d{3,})\s*(?:,|%2C|\\u002C)\s*(-?\d+\.\d{3,})/g;
      
      const matches = [...htmlContent.matchAll(broadRegex)];
      
      // Kita cari kandidat yang Valid (Masuk akal sebagai koordinat Indonesia)
      // Batas Wilayah Indonesia (Kasar):
      // Lat: -11 (Selatan) s/d 6 (Utara)
      // Long: 95 (Barat) s/d 141 (Timur)
      
      for (const m of matches) {
        const tempLat = parseFloat(m[1]);
        const tempLong = parseFloat(m[2]);

        // 1. Cek apakah angka valid secara geografis
        if (tempLat >= -90 && tempLat <= 90 && tempLong >= -180 && tempLong <= 180) {
            
            // 2. Cek apakah masuk wilayah Indonesia (Prioritas Tinggi)
            if (tempLat >= -11 && tempLat <= 6 && tempLong >= 95 && tempLong <= 141) {
                lat = tempLat;
                long = tempLong;
                console.log(`[GeoService] 🎯 Koordinat Valid (Indonesia) ditemukan di HTML: ${lat}, ${long}`);
                break; // Ketemu satu yang pas, langsung ambil!
            }
        }
      }

      // Fallback jika tidak ada yang masuk range Indonesia, tapi ada angka valid bumi
      // (Misal user input lokasi di luar negeri)
      if (!lat && matches.length > 0) {
         for (const m of matches) {
            const tempLat = parseFloat(m[1]);
            const tempLong = parseFloat(m[2]);
            if (tempLat >= -90 && tempLat <= 90 && tempLong >= -180 && tempLong <= 180) {
                // Hindari koordinat 0,0 atau angka default Google
                if (tempLat !== 0 && tempLong !== 0) {
                    lat = tempLat;
                    long = tempLong;
                    console.log(`[GeoService] ⚠️ Koordinat Luar/Umum ditemukan: ${lat}, ${long}`);
                    break;
                }
            }
         }
      }

      if (lat && long) {
        return { lat, long };
      } else {
        console.log(`[GeoService] ❌ Gagal Total. Tidak ada pola angka koordinat yang valid.`);
        return null;
      }

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
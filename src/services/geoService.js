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
            // Wajib menyamar jadi Desktop Browser biar dapat full HTML
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        finalUrl = response.request.res.responseUrl || mapsLink;
        htmlContent = response.data; // Simpan HTML untuk fallback
        console.log(`[GeoService] ➡️  Link Akhir: ${finalUrl}`);
      } catch (err) {
        console.error(`[GeoService] ⚠️ Gagal fetch URL: ${err.message}`);
        return null;
      }

      // ==========================================
      // STRATEGI 1: CEK URL (Pola Umum)
      // ==========================================
      let lat = null, long = null;

      // Regex pola URL
      const regexPatterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,       // Pola @-7.123,110.123
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,   // Pola Data !3d...!4d...
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Pola Query ?q=...
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/  // Pola LongLat ?ll=...
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
      // Jika URL tidak ada koordinat (seperti kasus /maps/place/Nama...),
      // Google menyimpannya di dalam meta tags atau script JSON di HTML.
      
      if (!lat || !long) {
        console.log("[GeoService] ⚠️ URL tidak memuat koordinat, mencoba bedah HTML...");

        // 1. Cek Meta Tag (og:image / twitter:image)
        // Biasanya berisi link staticmap yang ada param center=lat,long
        const metaRegex = /content=".*?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/;
        const metaMatch = htmlContent.match(metaRegex);

        if (metaMatch) {
          lat = parseFloat(metaMatch[1]);
          long = parseFloat(metaMatch[2]);
          console.log(`[GeoService] ✅ Koordinat ditemukan di Meta Tag HTML`);
        } 
        
        // 2. Cek Script JSON (Window Initialization)
        // Mencari pola [null,null,-7.xxx,110.xxx] yang sering muncul di script Google
        else {
          // Pola: angka desimal, koma, angka desimal (yang masuk akal sebagai koordinat)
          // Kita cari pattern yang diawali tanda kurung siku biar lebih spesifik
          const jsonRegex = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/;
          
          // Cari semua kemungkinan match di HTML
          const allMatches = [...htmlContent.matchAll(/\[\s*(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})\s*\]/g)];
          
          for (const m of allMatches) {
            const tempLat = parseFloat(m[1]);
            const tempLong = parseFloat(m[2]);

            // Filter Validasi Sederhana (Biar gak ambil angka acak)
            // Lat: -90 s/d 90, Long: -180 s/d 180
            // Prioritas Koordinat Indonesia: Lat -11 s/d 6, Long 95 s/d 141
            if (tempLat >= -90 && tempLat <= 90 && tempLong >= -180 && tempLong <= 180) {
                // Ambil yang pertama kali valid
                lat = tempLat;
                long = tempLong;
                console.log(`[GeoService] ✅ Koordinat ditemukan di Script HTML: ${lat}, ${long}`);
                break;
            }
          }
        }
      }

      // FINAL CHECK
      if (lat && long) {
        return { lat, long };
      } else {
        console.log(`[GeoService] ❌ Gagal Total mengekstrak koordinat.`);
        return null;
      }

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
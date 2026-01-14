const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // 1. HTTP REQUEST (Desktop User Agent - Paling lengkap datanya)
      try {
        const response = await axios.get(mapsLink, {
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            // Gunakan User Agent Desktop Chrome terbaru agar Google merender full HTML
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        finalUrl = response.request.res.responseUrl || mapsLink;
        htmlContent = response.data;
        // console.log(`[GeoService] ➡️  Link Akhir: ${finalUrl}`);
      } catch (err) {
        console.error(`[GeoService] ⚠️ Gagal fetch URL: ${err.message}`);
        return null;
      }

      let lat = null;
      let long = null;

      // =================================================================
      // STRATEGI 1: CEK URL (Paling Akurat & Cepat)
      // =================================================================
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

      // =================================================================
      // STRATEGI 2: CEK DEEP JSON (Khas Google Maps Desktop)
      // =================================================================
      // Google menyimpan koordinat di array JSON: [null, null, lat, long]
      // Ini biasanya ada di dalam window.APP_INITIALIZATION_STATE
      
      console.log("[GeoService] ⚠️ URL clean, scan Deep JSON HTML...");

      // Regex untuk menangkap [null, null, -7.xxx, 110.xxx]
      // Toleransi spasi (\s*)
      const deepJsonRegex = /\[\s*null\s*,\s*null\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
      
      const deepMatches = [...htmlContent.matchAll(deepJsonRegex)];
      
      for (const m of deepMatches) {
        const tempLat = parseFloat(m[1]);
        const tempLong = parseFloat(m[2]);

        // Validasi Koordinat Indonesia
        // Lat: -11 s/d 6, Long: 95 s/d 141
        if (tempLat >= -11 && tempLat <= 6 && tempLong >= 95 && tempLong <= 141) {
            lat = tempLat;
            long = tempLong;
            console.log(`[GeoService] 🎯 Koordinat Valid (Deep JSON): ${lat}, ${long}`);
            return { lat, long };
        }
      }

      // =================================================================
      // STRATEGI 3: CEK META TAGS (Fallback jika JSON gagal)
      // =================================================================
      // Cari og:image atau twitter:image
      const metaImageRegex = /content="(https?:\/\/.*?maps\.google\.com.*?)"/;
      const metaMatch = htmlContent.match(metaImageRegex);

      if (metaMatch && metaMatch[1]) {
        const imageUrl = metaMatch[1];
        // Ekstrak center=lat,long
        const coordRegex = /[?&](?:center|markers)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/;
        const coordMatch = imageUrl.match(coordRegex);

        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          long = parseFloat(coordMatch[2]);
          console.log(`[GeoService] ✅ Koordinat ditemukan di Meta Image: ${lat}, ${long}`);
          return { lat, long };
        }
      }

      // =================================================================
      // STRATEGI 4: AGGRESSIVE SCAN (The Last Resort)
      // =================================================================
      // Cari sembarang pasangan angka desimal yang valid di Indonesia
      // Format: angka, angka (bisa dipisah koma, spasi, atau encoded char)
      
      console.log("[GeoService] ⚠️ JSON & Meta gagal, scan Brutal...");
      
      // Regex mencari: (angka desimal minimal 3 digit) pemisah (angka desimal minimal 3 digit)
      const broadRegex = /(-?\d+\.\d{3,})\s*(?:,|%2C|\\u002C|\s)\s*(-?\d+\.\d{3,})/g;
      const matches = [...htmlContent.matchAll(broadRegex)];
      
      for (const m of matches) {
        const tempLat = parseFloat(m[1]);
        const tempLong = parseFloat(m[2]);

        // Validasi Ketat Wilayah Indonesia
        // Lat: -11 s/d 6
        // Long: 95 s/d 141
        if (tempLat >= -11 && tempLat <= 6 && tempLong >= 95 && tempLong <= 141) {
            lat = tempLat;
            long = tempLong;
            console.log(`[GeoService] 🔍 Koordinat Heuristik (Indonesia): ${lat}, ${long}`);
            return { lat, long };
        }
      }

      if (lat && long) {
        return { lat, long };
      } else {
        console.log(`[GeoService] ❌ Gagal Total.`);
        return null;
      }

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
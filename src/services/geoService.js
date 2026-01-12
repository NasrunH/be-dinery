const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // 1. HTTP REQUEST
      // Trik: Kita menyamar sebagai "Facebook Bot" (facebookexternalhit).
      // Kenapa? Karena Google Maps PASTI memberikan HTML sederhana yang berisi 
      // meta tag koordinat akurat agar preview link muncul di Facebook/WhatsApp.
      try {
        const response = await axios.get(mapsLink, {
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
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
      // STRATEGI 1: CEK URL UTAMA (Jika redirect menghasilkan koordinat)
      // =================================================================
      const regexUrl = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchUrl = finalUrl.match(regexUrl);
      if (matchUrl) {
        lat = parseFloat(matchUrl[1]);
        long = parseFloat(matchUrl[2]);
        console.log(`[GeoService] ✅ Koordinat dari URL: ${lat}, ${long}`);
        return { lat, long };
      }

      // =================================================================
      // STRATEGI 2: CEK META TAG (Kunci untuk Link Mobile!)
      // =================================================================
      // Kita cari tag <meta property="og:image" content="...">
      // Isinya biasanya: https://maps.google.com/maps/api/staticmap?center=-7.76,110.37&zoom=...
      
      console.log("[GeoService] ⚠️ URL clean, mencari di Meta Tags (Mobile Strategy)...");

      // Cari URL gambar di dalam HTML
      const metaImageRegex = /property="og:image"\s+content="(.*?)"/;
      const metaMatch = htmlContent.match(metaImageRegex);

      if (metaMatch && metaMatch[1]) {
        const imageUrl = metaMatch[1];
        // console.log(`[GeoService] 🖼️  OG Image URL ditemukan: ${imageUrl}`);

        // Ekstrak 'center' atau 'markers' dari URL gambar tersebut
        // Pola: center=-7.123,110.123 atau center=-7.123%2C110.123
        const coordRegex = /[?&](?:center|markers)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/;
        const coordMatch = imageUrl.match(coordRegex);

        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          long = parseFloat(coordMatch[2]);
          console.log(`[GeoService] 🎯 Koordinat Valid dari Meta Image: ${lat}, ${long}`);
          return { lat, long };
        }
      }

      // =================================================================
      // STRATEGI 3: AGGRESSIVE HTML SCAN (Fallback Terakhir)
      // =================================================================
      // Scan semua angka desimal yang berdekatan dan valid di Indonesia
      
      console.log("[GeoService] ⚠️ Meta tag gagal, scan HTML agresif...");
      
      const broadRegex = /(-?\d+\.\d{4,})\s*(?:,|%2C|\\u002C)\s*(-?\d+\.\d{4,})/g;
      const matches = [...htmlContent.matchAll(broadRegex)];
      
      for (const m of matches) {
        const tempLat = parseFloat(m[1]);
        const tempLong = parseFloat(m[2]);

        // Validasi Wilayah Indonesia (Kasar)
        // Lat: -11 s/d 6, Long: 95 s/d 141
        if (tempLat >= -11 && tempLat <= 6 && tempLong >= 95 && tempLong <= 141) {
            lat = tempLat;
            long = tempLong;
            console.log(`[GeoService] 🔍 Koordinat Heuristik (Indonesia): ${lat}, ${long}`);
            break; 
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
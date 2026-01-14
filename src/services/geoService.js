const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // 1. HTTP REQUEST
      try {
        const response = await axios.get(mapsLink, {
          maxRedirects: 10,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            // User Agent Desktop paling umum
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            // Cookie 'CONSENT' palsu untuk melewati halaman "Before you continue" Google
            'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+417; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MjktMF9SQzIaAmVuIAEaBgiAo_WmBg;' 
          }
        });
        
        finalUrl = response.request.res.responseUrl || mapsLink;
        htmlContent = response.data;
        
        // Debug: Cek Judul Halaman
        const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
        const pageTitle = titleMatch ? titleMatch[1] : "No Title";
        console.log(`[GeoService] 📄 Page Title: "${pageTitle}"`);

      } catch (err) {
        console.error(`[GeoService] ⚠️ Gagal fetch URL: ${err.message}`);
        return null;
      }

      let lat = null;
      let long = null;

      // =================================================================
      // STRATEGI 1: CEK URL (Pola @lat,long)
      // =================================================================
      const regexPatterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/
      ];

      for (const regex of regexPatterns) {
        const match = finalUrl.match(regex);
        if (match) {
          lat = parseFloat(match[1]);
          long = parseFloat(match[2]);
          console.log(`[GeoService] ✅ Koordinat ditemukan di URL: ${lat}, ${long}`);
          return { lat, long };
        }
      }

      // =================================================================
      // STRATEGI 2: HTML META SCAN (Pola meta tag)
      // =================================================================
      // Cari og:image yang berisi static map
      const metaImageRegex = /content="(https?:\/\/.*?maps\.google\.com.*?)"/;
      const metaMatch = htmlContent.match(metaImageRegex);

      if (metaMatch && metaMatch[1]) {
        const imageUrl = metaMatch[1];
        const coordRegex = /[?&](?:center|markers)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/;
        const coordMatch = imageUrl.match(coordRegex);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          long = parseFloat(coordMatch[2]);
          console.log(`[GeoService] ✅ Koordinat dari Meta Image: ${lat}, ${long}`);
          return { lat, long };
        }
      }

      // =================================================================
      // STRATEGI 3: JSON STATE SCAN (Deep Search)
      // =================================================================
      // Mencari pola [null,null,lat,long]
      const deepJsonRegex = /\[\s*null\s*,\s*null\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
      const deepMatches = [...htmlContent.matchAll(deepJsonRegex)];
      
      for (const m of deepMatches) {
        const tempLat = parseFloat(m[1]);
        const tempLong = parseFloat(m[2]);
        if (isValidIndo(tempLat, tempLong)) {
            console.log(`[GeoService] 🎯 Koordinat Valid (Deep JSON): ${tempLat}, ${tempLong}`);
            return { lat: tempLat, long: tempLong };
        }
      }

      // =================================================================
      // STRATEGI 4: PAIRING NUMBER SCAN (Brutal)
      // =================================================================
      // Cari SEMUA angka desimal, masukkan ke array, lalu cari pasangan yang valid
      console.log("[GeoService] ⚠️ Mencoba Pairing Scan (Brutal)...");
      
      // Ambil semua angka desimal yang punya minimal 4 digit di belakang koma (presisi tinggi)
      // Ini untuk menghindari ambil tahun (2024), ID pendek, atau harga
      const allNumbersRegex = /(-?\d+\.\d{4,})/g; 
      const allNumbers = [...htmlContent.matchAll(allNumbersRegex)].map(m => parseFloat(m[1]));

      // Loop cari pasangan berurutan
      for (let i = 0; i < allNumbers.length - 1; i++) {
        const val1 = allNumbers[i];
        const val2 = allNumbers[i+1]; // Cek angka sebelahnya

        // Cek pasangan [Lat, Long]
        if (isValidIndo(val1, val2)) {
           console.log(`[GeoService] 🔍 Koordinat Heuristik (Urutan ${i}): ${val1}, ${val2}`);
           return { lat: val1, long: val2 };
        }
      }

      // =================================================================
      // STRATEGI 5: CID / PLACE ID FALLBACK (Trik URL)
      // =================================================================
      // Jika semua gagal, cek apakah ada CID di URL (0x...:0x...)
      // Contoh: ...!1s0x2e7a59...:0x22a2739327387229...
      const cidRegex = /:0x([0-9a-fA-F]+)/;
      const cidMatch = finalUrl.match(cidRegex);
      
      if (cidMatch) {
        try {
            // Konversi Hex ke Decimal (Butuh BigInt karena angkanya besar)
            const cidDecimal = BigInt(`0x${cidMatch[1]}`).toString();
            console.log(`[GeoService] 💡 CID ditemukan: ${cidDecimal}. Mencoba URL alternatif...`);
            
            // URL ini biasanya redirect ke tampilan map yang URL-nya ada koordinat
            // atau HTML-nya lebih sederhana
            const altUrl = `https://maps.google.com/?cid=${cidDecimal}`;
            
            // Kita return null dulu di sini, tapi di log menyarankan manual
            // (Karena fetch ulang berisiko timeout 10 detik Vercel)
            console.log(`[GeoService] ⚠️ Coba gunakan link ini manual: ${altUrl}`);
        } catch (e) {
            console.log("[GeoService] Gagal parse CID");
        }
      }

      console.log(`[GeoService] ❌ Gagal Total. HTML Length: ${htmlContent.length}`);
      return null;

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

// Helper: Cek apakah koordinat masuk akal (Indonesia & Sekitarnya)
function isValidIndo(lat, long) {
    // Lat: -11 s/d 6
    // Long: 95 s/d 141
    // Kita longgarkan sedikit buffer-nya untuk Malaysia/Singapura/Timor Leste
    return (lat >= -15 && lat <= 10 && long >= 90 && long <= 150);
}

module.exports = geoService;
const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;

      // 1. JIKA LINK PENDEK -> IKUTI REDIRECT
      if (mapsLink.includes('goo.gl') || mapsLink.includes('maps.app.goo.gl')) {
        try {
          // Kita harus menyamar sebagai Browser Desktop agar Google kasih URL lengkap
          const response = await axios.get(mapsLink, {
            maxRedirects: 10, // Izinkan redirect
            validateStatus: (status) => status >= 200 && status < 400,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          
          // Ambil URL akhir setelah redirect
          finalUrl = response.request.res.responseUrl || mapsLink;
          console.log(`[GeoService] ➡️  Link Panjang: ${finalUrl}`);
        } catch (err) {
          console.error(`[GeoService] ⚠️ Gagal expand link pendek: ${err.message}`);
          // Lanjut coba proses link asli siapa tau bisa
        }
      }

      // 2. EKSTRAK KOORDINAT DENGAN REGEX
      let lat = null, long = null;

      // Pola A: URL ada @-6.2000,106.8166 (Paling umum di Desktop)
      const regexAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchAt = finalUrl.match(regexAt);

      // Pola B: URL ada !3d-6.2000!4d106.8166 (Format data embedding)
      const regexData = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      const matchData = finalUrl.match(regexData);

      // Pola C: URL ada ?q=-6.2000,106.8166 (Query search)
      const regexQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchQ = finalUrl.match(regexQ);

      // Pola D: URL ada &ll=-6.2000,106.8166 (LongLat param)
      const regexLL = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchLL = finalUrl.match(regexLL);

      // Cek satu per satu
      if (matchAt) {
        lat = parseFloat(matchAt[1]);
        long = parseFloat(matchAt[2]);
        console.log(`[GeoService] ✅ Pola '@' ditemukan`);
      } else if (matchData) {
        lat = parseFloat(matchData[1]);
        long = parseFloat(matchData[2]);
        console.log(`[GeoService] ✅ Pola '!3d!4d' ditemukan`);
      } else if (matchQ) {
        lat = parseFloat(matchQ[1]);
        long = parseFloat(matchQ[2]);
        console.log(`[GeoService] ✅ Pola '?q=' ditemukan`);
      } else if (matchLL) {
        lat = parseFloat(matchLL[1]);
        long = parseFloat(matchLL[2]);
        console.log(`[GeoService] ✅ Pola 'll=' ditemukan`);
      }

      if (lat && long) {
        console.log(`[GeoService] 📍 Koordinat Dapat: ${lat}, ${long}`);
        return { lat, long };
      } else {
        console.log(`[GeoService] ❌ Gagal menemukan pola koordinat di URL.`);
        return null;
      }

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
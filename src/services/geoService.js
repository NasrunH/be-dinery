const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // Fungsi Helper untuk Request dengan Header Desktop
      const fetchUrl = async (url) => {
        try {
          const response = await axios.get(url, {
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+417;' 
            }
          });
          return {
            finalUrl: response.request.res.responseUrl || url,
            html: response.data
          };
        } catch (err) {
          console.error(`[GeoService] ⚠️ Fetch error: ${err.message}`);
          return null;
        }
      };

      // 1. FETCH PERTAMA
      const result1 = await fetchUrl(mapsLink);
      if (!result1) return null;
      
      finalUrl = result1.finalUrl;
      htmlContent = result1.html;

      // =================================================================
      // FUNGSI EKSTRAKSI (Bisa dipakai ulang)
      // =================================================================
      const tryExtract = (url, html) => {
        // 1. Cek URL Pattern (@lat,long)
        const regexPatterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,
          /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
          /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/
        ];
        for (const regex of regexPatterns) {
          const match = url.match(regex);
          if (match) return { lat: parseFloat(match[1]), long: parseFloat(match[2]), method: 'URL' };
        }

        // 2. Cek Meta Tag (og:image)
        const metaMatch = html.match(/content="(https?:\/\/.*?maps\.google\.com.*?)"/);
        if (metaMatch && metaMatch[1]) {
          const coordMatch = metaMatch[1].match(/[?&](?:center|markers)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
          if (coordMatch) return { lat: parseFloat(coordMatch[1]), long: parseFloat(coordMatch[2]), method: 'Meta Tag' };
        }

        // 3. Cek Deep JSON ([null,null,lat,long])
        const deepMatches = [...html.matchAll(/\[\s*null\s*,\s*null\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g)];
        for (const m of deepMatches) {
          const lat = parseFloat(m[1]), long = parseFloat(m[2]);
          if (lat >= -15 && lat <= 10 && long >= 90 && long <= 150) return { lat, long, method: 'Deep JSON' };
        }

        return null;
      };

      // COBA EKSTRAKSI PERTAMA
      let coords = tryExtract(finalUrl, htmlContent);
      if (coords) {
        console.log(`[GeoService] ✅ Koordinat ditemukan via ${coords.method}: ${coords.lat}, ${coords.long}`);
        return { lat: coords.lat, long: coords.long };
      }

      // =================================================================
      // STRATEGI CID FALLBACK (AUTO-REDIRECT)
      // =================================================================
      // Jika cara biasa gagal, kita cari CID dan paksa Google kasih link baru
      
      const cidRegex = /:0x([0-9a-fA-F]+)/;
      const cidMatch = finalUrl.match(cidRegex);
      
      if (cidMatch) {
        try {
            const cidDecimal = BigInt(`0x${cidMatch[1]}`).toString();
            const altUrl = `https://maps.google.com/?cid=${cidDecimal}`;
            console.log(`[GeoService] 💡 CID ditemukan: ${cidDecimal}. Fetching ulang URL alternatif...`);
            
            // FETCH KEDUA: Panggil URL CID
            const result2 = await fetchUrl(altUrl);
            
            if (result2) {
                console.log(`[GeoService] ➡️  Link Alternatif Redirect ke: ${result2.finalUrl}`);
                // Cek lagi di URL hasil redirect (biasanya sudah ada @lat,long)
                coords = tryExtract(result2.finalUrl, result2.html);
                
                if (coords) {
                    console.log(`[GeoService] 🎉 SUKSES via CID Redirect: ${coords.lat}, ${coords.long}`);
                    return { lat: coords.lat, long: coords.long };
                }
            }
        } catch (e) {
            console.log("[GeoService] Gagal proses CID");
        }
      }

      // =================================================================
      // LAST RESORT: PAIRING SCAN (Brutal)
      // =================================================================
      console.log("[GeoService] ⚠️ Mencoba Pairing Scan (Brutal)...");
      const allNumbers = [...htmlContent.matchAll(/(-?\d+\.\d{4,})/g)].map(m => parseFloat(m[1]));
      for (let i = 0; i < allNumbers.length - 1; i++) {
        const val1 = allNumbers[i];
        const val2 = allNumbers[i+1];
        if (val1 >= -11 && val1 <= 6 && val2 >= 95 && val2 <= 141) { // Indo check
           console.log(`[GeoService] 🔍 Koordinat Heuristik: ${val1}, ${val2}`);
           return { lat: val1, long: val2 };
        }
      }

      console.log(`[GeoService] ❌ Gagal Total.`);
      return null;

    } catch (error) {
      console.error("[GeoService] Critical Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
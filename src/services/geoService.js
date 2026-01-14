const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      console.log(`\n[GeoService] 🔍 Memproses Link: ${mapsLink}`);

      if (!mapsLink) return null;

      let finalUrl = mapsLink;
      let htmlContent = "";

      // Helper Request
      const fetchUrl = async (url) => {
        try {
          const response = await axios.get(url, {
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 400,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
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
      // FUNGSI EKSTRAKSI (Diperbarui)
      // =================================================================
      const tryExtract = (url, html) => {
        // 1. Cek URL Pattern
        const regexPatterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,
          /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
          /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
          /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/
        ];
        for (const regex of regexPatterns) {
          const match = url.match(regex);
          if (match) return { lat: parseFloat(match[1]), long: parseFloat(match[2]), method: 'URL' };
        }

        // 2. Cek Canonical Link (Seringkali berisi URL lengkap)
        const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="(.*?)"/);
        if (canonicalMatch && canonicalMatch[1]) {
            const canonicalUrl = canonicalMatch[1];
            // Cek URL di dalam canonical
            for (const regex of regexPatterns) {
                const match = canonicalUrl.match(regex);
                if (match) return { lat: parseFloat(match[1]), long: parseFloat(match[2]), method: 'Canonical URL' };
            }
        }

        // 3. Cek Meta Tags (og:image & twitter:image & itemprop=image)
        // FIX: Added 'g' flag to enable matchAll
        const metaRegex = /content="(https?:\/\/.*?(?:maps\.google|googleusercontent).*?)"/g;
        const allMetaMatches = [...html.matchAll(metaRegex)];
        
        for (const m of allMetaMatches) {
            const imgUrl = m[1];
            const coordMatch = imgUrl.match(/[?&](?:center|markers)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
            if (coordMatch) return { lat: parseFloat(coordMatch[1]), long: parseFloat(coordMatch[2]), method: 'Meta Image' };
        }

        // 4. Cek Simple JSON Array [lat, long]
        // Mencari array berisi dua angka desimal berdekatan
        // Regex: [ -7.123 , 110.123 ]
        const simpleJsonRegex = /\[\s*(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})\s*\]/g;
        const jsonMatches = [...html.matchAll(simpleJsonRegex)];
        
        for (const m of jsonMatches) {
            const lat = parseFloat(m[1]);
            const long = parseFloat(m[2]);
            if (isValidIndo(lat, long)) return { lat, long, method: 'Simple JSON' };
        }

        return null;
      };

      // Helper Validasi Indonesia (Diperlonggar sedikit)
      const isValidIndo = (lat, long) => {
          return (lat >= -15 && lat <= 10 && long >= 90 && long <= 150);
      };

      // COBA EKSTRAKSI 1
      let coords = tryExtract(finalUrl, htmlContent);
      if (coords) {
        console.log(`[GeoService] ✅ Koordinat ditemukan via ${coords.method}: ${coords.lat}, ${coords.long}`);
        return { lat: coords.lat, long: coords.long };
      }

      // =================================================================
      // STRATEGI CID & EMBED (Jika cara biasa gagal)
      // =================================================================
      
      const cidRegex = /:0x([0-9a-fA-F]+)/;
      const cidMatch = finalUrl.match(cidRegex);
      
      if (cidMatch) {
        try {
            const cidDecimal = BigInt(`0x${cidMatch[1]}`).toString();
            console.log(`[GeoService] 💡 CID ditemukan: ${cidDecimal}`);
            
            // COBA 1: URL CID Biasa (Seperti V8)
            const altUrl = `https://maps.google.com/?cid=${cidDecimal}`;
            const result2 = await fetchUrl(altUrl);
            
            if (result2) {
                coords = tryExtract(result2.finalUrl, result2.html);
                if (coords) {
                    console.log(`[GeoService] 🎉 SUKSES via CID Redirect: ${coords.lat}, ${coords.long}`);
                    return { lat: coords.lat, long: coords.long };
                }
            }

            // COBA 2: URL Embed (Rahasia!)
            // URL Embed biasanya merender peta static yang HTML-nya kaya akan koordinat
            console.log(`[GeoService] ⚠️ CID Redirect gagal, mencoba via Embed API...`);
            const embedUrl = `https://maps.google.com/maps?cid=${cidDecimal}&output=embed`;
            const result3 = await fetchUrl(embedUrl);

            if (result3) {
                // Di halaman embed, koordinat sering ada di JSON inisialisasi
                // Cari pola [null,null,lat,long] lagi di HTML embed
                const deepJsonRegex = /\[\s*null\s*,\s*null\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/;
                const deepMatch = result3.html.match(deepJsonRegex);
                
                if (deepMatch && isValidIndo(parseFloat(deepMatch[1]), parseFloat(deepMatch[2]))) {
                    console.log(`[GeoService] 🎯 SUKSES via Embed API: ${deepMatch[1]}, ${deepMatch[2]}`);
                    return { lat: parseFloat(deepMatch[1]), long: parseFloat(deepMatch[2]) };
                }
                
                // Cek lagi pakai extractor standar di HTML embed
                coords = tryExtract(result3.finalUrl, result3.html);
                if (coords) return { lat: coords.lat, long: coords.long };
            }

        } catch (e) {
            console.log("[GeoService] Gagal proses CID/Embed");
        }
      }

      // =================================================================
      // LAST RESORT: PAIRING SCAN (Brutal)
      // =================================================================
      console.log("[GeoService] ⚠️ Mencoba Pairing Scan (Brutal)...");
      // Cari angka desimal minimal 3 digit (tadinya 4, kita kurangi jadi 3 biar lebih inklusif)
      const allNumbers = [...htmlContent.matchAll(/(-?\d+\.\d{3,})/g)].map(m => parseFloat(m[1]));
      
      for (let i = 0; i < allNumbers.length - 1; i++) {
        const val1 = allNumbers[i];
        const val2 = allNumbers[i+1];
        if (isValidIndo(val1, val2)) {
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
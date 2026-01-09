const axios = require('axios');
const cheerio = require('cheerio');

const scraperService = {
  getMetadata: async (url) => {
    try {
      // 1. Validasi URL
      if (!url || !url.startsWith('http')) {
        throw new Error("URL tidak valid.");
      }

      // 2. Deteksi Platform
      let platform = 'Website';
      if (url.includes('google.com/maps') || url.includes('goo.gl')) platform = 'Google Maps';
      else if (url.includes('tiktok.com')) platform = 'TikTok';
      else if (url.includes('instagram.com')) platform = 'Instagram';
      else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'YouTube';

      // 3. STRATEGI KHUSUS PER PLATFORM

      // --- A. TIKTOK (Pakai OEmbed API Resmi) ---
      if (platform === 'TikTok') {
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${url}`;
          const { data } = await axios.get(oembedUrl);
          return {
            original_link: url,
            platform,
            meta_title: data.title || 'TikTok Video',
            meta_image: data.thumbnail_url || null
          };
        } catch (e) {
          console.log("TikTok OEmbed gagal, lanjut scraping manual...");
        }
      }

      // --- B. INSTAGRAM & GOOGLE MAPS (Teknik Menyamar) ---
      // Kita menyamar sebagai "facebookexternalhit" (Bot preview WhatsApp/FB)
      // Ini seringkali bisa menembus login wall Instagram
      const userAgent = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000, // Naikkan timeout jadi 10 detik
        maxRedirects: 5 // Google Maps sering redirect link pendek
      });

      const $ = cheerio.load(data);

      // 4. Ambil Metadata (Prioritas Tag)
      let title = 
        $('meta[property="og:title"]').attr('content') || 
        $('meta[name="twitter:title"]').attr('content') || 
        $('title').text() || 
        '';

      let image = 
        $('meta[property="og:image"]').attr('content') || 
        $('meta[name="twitter:image"]').attr('content') || 
        $('link[rel="image_src"]').attr('href') || 
        null;

      // 5. CLEANING DATA (Pembersihan Judul)
      
      // Bersihkan judul Instagram ("Create an account or log in to Instagram...")
      if (platform === 'Instagram') {
        if (title.includes("Login") || title.includes("Instagram")) {
          // Coba ambil dari deskripsi jika title gagal
          const desc = $('meta[property="og:description"]').attr('content');
          if (desc) {
            // Biasanya format: "10K Likes, 50 Comments - NamaAkun (@akun) on Instagram: "Caption...""
            // Kita coba ambil caption-nya saja (setelah titik dua)
            const parts = desc.split(': "');
            if (parts.length > 1) {
              title = parts[1].replace('"', ''); // Ambil caption
            } else {
              title = desc; // Ambil full description
            }
          } else {
             // Jika gagal total, biarkan kosong biar user isi sendiri
             title = "";
          }
        }
      }

      // Bersihkan judul Google Maps ("Google Maps" -> Nama Tempat)
      if (platform === 'Google Maps') {
        // Hapus suffix " - Google Maps"
        title = title.replace(' - Google Maps', '');
        
        // Kadang Google Maps shortlink (goo.gl) redirect ke halaman yg judulnya cuma "Google Maps"
        // Ini susah dihandle tanpa browser beneran, jadi kita biarkan user edit kalau hasilnya generic.
      }

      return {
        original_link: url,
        platform,
        meta_title: title.trim(),
        meta_image: image
      };

    } catch (error) {
      console.error(`Scraping Error [${url}]:`, error.message);
      // Fallback: Return data kosong, jangan bikin server crash
      return {
        original_link: url,
        platform: 'Website',
        meta_title: '',
        meta_image: null,
        error: "Gagal mengambil preview otomatis"
      };
    }
  }
};

module.exports = scraperService;
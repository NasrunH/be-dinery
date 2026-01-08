const axios = require('axios');
const cheerio = require('cheerio');

const scraperService = {
  getMetadata: async (url) => {
    try {
      // 1. Validasi URL
      if (!url || !url.startsWith('http')) {
        throw new Error("URL tidak valid.");
      }

      // 2. Fetch HTML
      // Kita pakai User-Agent browser agar tidak diblokir
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 8000 // 8 detik timeout
      });

      // 3. Load HTML
      const $ = cheerio.load(data);

      // 4. Ambil Metadata (OpenGraph / Twitter Card)
      const title = 
        $('meta[property="og:title"]').attr('content') || 
        $('title').text() || 
        'No Title';
      
      const image = 
        $('meta[property="og:image"]').attr('content') || 
        $('meta[name="twitter:image"]').attr('content') || 
        null;

      // 5. Bersihkan Data
      return {
        original_link: url,
        meta_title: title.trim(),
        meta_image: image,
        platform: identifyPlatform(url)
      };

    } catch (error) {
      console.error(`[Scraper] Gagal scraping ${url}:`, error.message);
      // Fallback: Kembalikan object kosong, jangan error 500
      return {
        original_link: url,
        meta_title: '',
        meta_image: null,
        platform: identifyPlatform(url),
        error: "Gagal mengambil metadata otomatis"
      };
    }
  }
};

const identifyPlatform = (url) => {
  if (url.includes('google.com/maps') || url.includes('goo.gl')) return 'Google Maps';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  return 'Website';
};

module.exports = scraperService;
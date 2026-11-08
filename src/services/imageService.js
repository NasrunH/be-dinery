const axios = require('axios');
const sharp = require('sharp');
const cheerio = require('cheerio');

const imageService = {
  /**
   * Mengunduh gambar dari URL dan mengompres menjadi format WebP Base64 ultra-kecil (~8-14 KB)
   * @param {string} imageUrl URL gambar asal (TikTok, Instagram, Google Maps, web)
   * @param {object} [options]
   * @param {number} [options.width=360] Lebar thumbnail
   * @param {number} [options.height=270] Tinggi thumbnail (aspect 4:3)
   * @param {number} [options.quality=65] Kualitas WebP
   * @returns {Promise<string|null>} Data URI WebP Base64 atau null jika gagal
   */
  compressUrlToWebpBase64: async (imageUrl, options = {}) => {
    if (!imageUrl || typeof imageUrl !== 'string') return null;

    // Jika sudah berupa data URI WebP dan ukurannya wajar, langsung kembalikan
    if (imageUrl.startsWith('data:image/webp;base64,') && imageUrl.length < 35000) {
      return imageUrl;
    }

    const { width = 360, height = 270, quality = 65 } = options;

    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': imageUrl.includes('tiktok') ? 'https://www.tiktok.com/' : (imageUrl.includes('instagram') ? 'https://www.instagram.com/' : '')
        }
      });

      const buffer = Buffer.from(response.data);

      const webpBuffer = await sharp(buffer)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .webp({ quality, effort: 4 })
        .toBuffer();

      const base64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      return base64;
    } catch (err) {
      console.warn(`[imageService] Gagal kompres gambar dari ${imageUrl.slice(0, 50)}... : ${err.message}`);
      return null;
    }
  },

  /**
   * Mengambil ulang (re-fetch) gambar segar dari platform asal tempat kuliner
   * @param {object} place { original_link, maps_link, meta_image, location }
   * @returns {Promise<string|null>} URL gambar segar atau Base64
   */
  fetchFreshImageForPlace: async (place) => {
    if (!place) return null;

    // 1. Coba ambil dari TikTok OEmbed jika original_link adalah TikTok
    if (place.original_link && place.original_link.includes('tiktok.com')) {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(place.original_link)}`;
        const { data } = await axios.get(oembedUrl, { timeout: 8000 });
        if (data?.thumbnail_url) {
          const compressed = await imageService.compressUrlToWebpBase64(data.thumbnail_url);
          if (compressed) return compressed;
        }
      } catch (e) {
        console.warn(`[imageService] TikTok OEmbed gagal untuk ID ${place.id}: ${e.message}`);
      }
    }

    // 2. Coba ambil dari Instagram via facebookexternalhit
    if (place.original_link && place.original_link.includes('instagram.com')) {
      try {
        const { data } = await axios.get(place.original_link, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 8000
        });
        const $ = cheerio.load(data);
        const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        if (ogImage) {
          const compressed = await imageService.compressUrlToWebpBase64(ogImage);
          if (compressed) return compressed;
        }
      } catch (e) {
        console.warn(`[imageService] Instagram scrape gagal untuk ID ${place.id}: ${e.message}`);
      }
    }

    // 3. Coba ambil dari Google Maps jika maps_link tersedia
    if (place.maps_link) {
      try {
        const { data } = await axios.get(place.maps_link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 8000,
          maxRedirects: 5
        });
        const $ = cheerio.load(data);
        const ogImage = $('meta[property="og:image"]').attr('content') || $('itemprop[itemprop="image"]').attr('content');
        if (ogImage && !ogImage.includes('maps_preview')) {
          const compressed = await imageService.compressUrlToWebpBase64(ogImage);
          if (compressed) return compressed;
        }
      } catch (e) {
        console.warn(`[imageService] Maps scrape gagal untuk ID ${place.id}: ${e.message}`);
      }
    }

    // 4. Jika meta_image saat ini masih bisa diunduh langsung, kompres saja
    if (place.meta_image && place.meta_image.startsWith('http')) {
      const compressed = await imageService.compressUrlToWebpBase64(place.meta_image);
      if (compressed) return compressed;
    }

    return null;
  }
};

module.exports = imageService;


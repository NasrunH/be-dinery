const axios = require('axios');
const sharp = require('sharp');
const cheerio = require('cheerio');

const imageService = {
  /**
   * Ekstraksi URL foto nyata dari respon metadata Google Maps
   * Menolak gambar peta statis (staticmap/tile) dan mengekstrak foto user content beresolusi tajam
   */
  extractGooglePhotoUrl: (ogImage) => {
    if (!ogImage || typeof ogImage !== 'string') return null;

    // Tolak mentah-mentah jika ini peta jalan / static map tile / preview grid
    if (
      ogImage.includes('staticmap') ||
      ogImage.includes('maps/api') ||
      ogImage.includes('maps_preview') ||
      ogImage.includes('streetview') ||
      ogImage.includes('grid_preview')
    ) {
      return null;
    }

    // Jika berupa dimg-pa collage URL, ekstrak foto pertama yang di-encode base64
    if (ogImage.includes('dimg-pa.googleapis.com')) {
      const base64Matches = ogImage.match(/aHR0cHM6Ly9sa[a-zA-Z0-9_\-=]+/g);
      if (base64Matches && base64Matches.length > 0) {
        try {
          const decoded = Buffer.from(base64Matches[0], 'base64').toString('utf-8');
          if (decoded.startsWith('http')) {
            // Tingkatkan resolusi menjadi tajam 600x450
            return decoded.replace(/=w\d+-h\d+[^&]*/, '=w600-h450-k-no');
          }
        } catch (e) {}
      }
    }

    // Jika sudah berupa googleusercontent.com / ggpht.com
    if (ogImage.includes('googleusercontent.com') || ogImage.includes('ggpht.com')) {
      return ogImage.replace(/=w\d+-h\d+[^&]*/, '=w600-h450-k-no');
    }

    return ogImage;
  },

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

    // 3. Coba ambil dari Google Maps jika maps_link atau link maps tersedia
    const gmapsUrl = place.maps_link || (place.original_link && (place.original_link.includes('maps') || place.original_link.includes('goo.gl')) ? place.original_link : null);
    if (gmapsUrl) {
      try {
        const { data } = await axios.get(gmapsUrl, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 10000,
          maxRedirects: 5
        });
        const $ = cheerio.load(data);
        const ogImage = $('meta[property="og:image"]').attr('content') || $('itemprop[itemprop="image"]').attr('content');
        const realPhoto = imageService.extractGooglePhotoUrl(ogImage);
        if (realPhoto) {
          const compressed = await imageService.compressUrlToWebpBase64(realPhoto);
          if (compressed) return compressed;
        }
      } catch (e) {
        console.warn(`[imageService] Maps scrape gagal untuk ID ${place.id}: ${e.message}`);
      }
    }

    // 4. Jika meta_image saat ini masih bisa diunduh langsung dan bukan static map
    if (place.meta_image && place.meta_image.startsWith('http')) {
      if (!place.meta_image.includes('staticmap') && !place.meta_image.includes('maps/api')) {
        const compressed = await imageService.compressUrlToWebpBase64(place.meta_image);
        if (compressed) return compressed;
      }
    }

    return null;
  }
};

module.exports = imageService;

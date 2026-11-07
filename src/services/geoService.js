const axios = require('axios');

// In-memory cache untuk hasil reverse geocoding agar tidak berulang kali memanggil Nominatim
const addressCache = new Map();
const MAX_CACHE_SIZE = 500;

const isValidIndo = (lat, long) => {
  return (
    typeof lat === 'number' &&
    typeof long === 'number' &&
    !isNaN(lat) &&
    !isNaN(long) &&
    lat >= -15 &&
    lat <= 10 &&
    long >= 90 &&
    long <= 150
  );
};

const isForeignAddress = (address) => {
  if (!address || typeof address !== 'string') return true;
  const lower = address.toLowerCase();
  return (
    lower.includes('virginia') ||
    lower.includes('amerika') ||
    lower.includes('united states') ||
    lower.includes('archbold') ||
    lower.includes('loudoun') ||
    lower.includes('ashburn') ||
    lower.includes('california') ||
    lower.includes('washington') ||
    lower.includes('usa')
  );
};

/**
 * Parsing lokasi dari berbagai format PostGIS / GeoJSON / WKT / EWKB Hex
 */
const parseLocation = (location) => {
  if (!location) return null;

  // 1. Format Object { lat, lng } atau { lat, long } atau GeoJSON
  if (typeof location === 'object') {
    if (typeof location.lat === 'number' && typeof location.long === 'number') {
      if (isValidIndo(location.lat, location.long)) {
        return { lat: location.lat, long: location.long };
      }
    }
    if (typeof location.lat === 'number' && typeof location.lng === 'number') {
      if (isValidIndo(location.lat, location.lng)) {
        return { lat: location.lat, long: location.lng };
      }
    }
    if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      const long = Number(location.coordinates[0]);
      const lat = Number(location.coordinates[1]);
      if (isValidIndo(lat, long)) {
        return { lat, long };
      }
    }
  }

  if (typeof location !== 'string') return null;

  // 2. Format WKT String "POINT(long lat)"
  const pointMatch = location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (pointMatch) {
    const long = parseFloat(pointMatch[1]);
    const lat = parseFloat(pointMatch[2]);
    if (isValidIndo(lat, long)) {
      return { lat, long };
    }
  }

  // 3. Format PostGIS EWKB Hex String
  try {
    const cleanHex = location.replace(/^\\x/, '');
    if (cleanHex.length >= 32) {
      const buffer = Buffer.from(cleanHex, 'hex');
      if (buffer.length >= 21) {
        const isLittleEndian = buffer.readUInt8(0) === 1;
        const type = isLittleEndian ? buffer.readUInt32LE(1) : buffer.readUInt32BE(1);
        let offset = 5;
        if ((type & 0x20000000) !== 0) {
          offset += 4; // Lewati 4-byte SRID
        }
        if (buffer.length >= offset + 16) {
          const long = isLittleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
          const lat = isLittleEndian ? buffer.readDoubleLE(offset + 8) : buffer.readDoubleBE(offset + 8);
          if (isValidIndo(lat, long)) {
            return { lat, long };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[GeoService] Parse EWKB Hex error:', err.message);
  }

  return null;
};

const geoService = {
  isValidIndo,
  isForeignAddress,
  parseLocation,

  extractAddressFromUrl: (url) => {
    if (!url) return null;
    try {
      const placeMatch = url.match(/\/maps\/place\/([^/?#]+)/);
      if (placeMatch && placeMatch[1]) {
        let decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        decoded = decoded.replace(/@.*$/, '').trim();
        const parts = decoded.split(',');
        if (parts.length > 1) {
          const addressPart = parts.slice(1).join(',').trim();
          if (addressPart.length > 5 && !isForeignAddress(addressPart)) {
            return addressPart;
          }
        }
      }
    } catch (e) {
      console.warn('[GeoService] Parse address error:', e.message);
    }
    return null;
  },

  reverseGeocode: async (lat, long) => {
    try {
      if (!isValidIndo(lat, long)) {
        console.warn(`[GeoService] ⚠️ Koordinat di luar Indonesia (${lat}, ${long}), membatalkan reverse geocode.`);
        return null;
      }

      // Cek in-memory cache (~11 meter precision pada 4 desimal)
      const cacheKey = `${lat.toFixed(4)},${long.toFixed(4)}`;
      if (addressCache.has(cacheKey)) {
        console.log(`[GeoService] ⚡ Cache HIT untuk reverse geocode: ${cacheKey}`);
        return addressCache.get(cacheKey);
      }

      console.log(`[GeoService] 📍 Reverse geocoding koordinat via OpenStreetMap Nominatim: ${lat}, ${long}`);
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'DineryBackend/1.0 (contact@dinery.web.id)',
            'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
          },
          timeout: 5000
        }
      );

      const address = response.data?.display_name;
      if (address) {
        if (isForeignAddress(address)) {
          console.warn('[GeoService] ⚠️ Hasil reverse geocode tertolak karena berlokasi di luar negeri:', address);
          return null;
        }

        // Simpan ke cache
        if (addressCache.size >= MAX_CACHE_SIZE) {
          const firstKey = addressCache.keys().next().value;
          addressCache.delete(firstKey);
        }
        addressCache.set(cacheKey, address);

        console.log(`[GeoService] ✅ Alamat berhasil didapatkan: ${address}`);
        return address;
      }
      return null;
    } catch (err) {
      console.warn(`[GeoService] ⚠️ Gagal reverse geocode: ${err.message}`);
      return null;
    }
  },

  resolveLocationAndAddress: async (mapsLink) => {
    try {
      if (!mapsLink) return null;

      console.log(`\n[GeoService] 🔍 Resolving Maps & Address: ${mapsLink}`);

      const response = await axios.get(mapsLink, {
        maxRedirects: 10,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+417;'
        },
        timeout: 10000
      });

      const finalUrl = response.request.res.responseUrl || mapsLink;
      const html = response.data;

      // 1. Ekstrak Alamat Langsung dari Path URL Google Maps (/maps/place/Name, Address/...)
      let address = geoService.extractAddressFromUrl(finalUrl);

      // 2. Ekstrak Koordinat (dengan validasi ketat batas wilayah Indonesia)
      let lat = null;
      let long = null;

      const regexPatterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/
      ];

      for (const r of regexPatterns) {
        const m = finalUrl.match(r);
        if (m) {
          const pLat = parseFloat(m[1]);
          const pLong = parseFloat(m[2]);
          if (isValidIndo(pLat, pLong)) {
            lat = pLat;
            long = pLong;
            break;
          }
        }
      }

      // Check Canonical URL
      if (!lat || !long) {
        const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="(.*?)"/);
        if (canonicalMatch && canonicalMatch[1]) {
          for (const r of regexPatterns) {
            const m = canonicalMatch[1].match(r);
            if (m) {
              const pLat = parseFloat(m[1]);
              const pLong = parseFloat(m[2]);
              if (isValidIndo(pLat, pLong)) {
                lat = pLat;
                long = pLong;
                break;
              }
            }
          }
        }
      }

      // Check staticmap meta image
      if (!lat || !long) {
        const staticMatch = html.match(/center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
        if (staticMatch) {
          const pLat = parseFloat(staticMatch[1]);
          const pLong = parseFloat(staticMatch[2]);
          if (isValidIndo(pLat, pLong)) {
            lat = pLat;
            long = pLong;
          }
        }
      }

      // Check JSON coordinates
      if (!lat || !long) {
        const simpleJsonRegex = /\[\s*(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})\s*\]/g;
        const jsonMatches = [...html.matchAll(simpleJsonRegex)];
        for (const m of jsonMatches) {
          const pLat = parseFloat(m[1]);
          const pLong = parseFloat(m[2]);
          if (isValidIndo(pLat, pLong)) {
            lat = pLat;
            long = pLong;
            break;
          }
        }
      }

      // 3. Jika alamat dari URL belum didapat, tapi koordinat valid di Indonesia ada:
      if (!address && lat && long) {
        address = await geoService.reverseGeocode(lat, long);
      }

      return {
        address_text: (address && !isForeignAddress(address)) ? address : null,
        lat: (lat && isValidIndo(lat, long)) ? lat : null,
        long: (long && isValidIndo(lat, long)) ? long : null,
        finalUrl
      };
    } catch (err) {
      console.warn(`[GeoService] Resolve error: ${err.message}`);
      return null;
    }
  },

  resolveAddressFromCoordsOrLocation: async (location, mapsLink) => {
    // 1. Ekstrak langsung dari URL maps jika ada
    if (mapsLink) {
      const urlAddress = geoService.extractAddressFromUrl(mapsLink);
      if (urlAddress && !isForeignAddress(urlAddress)) {
        return urlAddress;
      }
    }

    // 2. Parse koordinat dari PostGIS location
    let coords = parseLocation(location);

    // 3. Jika belum dapat, resolve dari mapsLink
    if ((!coords || !isValidIndo(coords.lat, coords.long)) && mapsLink) {
      const resolved = await geoService.resolveLocationAndAddress(mapsLink);
      if (resolved?.address_text && !isForeignAddress(resolved.address_text)) {
        return resolved.address_text;
      }
      if (resolved?.lat && resolved?.long && isValidIndo(resolved.lat, resolved.long)) {
        coords = { lat: resolved.lat, long: resolved.long };
      }
    }

    // 4. Reverse geocode dari koordinat
    if (coords && isValidIndo(coords.lat, coords.long)) {
      return await geoService.reverseGeocode(coords.lat, coords.long);
    }

    return null;
  },

  extractCoordinates: async (mapsLink) => {
    const res = await geoService.resolveLocationAndAddress(mapsLink);
    if (res && res.lat && res.long) {
      return { lat: res.lat, long: res.long };
    }
    return null;
  }
};

module.exports = geoService;

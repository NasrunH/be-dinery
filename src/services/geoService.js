const axios = require('axios');

const geoService = {
  extractCoordinates: async (mapsLink) => {
    try {
      if (!mapsLink) return null;

      let finalUrl = mapsLink;

      // 1. Jika Link Pendek (maps.app.goo.gl atau goo.gl), kita harus "ikuti" redirect-nya dulu
      if (mapsLink.includes('goo.gl') || mapsLink.includes('maps.app.goo.gl')) {
        const response = await axios.get(mapsLink, {
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400 // Terima 3xx redirect
        });
        // Axios biasanya otomatis mengikuti redirect, jadi response.request.res.responseUrl adalah URL akhir
        finalUrl = response.request.res.responseUrl || response.request.res.headers['location'] || mapsLink;
      }

      // 2. Ekstrak Koordinat menggunakan Regex (Pola URL Google Maps)
      
      // Pola 1: @-6.200000,106.816666
      const regexAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchAt = finalUrl.match(regexAt);
      if (matchAt) {
        return { lat: parseFloat(matchAt[1]), long: parseFloat(matchAt[2]) };
      }

      // Pola 2: !3d-6.200000!4d106.816666 (Biasanya di URL panjang data=...)
      const regexData = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      const matchData = finalUrl.match(regexData);
      if (matchData) {
        return { lat: parseFloat(matchData[1]), long: parseFloat(matchData[2]) };
      }

      // Pola 3: ?q=-6.200000,106.816666
      const regexQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const matchQ = finalUrl.match(regexQ);
      if (matchQ) {
        return { lat: parseFloat(matchQ[1]), long: parseFloat(matchQ[2]) };
      }

      return null; // Gagal nemu koordinat

    } catch (error) {
      console.error("GeoService Error:", error.message);
      return null;
    }
  }
};

module.exports = geoService;
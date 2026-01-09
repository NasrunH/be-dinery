const multer = require('multer');

// Konfigurasi Multer: Simpan file di Memory (Buffer)
// Kita tidak simpan di harddisk server karena server bisa saja mati/reset (stateless)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // Batas file max 1MB
  },
  fileFilter: (req, file, cb) => {
    // Validasi: Hanya boleh gambar
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
    }
  }
});

module.exports = upload;
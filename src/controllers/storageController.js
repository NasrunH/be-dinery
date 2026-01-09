const supabase = require('../config/supabase');

const storageController = {
  uploadImage: async (req, res) => {
    try {
      const file = req.file; // File dari multer
      const userId = req.user.id; // Dari auth middleware

      if (!file) {
        return res.status(400).json({ message: "Tidak ada file yang diupload." });
      }

      // 1. Buat Nama File Unik
      // Format: folder/timestamp_random_namafile.jpg
      // Contoh: uploads/170123456_8273_makan.jpg
      const fileExt = file.originalname.split('.').pop();
      const fileName = `uploads/${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

      // 2. Upload ke Supabase Storage
      const { data, error } = await supabase
        .storage
        .from('dinery-assets') // Nama bucket yang kamu buat di dashboard
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) throw error;

      // 3. Dapatkan Public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('dinery-assets')
        .getPublicUrl(fileName);

      // 4. Return URL ke User
      res.json({
        message: "Upload berhasil!",
        url: publicUrlData.publicUrl
      });

    } catch (err) {
      console.error("Upload Error:", err.message);
      res.status(500).json({ error: "Gagal mengupload gambar", details: err.message });
    }
  }
};

module.exports = storageController;
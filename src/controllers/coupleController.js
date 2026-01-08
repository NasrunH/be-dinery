const supabase = require('../config/supabase');

// Helper: Generate kode acak 5 digit huruf besar
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const coupleController = {
  // 1. CEK STATUS SAYA (Apakah saya jomblo atau taken di app ini?)
  getMyStatus: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data: member } = await supabase
        .from('couple_members')
        .select('*, couples(name, invite_code)') // Join ke tabel couples
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.json({ 
          has_couple: false, 
          message: "Kamu belum memiliki pasangan." 
        });
      }

      res.json({ 
        has_couple: true, 
        role: member.role,
        couple_data: member.couples 
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. CREATE COUPLE (Jadi Creator)
  createCouple: async (req, res) => {
    try {
      const { name } = req.body; // Nama Couple, misal "Rangga & Cinta"
      const userId = req.user.id;

      if (!name) return res.status(400).json({ message: "Nama Couple wajib diisi" });

      // Validasi: Pastikan user belum punya couple
      const { data: existing } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return res.status(400).json({ message: "Kamu sudah memiliki pasangan!" });
      }

      // 1. Buat Couple Baru
      const inviteCode = generateInviteCode();
      const { data: newCouple, error: errCouple } = await supabase
        .from('couples')
        .insert({ name: name, invite_code: inviteCode })
        .select()
        .single();

      if (errCouple) throw errCouple;

      // 2. Masukkan User sebagai Admin Couple tersebut
      const { error: errMember } = await supabase
        .from('couple_members')
        .insert({ 
          couple_id: newCouple.id, 
          user_id: userId, 
          role: 'creator' 
        });

      if (errMember) {
        // Rollback: Hapus couple yg tadi dibuat biar ga nyampah (Manual Rollback)
        await supabase.from('couples').delete().eq('id', newCouple.id);
        throw errMember;
      }

      res.status(201).json({ 
        status: "Sukses", 
        message: "Couple berhasil dibuat! Bagikan kode ini ke pasanganmu.", 
        data: newCouple 
      });

    } catch (err) {
      res.status(500).json({ error: "Gagal membuat couple", detail: err.message });
    }
  },

  // 3. JOIN COUPLE (Pakai Kode)
  joinCouple: async (req, res) => {
    try {
      const { invite_code } = req.body;
      const userId = req.user.id;

      if (!invite_code) return res.status(400).json({ message: "Kode invite wajib diisi" });

      // Validasi: Jangan join kalau sudah punya couple
      const { data: existingUser } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: "Kamu sudah memiliki pasangan." });
      }

      // 1. Cari Couple berdasarkan Kode
      const { data: couple, error: errFind } = await supabase
        .from('couples')
        .select('id, name')
        .eq('invite_code', invite_code.toUpperCase()) // Pastikan huruf besar
        .single();

      if (errFind || !couple) {
        return res.status(404).json({ message: "Kode Invite tidak valid." });
      }

      // Validasi: Cek apakah couple sudah penuh (Max 2 orang)
      const { count } = await supabase
        .from('couple_members')
        .select('*', { count: 'exact', head: true })
        .eq('couple_id', couple.id);

      if (count >= 2) {
        return res.status(400).json({ message: "Couple ini sudah penuh (Max 2 orang)." });
      }

      // 2. Masukkan User sebagai Member
      const { error: errJoin } = await supabase
        .from('couple_members')
        .insert({ 
          couple_id: couple.id, 
          user_id: userId, 
          role: 'joiner' 
        });

      if (errJoin) throw errJoin;

      res.json({ 
        status: "Sukses", 
        message: `Berhasil bergabung dengan ${couple.name}!`, 
        data: couple 
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = coupleController;
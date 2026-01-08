const supabase = require('../config/supabase');

// Helper: Generate kode acak 5 digit
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

const coupleController = {
  // --- CEK STATUS SAYA ---
  getMyStatus: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data: member } = await supabase
        .from('couple_members')
        .select('*, couples(*)')
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.json({ has_couple: false, data: null });
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

  // --- BUAT COUPLE BARU ---
  createCouple: async (req, res) => {
    try {
      const { couple_name } = req.body;
      const userId = req.user.id;

      if (!couple_name) return res.status(400).json({ message: "Nama Couple wajib diisi" });

      // Cek apakah user sudah punya couple
      const { data: existing } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return res.status(400).json({ message: "Kamu sudah punya pasangan di aplikasi ini." });
      }

      // Buat Couple
      const inviteCode = generateInviteCode();
      const { data: newCouple, error: errCouple } = await supabase
        .from('couples')
        .insert({ name: couple_name, invite_code: inviteCode })
        .select()
        .single();

      if (errCouple) throw errCouple;

      // Masukkan user sebagai admin
      const { error: errMember } = await supabase
        .from('couple_members')
        .insert({ couple_id: newCouple.id, user_id: userId, role: 'admin' });

      if (errMember) throw errMember;

      res.json({ status: "Sukses", message: "Couple berhasil dibuat!", data: newCouple });

    } catch (err) {
      res.status(500).json({ error: "Gagal membuat couple", detail: err.message });
    }
  },

  // --- GABUNG COUPLE ---
  joinCouple: async (req, res) => {
    try {
      const { invite_code } = req.body;
      const userId = req.user.id;

      if (!invite_code) return res.status(400).json({ message: "Kode invite wajib diisi" });

      // Cari Couple
      const { data: couple, error: errFind } = await supabase
        .from('couples')
        .select('id, name')
        .eq('invite_code', invite_code)
        .single();

      if (errFind || !couple) {
        return res.status(404).json({ message: "Kode Invite salah atau tidak ditemukan." });
      }

      // Cek Duplicate Join
      const { data: existing } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return res.status(400).json({ message: "Kamu sudah terdaftar di couple lain." });
      }

      // Gabung
      const { error: errJoin } = await supabase
        .from('couple_members')
        .insert({ couple_id: couple.id, user_id: userId, role: 'member' });

      if (errJoin) throw errJoin;

      res.json({ status: "Sukses", message: `Berhasil join ke ${couple.name}!`, data: couple });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = coupleController;
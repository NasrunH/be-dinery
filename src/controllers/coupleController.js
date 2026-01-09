const supabase = require('../config/supabase');

// Helper: Generate kode acak 5 digit
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const coupleController = {
  // --- CEK STATUS SAYA ---
  getMyStatus: async (req, res) => {
    try {
      const userId = req.user.id;

      const { data: member } = await supabase
        .from('couple_members')
        .select('*, couples(name, invite_code)')
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.json({ has_couple: false, message: "Kamu belum memiliki pasangan." });
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
      const { name } = req.body;
      const userId = req.user.id;

      if (!name) return res.status(400).json({ message: "Nama Couple wajib diisi" });

      const { data: existing } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return res.status(400).json({ message: "Kamu sudah memiliki pasangan!" });
      }

      const inviteCode = generateInviteCode();
      const { data: newCouple, error: errCouple } = await supabase
        .from('couples')
        .insert({ name: name, invite_code: inviteCode })
        .select()
        .single();

      if (errCouple) throw errCouple;

      const { error: errMember } = await supabase
        .from('couple_members')
        .insert({ couple_id: newCouple.id, user_id: userId, role: 'creator' });

      if (errMember) {
        await supabase.from('couples').delete().eq('id', newCouple.id);
        throw errMember;
      }

      res.status(201).json({ status: "Sukses", message: "Couple berhasil dibuat!", data: newCouple });

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

      const { data: existingUser } = await supabase
        .from('couple_members')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: "Kamu sudah memiliki pasangan." });
      }

      const { data: couple, error: errFind } = await supabase
        .from('couples')
        .select('id, name')
        .eq('invite_code', invite_code.toUpperCase())
        .single();

      if (errFind || !couple) {
        return res.status(404).json({ message: "Kode Invite tidak valid." });
      }

      const { count } = await supabase
        .from('couple_members')
        .select('*', { count: 'exact', head: true })
        .eq('couple_id', couple.id);

      if (count >= 2) {
        return res.status(400).json({ message: "Couple ini sudah penuh." });
      }

      const { error: errJoin } = await supabase
        .from('couple_members')
        .insert({ couple_id: couple.id, user_id: userId, role: 'joiner' });

      if (errJoin) throw errJoin;

      res.json({ status: "Sukses", message: `Berhasil bergabung dengan ${couple.name}!`, data: couple });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // --- [BARU] EDIT NAMA COUPLE ---
  updateCouple: async (req, res) => {
    try {
      const { name } = req.body;
      const userId = req.user.id;

      if (!name) return res.status(400).json({ message: "Nama Couple wajib diisi" });

      // 1. Cari Couple ID milik user ini
      const { data: member } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.status(404).json({ message: "Kamu belum punya pasangan." });
      }

      // 2. Update Nama di tabel couples
      const { data: updatedCouple, error } = await supabase
        .from('couples')
        .update({ name: name })
        .eq('id', member.couple_id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        message: "Nama Couple berhasil diubah!",
        data: updatedCouple
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = coupleController;
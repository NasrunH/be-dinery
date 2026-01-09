const supabase = require('../config/supabase');

const sendNotification = async (senderId, title, message, type, relatedId) => {
  try {
    // 1. Cari siapa pasangannya (Receiver)
    const { data: senderMember } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', senderId)
      .single();

    if (!senderMember) return;

    // Cari user ID pasangannya (yang BUKAN sender)
    const { data: partnerMember } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', senderMember.couple_id)
      .neq('user_id', senderId) // Not Equal sender
      .single();

    if (!partnerMember) return; // Jomblo atau belum bind, ga usah kirim notif

    // 2. Insert Notifikasi untuk Pasangan
    await supabase.from('notifications').insert({
      user_id: partnerMember.user_id, // Receiver
      title,
      message,
      type,
      related_id: relatedId,
      is_read: false
    });

    console.log(`🔔 Notif dikirim ke user ${partnerMember.user_id}`);

  } catch (err) {
    console.error("Gagal kirim notif:", err.message);
  }
};

module.exports = sendNotification;
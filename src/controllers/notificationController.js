const supabase = require('../config/supabase');

const notificationController = {
  // Get My Notifications
  getMyNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20); // Ambil 20 terakhir aja

      if (error) throw error;
      res.json({ data });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Mark as Read (Tandai sudah dibaca)
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId); // Security check

      if (error) throw error;
      res.json({ message: "Notifikasi ditandai sudah dibaca" });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = notificationController;
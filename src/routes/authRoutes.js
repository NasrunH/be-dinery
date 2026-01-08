const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/auth');

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected (Butuh Token)
router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile); // <--- Route Baru

module.exports = router;
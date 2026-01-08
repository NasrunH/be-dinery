const express = require('express');
const router = express.Router();

// Import Controller & Middleware
const coupleController = require('../controllers/coupleController');
const requireAuth = require('../middlewares/auth');

// Semua route di sini butuh Login (requireAuth)
router.use(requireAuth);

// Definisi Endpoint
router.get('/my-status', coupleController.getMyStatus);
router.post('/create', coupleController.createCouple);
router.post('/join', coupleController.joinCouple);

module.exports = router;
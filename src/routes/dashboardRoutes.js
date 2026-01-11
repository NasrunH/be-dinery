const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const requireAuth = require('../middlewares/auth');

// Middleware Auth Wajib
router.use(requireAuth);

// GET /api/dashboard/summary
router.get('/summary', dashboardController.getSummary);

module.exports = router;
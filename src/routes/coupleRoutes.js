const express = require('express');
const router = express.Router();
const coupleController = require('../controllers/coupleController');
const requireAuth = require('../middlewares/auth');

// Semua fitur couple butuh login
router.use(requireAuth);

router.get('/my-status', coupleController.getMyStatus);
router.post('/create', coupleController.createCouple);
router.post('/join', coupleController.joinCouple);

module.exports = router;
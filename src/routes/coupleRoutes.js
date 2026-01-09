const express = require('express');
const router = express.Router();
const coupleController = require('../controllers/coupleController');
const requireAuth = require('../middlewares/auth');

// Middleware Auth
router.use(requireAuth);

router.get('/my-status', coupleController.getMyStatus);
router.post('/create', coupleController.createCouple);
router.post('/join', coupleController.joinCouple);
router.put('/', coupleController.updateCouple); // <--- [BARU] Edit Nama Couple

module.exports = router;
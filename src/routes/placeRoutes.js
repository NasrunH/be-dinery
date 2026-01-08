const express = require('express');
const router = express.Router();
const placeController = require('../controllers/placeController');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

router.post('/preview', placeController.previewLink);
router.post('/', placeController.addPlace);
router.get('/wishlist', placeController.getWishlist);
router.get('/:id', placeController.getDetail);

module.exports = router;
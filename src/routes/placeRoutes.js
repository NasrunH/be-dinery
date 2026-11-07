const express = require('express');
const router = express.Router();
const placeController = require('../controllers/placeController');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

router.post('/preview', placeController.preview);
router.post('/resolve-maps', placeController.resolveMaps);
router.post('/reverse-geocode', placeController.reverseGeocode);
router.post('/', placeController.addPlace);
router.get('/', placeController.getWishlist);
router.get('/nearby', placeController.getNearby);

// [BARU] Gacha (Taruh sebelum /:id agar tidak error)
router.get('/gacha', placeController.gacha);

// [BARU] Service Sync Addresses (Taruh sebelum /:id)
router.post('/sync-addresses', placeController.syncAddresses);
router.get('/sync-addresses', placeController.syncAddresses);

// [BARU] Delete & Edit
router.put('/:id', placeController.updatePlace);
router.delete('/:id', placeController.deletePlace);

router.get('/:id', placeController.getDetail);

module.exports = router;
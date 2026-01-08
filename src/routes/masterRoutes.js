const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const requireAuth = require('../middlewares/auth');

// Public (tetap butuh auth biar aman)
router.use(requireAuth);

router.get('/categories', masterController.getCategories);
router.get('/prices', masterController.getPrices);
router.get('/tags', masterController.getTags);
router.post('/tags', masterController.createTag);

module.exports = router;
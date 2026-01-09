const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

router.get('/categories', masterController.getCategories);
router.get('/prices', masterController.getPrices);
router.get('/tags', masterController.getTags);   // Get Hybrid Tags
router.post('/tags', masterController.createTag); // Create Custom Tag

module.exports = router;
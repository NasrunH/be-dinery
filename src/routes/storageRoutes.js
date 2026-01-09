const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const requireAuth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.use(requireAuth);

// Endpoint: POST /api/storage/upload
// 'image' adalah nama field key di form-data nanti
router.post('/upload', upload.single('image'), storageController.uploadImage);

module.exports = router;
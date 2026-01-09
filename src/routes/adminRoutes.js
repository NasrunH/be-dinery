const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAuth = require('../middlewares/auth');
const requireAdmin = require('../middlewares/adminMiddleware');

// DOUBLE PROTECTION: Auth Token + Admin Role Check
router.use(requireAuth); 
router.use(requireAdmin);

// Stats
router.get('/stats', adminController.getStats);

// Manage Categories
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Manage Global Tags
router.post('/tags', adminController.createGlobalTag);
router.delete('/tags/:id', adminController.deleteTag);

module.exports = router;
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Middleware
const requireAuth = require('../middlewares/auth');
const requireAdmin = require('../middlewares/adminMiddleware');

// GLOBAL MIDDLEWARE (Auth + Admin Check)
router.use(requireAuth);
router.use(requireAdmin);

// 1. DASHBOARD & STATS
router.get('/stats', adminController.getStats);

// 2. MASTER DATA: CATEGORIES
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// 3. MASTER DATA: GLOBAL TAGS
router.post('/tags', adminController.createGlobalTag);
router.delete('/tags/:id', adminController.deleteTag);

// 4. USER MANAGEMENT
router.get('/users', adminController.getAllUsers);        // List All
router.get('/users/:id', adminController.getUserDetail);  // [BARU] Detail User
router.delete('/users/:id', adminController.deleteUser);  // Ban User

// 5. COUPLE MANAGEMENT
router.get('/couples', adminController.getAllCouples);

module.exports = router;
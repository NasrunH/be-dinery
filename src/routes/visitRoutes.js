const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

router.post('/', visitController.addVisit);
router.get('/history', visitController.getHistory);

module.exports = router;
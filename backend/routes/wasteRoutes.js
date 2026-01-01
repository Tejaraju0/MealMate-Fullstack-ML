const express = require('express');
const router = express.Router();
const wasteController = require('../controllers/wasteController');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/logs', wasteController.createWasteLog);
router.get('/logs', wasteController.getWasteLogs);
router.get('/analytics', wasteController.getWasteAnalytics);
router.post('/predict', wasteController.getWastePrediction);
router.get('/suggestions', wasteController.getSmartSuggestions);
router.delete('/logs/:id', auth, wasteController.deleteWasteLog);

module.exports = router;
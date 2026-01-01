
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/test', paymentController.testPayments);
router.post('/confirm-cash', paymentController.confirmCashPayment);
router.post('/create-checkout-session', paymentController.createCheckoutSession);
router.post('/handle-payment-success', paymentController.handlePaymentSuccess);
router.get('/status/:reservationId', paymentController.getPaymentStatus);
router.post('/manual-refund', paymentController.manualRefund);
router.get('/analytics', paymentController.getPaymentAnalytics);

module.exports = router;
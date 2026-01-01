const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/', reservationController.createReservation);
router.get('/', reservationController.getUserReservations);
router.get('/stats', reservationController.getReservationStats);
router.get('/:id', reservationController.getReservationById);
router.patch('/:id/status', reservationController.updateReservationStatus);
router.patch('/bulk-update', reservationController.bulkUpdateReservations);

module.exports = router;
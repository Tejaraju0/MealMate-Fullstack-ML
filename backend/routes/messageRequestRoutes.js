const express = require('express');
const router = express.Router();
const messageRequestController = require('../controllers/messageRequestController');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/', messageRequestController.sendMessageRequest);
router.get('/', messageRequestController.getMessageRequests);
router.get('/sent', messageRequestController.getSentMessageRequests);
router.patch('/:id', messageRequestController.handleMessageRequest);

module.exports = router;
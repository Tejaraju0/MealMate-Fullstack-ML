const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/conversations', messageController.createConversation);
router.get('/conversations', messageController.getConversations);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/conversations/:conversationId/messages', messageController.sendMessage);
router.patch('/conversations/:conversationId/read', messageController.markAsRead);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/requests', messageController.getMessageRequests);

module.exports = router;
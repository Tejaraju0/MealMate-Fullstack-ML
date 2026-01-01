const { Message, Conversation } = require('../models/message');
const User = require('../models/user');
const FoodListing = require('../models/foodListing');

exports.createConversation = async (req, res) => {
  try {
    const { foodListingId, initialMessage } = req.body;
    const userId = req.user.id;

    if (!foodListingId) {
      return res.status(400).json({ message: 'Food listing ID is required' });
    }

    const foodListing = await FoodListing.findById(foodListingId).populate('postedBy');
    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    const otherUserId = foodListing.postedBy._id;

    if (otherUserId.toString() === userId) {
      return res.status(400).json({ message: 'You cannot message yourself' });
    }

    const existingConversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
      foodListing: foodListingId
    });

    if (existingConversation) {
      return res.status(200).json({
        message: 'Conversation already exists',
        conversation: existingConversation,
        status: 'exists'
      });
    }

    const conversation = new Conversation({
      participants: [userId, otherUserId],
      foodListing: foodListingId
    });

    await conversation.save();

    if (initialMessage && initialMessage.trim()) {
      const message = new Message({
        conversation: conversation._id,
        sender: userId,
        recipient: otherUserId,
        content: {
          text: initialMessage.trim(),
          type: 'text'
        },
        metadata: {
          isInitialRequest: true 
        }
      });

      await message.save();
      conversation.lastMessage = message._id;
      await conversation.save();
    }


    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name email')
      .populate('foodListing', 'title category');

    res.status(201).json({
      message: 'Message request sent successfully',
      conversation: populatedConversation,
      status: 'request_sent'
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      message: 'Error creating conversation', 
      error: error.message 
    });
  }
};

// Get user's conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    })
    .populate('participants', 'name email')
    .populate('foodListing', 'title category imageUrl')
    .populate('lastMessage')
    .sort({ lastActivity: -1 });

    const formattedConversations = conversations.map(conversation => {
      const otherParticipant = conversation.participants.find(
        p => p._id.toString() !== userId
      );

      return {
        ...conversation.toObject(),
        otherParticipant,
        unreadCount: conversation.getUnreadCount(userId)
      };
    });

    res.status(200).json({
      conversations: formattedConversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ 
      message: 'Error fetching conversations', 
      error: error.message 
    });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      messages
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      message: 'Error fetching messages', 
      error: error.message 
    });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.text || !content.text.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to send messages in this conversation' });
    }

    const otherParticipantId = conversation.participants.find(
      id => id.toString() !== userId
    );

    const message = new Message({
      conversation: conversationId,
      sender: userId,
      recipient: otherParticipantId,
      content: {
        text: content.text?.trim() || '',
        type: content.type || 'text',
        imageUrl: content.imageUrl || null,
        location: content.location || null
      }
    });

    console.log("LOCATION OBJECT:", message.content.location);

    
    await message.save();

    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();

    const currentUnread = conversation.getUnreadCount(otherParticipantId);
    await conversation.setUnreadCount(otherParticipantId, currentUnread + 1);


    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email');

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: populatedMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      message: 'Error sending message', 
      error: error.message 
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        recipient: userId,
        readAt: { $exists: false }
      },
      {
        readAt: new Date()
      }
    );

    await conversation.setUnreadCount(userId, 0);

    res.status(200).json({
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ 
      message: 'Error marking messages as read', 
      error: error.message 
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    });

    let totalUnread = 0;
    
    for (const conversation of conversations) {
      const unreadCount = conversation.getUnreadCount(userId);
      totalUnread += unreadCount;
    }

    res.status(200).json({
      totalUnread
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(200).json({
      totalUnread: 0
    });
  }
};


exports.getMessageRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name email')
    .populate('foodListing', 'title category imageUrl')
    .populate('lastMessage');

    const requests = conversations.filter(conv => {
      const lastMessage = conv.lastMessage;
      if (!lastMessage) return false;
      
      return (
        lastMessage.sender.toString() !== userId && 
        lastMessage.metadata?.isInitialRequest &&
        !lastMessage.readAt 
      );
    });

    const formattedRequests = requests.map(conv => {
      const requester = conv.participants.find(p => p._id.toString() !== userId);
      return {
        _id: conv._id,
        requester,
        foodListing: conv.foodListing,
        message: conv.lastMessage.content.text,
        createdAt: conv.lastMessage.createdAt
      };
    });

    res.status(200).json({
      requests: formattedRequests
    });

  } catch (error) {
    console.error('Get message requests error:', error);
    res.status(200).json({
      requests: []
    });
  }
};
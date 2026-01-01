const MessageRequest = require('../models/messageRequest');
const FoodListing = require('../models/foodListing');
const User = require('../models/user');
const { Conversation } = require('../models/message');

// Send a message request
exports.sendMessageRequest = async (req, res) => {
  try {
    const { foodListingId, message } = req.body;
    const requesterId = req.user.id;

    const foodListing = await FoodListing.findById(foodListingId).populate('postedBy', 'name email');
    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    const recipientId = foodListing.postedBy._id;

    if (recipientId.toString() === requesterId) {
      return res.status(400).json({ message: 'You cannot send a message request to yourself' });
    }
    const existingRequest = await MessageRequest.findOne({
      requester: requesterId,
      recipient: recipientId,
      foodListing: foodListingId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending message request for this item' });
    }
    const existingConversation = await Conversation.findOne({
      participants: { $all: [requesterId, recipientId] },
      foodListing: foodListingId
    });

    if (existingConversation) {
      return res.status(400).json({ 
        message: 'You can already message about this item',
        conversationId: existingConversation._id
      });
    }

    const messageRequest = new MessageRequest({
      requester: requesterId,
      recipient: recipientId,
      foodListing: foodListingId,
      message: message
    });

    await messageRequest.save();

    const populatedRequest = await MessageRequest.findById(messageRequest._id)
      .populate('requester', 'name email')
      .populate('recipient', 'name email')
      .populate('foodListing', 'title category');

    res.status(201).json({
      message: 'Message request sent successfully',
      request: populatedRequest
    });

  } catch (error) {
    console.error('Send message request error:', error);
    res.status(500).json({ 
      message: 'Error sending message request', 
      error: error.message 
    });
  }
};

// Get user's message requests
exports.getMessageRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'pending', page = 1, limit = 10 } = req.query;

    let filter = { recipient: userId };
    if (status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await MessageRequest.find(filter)
      .populate('requester', 'name email phone')
      .populate('foodListing', 'title category imageUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MessageRequest.countDocuments(filter);

    res.status(200).json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get message requests error:', error);
    res.status(500).json({ 
      message: 'Error fetching message requests', 
      error: error.message 
    });
  }
};

// Handle message request
exports.handleMessageRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "accept" or "decline"' });
    }

    const messageRequest = await MessageRequest.findById(id)
      .populate('requester', 'name email')
      .populate('recipient', 'name email')
      .populate('foodListing', 'title category');

    if (!messageRequest) {
      return res.status(404).json({ message: 'Message request not found' });
    }

    if (messageRequest.recipient._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to handle this request' });
    }

    messageRequest.status = action === 'accept' ? 'accepted' : 'declined';
    messageRequest.respondedAt = new Date();
    await messageRequest.save();

    if (action === 'accept') {
      const existingConversation = await Conversation.findOne({
        participants: { $all: [messageRequest.requester._id, messageRequest.recipient._id] },
        foodListing: messageRequest.foodListing._id
      });

      if (!existingConversation) {
        const conversation = new Conversation({
          participants: [messageRequest.requester._id, messageRequest.recipient._id],
          foodListing: messageRequest.foodListing._id
        });
        await conversation.save();
      }
    }

    res.status(200).json({
      message: `Message request ${action}ed successfully`,
      request: messageRequest
    });

  } catch (error) {
    console.error('Handle message request error:', error);
    res.status(500).json({ 
      message: 'Error handling message request', 
      error: error.message 
    });
  }
};

// Get sent message requests
exports.getSentMessageRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'all', page = 1, limit = 10 } = req.query;

    let filter = { requester: userId };
    if (status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await MessageRequest.find(filter)
      .populate('recipient', 'name email phone')
      .populate('foodListing', 'title category imageUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MessageRequest.countDocuments(filter);

    res.status(200).json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get sent message requests error:', error);
    res.status(500).json({ 
      message: 'Error fetching sent message requests', 
      error: error.message 
    });
  }
};
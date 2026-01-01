const Reservation = require('../models/reservation');
const FoodListing = require('../models/foodListing');
const User = require('../models/user');
const { Conversation, Message } = require('../models/message');
const socketService = require('../services/socketService');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Create a unified reservation
exports.createReservation = async (req, res) => {
  try {
    const { foodListingId, message, urgencyLevel, contactMethod, paymentInfo } = req.body;
    const requesterId = req.user.id;

    console.log('Creating reservation:', { 
      foodListingId, 
      requesterId,
      paymentMethod: paymentInfo?.method 
    });

    const foodListing = await FoodListing.findById(foodListingId)
      .populate('postedBy', 'name email phone');

    if (!foodListing) {
      console.error(' Food listing not found:', foodListingId);
      return res.status(404).json({ message: 'Food listing not found' });
    }

    console.log('Food listing found:', foodListing.title);

    if (foodListing.status !== 'available' && foodListing.status !== 'reserved') {
      console.error('Food item not available. Status:', foodListing.status);
      return res.status(400).json({ 
        message: 'Food item is no longer available',
        currentStatus: foodListing.status 
      });
    }

    if (foodListing.postedBy._id.toString() === requesterId) {
      return res.status(400).json({ message: 'Cannot reserve your own food listing' });
    }

    const existingReservation = await Reservation.findOne({
      requester: requesterId,
      foodListing: foodListingId,
      status: { $in: ['pending', 'paid_pending', 'accepted', 'paid_accepted'] }
    });

    if (existingReservation) {
      console.log('Existing reservation found:', existingReservation._id);
      
      // Populate the existing reservation before returning
      await existingReservation.populate([
        { path: 'requester', select: 'name email phone' },
        { path: 'provider', select: 'name email phone' },
        { path: 'foodListing', select: 'title description category imageUrl location price quantity pickupTime' }
      ]);
      
      return res.status(400).json({ 
        message: 'You already have an active reservation for this item',
        existingReservation: existingReservation.toObject()
      });
    }
    let reservationStatus = 'pending';
    let enhancedMessage = message || `Hi! I'm interested in your ${foodListing.title}. When would be a good time to pick it up?`;
    let reservationPaymentInfo = {
      method: 'free',
      amount: 0,
      status: 'not_required',
      currency: 'GBP'
    };

    if (paymentInfo) {
      if (paymentInfo.method === 'cash_on_pickup') {
        reservationStatus = 'pending';
        enhancedMessage += `\n\n Payment Method: £${paymentInfo.amount} cash on pickup`;
        reservationPaymentInfo = {
          method: 'cash_on_pickup',
          amount: paymentInfo.amount,
          status: 'pending_cash',
          currency: 'GBP',
          note: 'Payment will be made in cash during pickup'
        };
      } else if (paymentInfo.method === 'stripe_escrow') {
        reservationStatus = 'paid_pending';
        enhancedMessage += `\n\n Payment: £${paymentInfo.amount} paid and held securely until pickup completion`;
        reservationPaymentInfo = {
          method: 'stripe_escrow',
          amount: paymentInfo.amount,
          status: 'escrowed',
          currency: 'GBP',
          stripePaymentIntentId: paymentInfo.stripePaymentIntentId,
          stripeSessionId: paymentInfo.stripeSessionId,
          paidAt: paymentInfo.paidAt || new Date(),
          escrowDetails: {
            autoRefundAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            canRefund: true,
            isHeld: true,
            capturedAt: null
          }
        };
      }
    }

    console.log(' Creating reservation with status:', reservationStatus);

    // Create reservation
    const reservation = new Reservation({
      requester: requesterId,
      provider: foodListing.postedBy._id,
      foodListing: foodListingId,
      message: enhancedMessage,
      urgencyLevel: urgencyLevel || 'normal',
      contactMethod: contactMethod || 'app',
      status: reservationStatus,
      paymentInfo: reservationPaymentInfo
    });

    await reservation.save();
    console.log('Reservation saved:', reservation._id);

    if (foodListing.status === 'available') {
      foodListing.status = 'reserved';
      foodListing.reservedBy = requesterId;
      foodListing.reservedAt = new Date();
      await foodListing.save();
      console.log(' Food listing status updated to reserved');
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [requesterId, foodListing.postedBy._id] },
      foodListing: foodListingId
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [requesterId, foodListing.postedBy._id],
        foodListing: foodListingId,
        type: 'reservation',
        lastActivity: new Date(),
        unreadCounts: new Map([
          [requesterId.toString(), 0],
          [foodListing.postedBy._id.toString(), 1]
        ])
      });
      await conversation.save();
      console.log('Conversation created:', conversation._id);
    }

    const newMessage = new Message({
      conversation: conversation._id,
      sender: requesterId,
      recipient: foodListing.postedBy._id,
      content: {
        text: enhancedMessage,
        type: 'system'
      },
      metadata: {
        isInitialRequest: true
      }
    });

    await newMessage.save();

    conversation.lastMessage = newMessage._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    if (socketService) {
      socketService.sendToUser(foodListing.postedBy._id, 'new_reservation', {
        reservation: reservation.toObject(),
        foodListing: foodListing.toObject(),
        requester: await User.findById(requesterId).select('name email')
      });

      socketService.sendToUser(foodListing.postedBy._id, 'new_message', {
        message: newMessage.toObject(), 
        conversationId: conversation._id
      });

      socketService.updateUnreadCounts([requesterId, foodListing.postedBy._id]);
    }

    await reservation.populate([
      { path: 'requester', select: 'name email phone' },
      { path: 'provider', select: 'name email phone' },
      { path: 'foodListing', select: 'title description category imageUrl location price quantity pickupTime' }
    ]);

    console.log(' Reservation created successfully:', {
      id: reservation._id,
      requester: reservation.requester?.name,
      provider: reservation.provider?.name,
      foodListing: reservation.foodListing?.title,
      status: reservation.status
    });

    let successMessage = 'Reservation request sent successfully';
    if (reservationStatus === 'paid_pending') {
      successMessage = 'Payment secured and reservation request sent! Provider will be notified.';
    }

    res.status(201).json({
      message: successMessage,
      reservation: reservation.toObject(),
      conversationId: conversation._id,
      paymentStatus: reservationPaymentInfo.status
    });

  } catch (error) {
    console.error(' Create reservation error:', error);
    res.status(500).json({ 
      message: 'Error creating reservation', 
      error: error.message 
    });
  }
};

// Get user's reservations with filtering
exports.getUserReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    let query = {
      $or: [
        { requester: userId },
        { provider: userId }
      ]
    };

    if (type === 'sent') {
      query = { requester: userId };
    } else if (type === 'received') {
      query = { provider: userId };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const foodQuery = await FoodListing.find({
        title: { $regex: search, $options: 'i' }
      }).select('_id');
      
      const foodIds = foodQuery.map(food => food._id);
      
      query.$and = [
        query,
        {
          $or: [
            { 'foodListing.title': { $regex: search, $options: 'i' } },
            { foodListing: { $in: foodIds } },
            { message: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('requester', 'name email phone')
        .populate('provider', 'name email phone')
        .populate('foodListing', 'title description quantity category imageUrl location pickupTime status price')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      
      Reservation.countDocuments(query)
    ]);

    const enrichedReservations = reservations.map(reservation => {
      const isRequester = reservation.requester._id.toString() === userId;
      const isProvider = reservation.provider._id.toString() === userId;
      
      return {
        ...reservation,
        isRequester,
        isProvider,
        otherUser: isRequester ? reservation.provider : reservation.requester,
        canCancel: isRequester && ['pending', 'paid_pending'].includes(reservation.status),
        canAccept: isProvider && ['pending', 'paid_pending'].includes(reservation.status),
        canReject: isProvider && ['pending', 'paid_pending'].includes(reservation.status),
        canComplete: ['accepted', 'paid_accepted'].includes(reservation.status),
        canRate: reservation.status === 'completed' && !reservation.rating,
        paymentHeld: reservation.paymentInfo?.status === 'escrowed',
        needsPaymentRelease: reservation.status === 'paid_accepted' && reservation.paymentInfo?.status === 'escrowed',
        timeUntilPickup: reservation.pickupTime ? 
          Math.max(0, new Date(reservation.pickupTime) - new Date()) : null
      };
    });

    res.status(200).json({
      reservations: enrichedReservations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasMore: skip + reservations.length < total
      }
    });

  } catch (error) {
    console.error('Get user reservations error:', error);
    res.status(500).json({ 
      message: 'Error fetching reservations', 
      error: error.message 
    });
  }
};

// Provider accepts or rejects reservation 
exports.updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message: statusMessage, rating } = req.body;
    const userId = req.user.id;

    const reservation = await Reservation.findById(id)
      .populate('requester', 'name email')
      .populate('provider', 'name email')
      .populate('foodListing', 'title status price');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const isRequester = reservation.requester._id.toString() === userId;
    const isProvider = reservation.provider._id.toString() === userId;

    const validTransitions = {
      'accepted': () => isProvider && ['pending', 'paid_pending'].includes(reservation.status),
      'rejected': () => isProvider && ['pending', 'paid_pending'].includes(reservation.status),
      
      'cancelled': () => isRequester && ['pending', 'paid_pending', 'accepted'].includes(reservation.status),
      
      'completed': () => (isRequester || isProvider) && ['accepted', 'paid_accepted'].includes(reservation.status)
    };

    if (!validTransitions[status] || !validTransitions[status]()) {
      return res.status(403).json({ 
        message: 'Not authorized to perform this action on this reservation' 
      });
    }

    const oldStatus = reservation.status;
    let needsRefund = false;
    let systemMessageText = statusMessage;

    if (status === 'accepted') {
      if (oldStatus === 'pending') {
        reservation.status = 'accepted';
      } else if (oldStatus === 'paid_pending') {
        reservation.status = 'paid_accepted';
      }
      reservation.acceptedAt = new Date();
      systemMessageText = systemMessageText || `Great news! ${reservation.provider.name} has accepted your reservation. You can now coordinate pickup details.`;
      
    } else if (status === 'rejected') {

      if (oldStatus === 'paid_pending') {
        reservation.status = 'paid_rejected';
        needsRefund = true;
        systemMessageText = systemMessageText || `${reservation.provider.name} has declined your reservation. Your payment has been refunded and will appear in your account within 3-5 business days.`;
      } else {
        reservation.status = 'rejected';
        systemMessageText = systemMessageText || `${reservation.provider.name} has declined your reservation. Don't worry - there are many other great options available!`;
      }
      
      await FoodListing.findByIdAndUpdate(reservation.foodListing._id, {
        status: 'available',
        reservedBy: null,
        reservedAt: null
      });
      
    } else if (status === 'cancelled') {
      if (['paid_pending', 'paid_accepted'].includes(oldStatus)) {
        reservation.status = 'paid_cancelled';
        needsRefund = true;
        systemMessageText = systemMessageText || `Reservation cancelled. Your payment has been refunded.`;
      } else {
        reservation.status = 'cancelled';
        systemMessageText = systemMessageText || `${reservation.requester.name} has cancelled their reservation.`;
      }
      
      await FoodListing.findByIdAndUpdate(reservation.foodListing._id, {
        status: 'available',
        reservedBy: null,
        reservedAt: null
      });
      
    } else if (status === 'completed') {
      reservation.status = 'completed';
      reservation.completedAt = new Date();
      
      if (reservation.paymentInfo.method === 'cash_on_pickup') {
        reservation.paymentInfo.status = 'completed_cash';
        reservation.paymentInfo.paidAt = new Date();
      } else if (reservation.paymentInfo.method === 'stripe_escrow' && oldStatus === 'paid_accepted') {
        if (stripe) {
          try {
            await stripe.paymentIntents.capture(
              reservation.paymentInfo.stripePaymentIntentId,
              {
                amount_to_capture: Math.round(reservation.paymentInfo.amount * 100)
              }
            );
            reservation.paymentInfo.status = 'captured';
            reservation.paymentInfo.escrowDetails.isHeld = false;
            reservation.paymentInfo.escrowDetails.capturedAt = new Date();
          } catch (stripeError) {
            console.error('Error capturing payment:', stripeError);
            return res.status(500).json({ message: 'Error processing payment release' });
          }
        }
      }
      
      if (rating && rating.score) {
        reservation.rating = {
          score: rating.score,
          review: rating.review || '',
          ratedBy: userId,
          ratedAt: new Date()
        };
      }
      
      systemMessageText = systemMessageText || `Pickup completed! Hope you enjoyed the food. ${rating ? 'Thanks for the rating!' : ''}`;
    }

    reservation.respondedAt = new Date();

    if (needsRefund && stripe && reservation.paymentInfo.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(reservation.paymentInfo.stripePaymentIntentId);
        reservation.paymentInfo.status = 'refunded';
        reservation.paymentInfo.escrowDetails.isHeld = false;
        reservation.paymentInfo.escrowDetails.refundedAt = new Date();
        reservation.paymentInfo.escrowDetails.refundReason = status;
      } catch (stripeError) {
        console.error('Error processing refund:', stripeError);
        return res.status(500).json({ message: 'Error processing refund' });
      }
    }

    await reservation.save();

    const conversation = await Conversation.findOne({
      participants: { $all: [reservation.requester._id, reservation.provider._id] },
      foodListing: reservation.foodListing._id
    });

    if (conversation) {
      const recipientId = reservation.requester._id.toString() === userId ? 
        reservation.provider._id : reservation.requester._id;
      
      const newMessage = new Message({
        conversation: conversation._id,
        sender: userId,
        recipient: recipientId,
        content: {
          text: systemMessageText,
          type: 'system'
        }
      });

      await newMessage.save();

      conversation.lastMessage = newMessage._id;
      conversation.lastActivity = new Date();

      const currentUnread = conversation.getUnreadCount(recipientId) || 0;
      conversation.unreadCount.set(recipientId.toString(), currentUnread + 1);
      
      await conversation.save();

      if (socketService) {
        socketService.sendToUser(recipientId, 'reservation_updated', {
          reservation: reservation.toObject(),
          message: newMessage.toObject()
        });

        socketService.sendToUser(recipientId, 'new_message', {
          message: newMessage.toObject(),
          conversationId: conversation._id
        });

        socketService.updateUnreadCounts([reservation.requester._id, reservation.provider._id]);
      }
    }

    let responseMessage = `Reservation ${status} successfully`;
    if (needsRefund) {
      responseMessage += '. Refund processed and will appear in account within 3-5 business days.';
    } else if (status === 'completed' && reservation.paymentInfo.status === 'captured') {
      responseMessage += '. Payment released to provider.';
    }

    res.status(200).json({
      message: responseMessage,
      reservation: reservation.toObject(),
      statusMessage: systemMessageText,
      paymentAction: needsRefund ? 'refunded' : (reservation.paymentInfo.status === 'captured') ? 'released' : null
    });

  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({ 
      message: 'Error updating reservation status', 
      error: error.message 
    });
  }
};

// Get single reservation details with conversation context
exports.getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reservation = await Reservation.findById(id)
      .populate('requester', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('foodListing', 'title description quantity category imageUrl location pickupTime status price');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.requester._id.toString() !== userId && reservation.provider._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this reservation' });
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [reservation.requester._id, reservation.provider._id] },
      foodListing: reservation.foodListing._id
    });

    const isRequester = reservation.requester._id.toString() === userId;
    const isProvider = reservation.provider._id.toString() === userId;

    const enrichedReservation = {
      ...reservation.toObject(),
      isRequester,
      isProvider,
      otherUser: isRequester ? reservation.provider : reservation.requester,
      conversationId: conversation?._id,
      canCancel: isRequester && ['pending', 'paid_pending'].includes(reservation.status),
      canAccept: isProvider && ['pending', 'paid_pending'].includes(reservation.status),
      canReject: isProvider && ['pending', 'paid_pending'].includes(reservation.status),
      canComplete: ['accepted', 'paid_accepted'].includes(reservation.status),
      paymentHeld: reservation.paymentInfo?.status === 'escrowed',
      needsPaymentRelease: reservation.status === 'paid_accepted' && reservation.paymentInfo?.status === 'escrowed',
      timeUntilPickup: reservation.pickupTime ? 
        Math.max(0, new Date(reservation.pickupTime) - new Date()) : null
    };

    res.status(200).json({ 
      reservation: enrichedReservation,
      conversation: conversation ? {
        _id: conversation._id,
        lastActivity: conversation.lastActivity
      } : null
    });

  } catch (error) {
    console.error('Get reservation by ID error:', error);
    res.status(500).json({ 
      message: 'Error fetching reservation', 
      error: error.message 
    });
  }
};

// Get reservation statistics
exports.getReservationStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      totalRequested,
      totalReceived,
      pendingRequests,
      completedReservations,
      avgRatingResult,
      recentActivity,
      statusBreakdown,
      paymentBreakdown
    ] = await Promise.all([

      Reservation.countDocuments({ requester: userId }),
      
      Reservation.countDocuments({ provider: userId }),
      
      Reservation.countDocuments({ 
        $or: [{ requester: userId }, { provider: userId }],
        status: { $in: ['pending', 'paid_pending'] }
      }),
      
      Reservation.countDocuments({ 
        $or: [{ requester: userId }, { provider: userId }],
        status: 'completed'
      }),
      
      Reservation.aggregate([
        { $match: { provider: userId, 'rating.score': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating.score' }, count: { $sum: 1 } } }
      ]),

      Reservation.countDocuments({
        $or: [{ requester: userId }, { provider: userId }],
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),

      Reservation.aggregate([
        { $match: { $or: [{ requester: userId }, { provider: userId }] } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      Reservation.aggregate([
        { $match: { $or: [{ requester: userId }, { provider: userId }] } },
        { $group: { _id: '$paymentInfo.method', count: { $sum: 1 } } }
      ])
    ]);

    const avgRating = avgRatingResult[0];
    const statusCounts = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const paymentCounts = paymentBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const totalReservations = totalRequested + totalReceived;
    const successRate = totalReservations > 0 ? 
      Math.round((completedReservations / totalReservations) * 100) : 0;

    const respondedRequests = await Reservation.countDocuments({
      provider: userId,
      status: { $in: ['accepted', 'rejected', 'paid_accepted', 'paid_rejected'] }
    });
    const responseRate = totalReceived > 0 ?
      Math.round((respondedRequests / totalReceived) * 100) : 0;

    res.status(200).json({
      stats: {
        totalRequested,
        totalReceived,
        pendingRequests,
        completedReservations,
        recentActivity,
        successRate,
        responseRate,
        avgRating: avgRating ? {
          score: Math.round(avgRating.avgRating * 10) / 10,
          count: avgRating.count
        } : null,
        statusBreakdown: statusCounts,
        paymentBreakdown: paymentCounts
      }
    });

  } catch (error) {
    console.error('Get reservation stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching reservation statistics', 
      error: error.message 
    });
  }
};

// Get pending count for real-time updates
exports.getPendingCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await Reservation.countDocuments({
      provider: userId,
      status: { $in: ['pending', 'paid_pending'] }
    });

    res.status(200).json({ count });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ 
      message: 'Error fetching pending count', 
      error: error.message 
    });
  }
};

// Bulk update reservations
exports.bulkUpdateReservations = async (req, res) => {
  try {
    const { reservationIds, status, message } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      return res.status(400).json({ message: 'Invalid reservation IDs' });
    }

    const reservations = await Reservation.find({
      _id: { $in: reservationIds },
      $or: [{ requester: userId }, { provider: userId }]
    });

    if (reservations.length !== reservationIds.length) {
      return res.status(403).json({ 
        message: 'Not authorized to update some reservations' 
      });
    }

    const updateData = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    updateData.respondedAt = new Date();

    const result = await Reservation.updateMany(
      { _id: { $in: reservationIds } },
      updateData
    );

    res.status(200).json({
      message: `Successfully updated ${result.modifiedCount} reservations`,
      updated: result.modifiedCount
    });

  } catch (error) {
    console.error('Bulk update reservations error:', error);
    res.status(500).json({ 
      message: 'Error bulk updating reservations', 
      error: error.message 
    });
  }
};

module.exports = exports;
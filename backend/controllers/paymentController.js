const FoodListing = require('../models/foodListing');
const Reservation = require('../models/reservation');
const User = require('../models/user');

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized successfully');
} else {
  console.log('No Stripe key found - only cash payments will work');
}

// Handle cash payment confirmation 
exports.confirmCashPayment = async (req, res) => {
  try {
    const { foodId, message } = req.body;
    const userId = req.user.id;

    console.log('Cash payment confirmation:', { foodId, userId });

    const foodItem = await FoodListing.findById(foodId);
    if (!foodItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Food item not found' 
      });
    }

    if (foodItem.status !== 'available') {
      return res.status(400).json({ 
        success: false, 
        message: 'Food item is no longer available' 
      });
    }

    const paymentInfo = {
      method: 'cash_on_pickup',
      amount: foodItem.price || 0,
      currency: 'GBP',
      status: 'pending_cash',
      note: message || 'Payment will be made in cash during pickup'
    };

    res.json({
      success: true,
      message: 'Cash payment method confirmed',
      paymentInfo,
      nextStep: 'create_reservation'
    });

  } catch (error) {
    console.error('Cash payment confirmation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to confirm cash payment',
      error: error.message 
    });
  }
};

// Create Stripe checkout session 
exports.createCheckoutSession = async (req, res) => {
  console.log('createCheckoutSession called with body:', req.body);
  console.log('User ID:', req.user?.id);
  
  try {
    if (!stripe) {
      console.log('Stripe not configured, returning error');
      return res.status(503).json({ 
        success: false, 
        message: 'Online payments are not available. Please use cash payment.' 
      });
    }

    const { foodId } = req.body;
    const userId = req.user.id;

    console.log('Looking for food item:', foodId);
    
    const foodItem = await FoodListing.findById(foodId).populate('postedBy', 'name email');
    
    if (!foodItem) {
      console.log('Food item not found');
      return res.status(404).json({ success: false, message: 'Food item not found' });
    }

    console.log('Food item found:', foodItem.title, 'Price:', foodItem.price);

    if (foodItem.isFree || foodItem.status !== 'available') {

      return res.status(400).json({ success: false, message: 'Invalid food item' });
    }

    if (foodItem.postedBy._id.toString() === userId) {
      console.log('User trying to buy own food');
      return res.status(400).json({ success: false, message: 'Cannot buy your own food' });
    }


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: ` ${foodItem.title}`,
            description: `Payment held securely until pickup completion`,
            images: foodItem.imageUrl ? [foodItem.imageUrl] : [],
          },
          unit_amount: Math.round(foodItem.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        metadata: {
          foodId: foodItem._id.toString(),
          userId: userId,
          providerId: foodItem.postedBy._id.toString(),
          escrowType: 'food_payment'
        },
        description: `MealMate Escrow: ${foodItem.title}`,
      },

      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/individual-dashboard?payment=success&food=${foodItem._id.toString()}&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/individual-dashboard?payment=cancelled`,
      metadata: {
        foodId: foodItem._id.toString(),  
        userId: userId,
      }
    });


    res.json({ success: true, sessionUrl: session.url });
    
  } catch (error) {
    console.error('Detailed error in createCheckoutSession:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment failed',
      error: error.message
    });
  }
};

// Handle successful Stripe payment 
exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { sessionId, foodId: frontendFoodId } = req.body; 
    const userId = req.user.id;

    console.log('Handling payment success:', { sessionId, frontendFoodId, userId });

    if (!stripe) {
      return res.status(503).json({ 
        success: false, 
        message: 'Payment processing not available' 
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });

    console.log('Session retrieved:', {
      id: session.id,
      payment_status: session.payment_status,
      payment_intent_status: session.payment_intent?.status,
      metadata: session.metadata
    });

    const paymentIntent = session.payment_intent;

    if (!paymentIntent) {
      console.log('No payment intent found in session');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment session' 
      });
    }

    console.log('Payment intent status:', paymentIntent.status);

    if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
      console.log('Payment not ready. Status:', paymentIntent.status);
      return res.status(400).json({ 
        success: false, 
        message: `Payment not ready: ${paymentIntent.status}`
      });
    }

    const foodId = session.metadata.foodId || frontendFoodId;
    
    console.log('Food ID from metadata:', session.metadata.foodId);
    console.log('Food ID from frontend:', frontendFoodId);
    console.log('Using Food ID:', foodId);

    if (!foodId) {
      console.error('No food ID available in session or request');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing food item information' 
      });
    }
    const foodItem = await FoodListing.findById(foodId);
    if (!foodItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Food item not found' 
      });
    }

    console.log('Payment verified successfully for:', foodItem.title);

    const paymentInfo = {
      method: 'stripe_escrow',
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'escrowed',
      stripePaymentIntentId: paymentIntent.id,
      stripeSessionId: session.id,
      paidAt: new Date()
    };

    res.json({
      success: true,
      message: 'Payment secured in escrow!',
      paymentInfo,
      foodItem: {  
        _id: foodItem._id,
        title: foodItem.title,
        description: foodItem.description,
        price: foodItem.price,
        imageUrl: foodItem.imageUrl,
        category: foodItem.category
      },
      nextStep: 'create_reservation'
    });

  } catch (error) {
    console.error('Payment success handling error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process payment confirmation',
      error: error.message 
    });
  }
};

// Get payment status for a reservation
exports.getPaymentStatus = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user.id;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reservation not found' 
      });
    }

    const isAuthorized = reservation.requester.toString() === userId || 
                        reservation.provider.toString() === userId;
    
    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const paymentStatus = {
      method: reservation.paymentInfo.method,
      amount: reservation.paymentInfo.amount,
      currency: reservation.paymentInfo.currency,
      status: reservation.paymentInfo.status,
      paidAt: reservation.paymentInfo.paidAt
    };

    if (reservation.paymentInfo.method === 'stripe_escrow' && reservation.paymentInfo.escrowDetails) {
      paymentStatus.escrow = {
        isHeld: reservation.paymentInfo.escrowDetails.isHeld,
        autoRefundAt: reservation.paymentInfo.escrowDetails.autoRefundAt,
        canRefund: reservation.paymentInfo.escrowDetails.canRefund,
        capturedAt: reservation.paymentInfo.escrowDetails.capturedAt,
        refundedAt: reservation.paymentInfo.escrowDetails.refundedAt
      };
    }

    res.json({
      success: true,
      paymentInfo: paymentStatus,
      reservationStatus: reservation.status
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get payment status',
      error: error.message 
    });
  }
};

// Manual refund 
exports.manualRefund = async (req, res) => {
  try {
    const { reservationId, reason } = req.body;
    const userId = req.user.id;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reservation not found' 
      });
    }

    const canRefund = reservation.provider.toString() === userId;
    
    if (!canRefund) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to refund' 
      });
    }

    if (!stripe || !reservation.paymentInfo.stripePaymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot process refund for this payment method' 
      });
    }

    await stripe.paymentIntents.cancel(reservation.paymentInfo.stripePaymentIntentId);

    reservation.status = 'refunded';
    reservation.paymentInfo.status = 'refunded';
    if (reservation.paymentInfo.escrowDetails) {
      reservation.paymentInfo.escrowDetails.isHeld = false;
      reservation.paymentInfo.escrowDetails.refundedAt = new Date();
      reservation.paymentInfo.escrowDetails.refundReason = reason || 'Manual refund';
    }
    await reservation.save();

    await FoodListing.findByIdAndUpdate(reservation.foodListing, {
      status: 'available',
      reservedBy: null,
      reservedAt: null
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refundAmount: reservation.paymentInfo.amount
    });

  } catch (error) {
    console.error('Manual refund error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process refund',
      error: error.message 
    });
  }
};

exports.getPaymentAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      totalEarned,
      totalSpent,
      escrowHeld,
      paymentBreakdown,
      recentTransactions
    ] = await Promise.all([
      Reservation.aggregate([
        { 
          $match: { 
            provider: userId, 
            status: 'completed',
            'paymentInfo.status': { $in: ['captured', 'completed_cash'] }
          } 
        },
        { $group: { _id: null, total: { $sum: '$paymentInfo.amount' } } }
      ]),

      Reservation.aggregate([
        { 
          $match: { 
            requester: userId, 
            status: 'completed',
            'paymentInfo.status': { $in: ['captured', 'completed_cash'] }
          } 
        },
        { $group: { _id: null, total: { $sum: '$paymentInfo.amount' } } }
      ]),

      Reservation.aggregate([
        { 
          $match: { 
            $or: [{ requester: userId }, { provider: userId }],
            'paymentInfo.status': 'escrowed'
          } 
        },
        { $group: { _id: null, total: { $sum: '$paymentInfo.amount' } } }
      ]),

      Reservation.aggregate([
        { $match: { $or: [{ requester: userId }, { provider: userId }] } },
        { 
          $group: { 
            _id: '$paymentInfo.method', 
            count: { $sum: 1 },
            totalAmount: { $sum: '$paymentInfo.amount' }
          } 
        }
      ]),

      Reservation.find({
        $or: [{ requester: userId }, { provider: userId }],
        'paymentInfo.method': { $ne: 'free' }
      })
      .populate('foodListing', 'title')
      .populate('requester', 'name')
      .populate('provider', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('status paymentInfo createdAt completedAt')
    ]);

    res.json({
      success: true,
      analytics: {
        totalEarned: totalEarned[0]?.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
        escrowHeld: escrowHeld[0]?.total || 0,
        paymentBreakdown: paymentBreakdown.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        recentTransactions: recentTransactions.map(tx => ({
          id: tx._id,
          foodTitle: tx.foodListing.title,
          otherUser: tx.requester._id.toString() === userId ? tx.provider.name : tx.requester.name,
          amount: tx.paymentInfo.amount,
          method: tx.paymentInfo.method,
          status: tx.status,
          date: tx.createdAt,
          completedAt: tx.completedAt
        }))
      }
    });

  } catch (error) {
    console.error('Get payment analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get payment analytics',
      error: error.message 
    });
  }
};

// Test endpoint to verify payment controller
exports.testPayments = (req, res) => {
  res.json({
    success: true,
    message: 'Payment controller is working!',
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    user: req.user?.id || 'No user',
    timestamp: new Date().toISOString()
  });
};

module.exports = exports;
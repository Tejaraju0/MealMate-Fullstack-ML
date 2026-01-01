const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  foodListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodListing',
    required: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  message: {
    type: String,
    required: true,
    trim: true
  },
  
  status: {
    type: String,
    enum: [
      'pending',           
      'paid_pending',      
      'accepted',          
      'paid_accepted',     
      'rejected',          
      'paid_rejected',     
      'cancelled',         
      'paid_cancelled',    
      'completed',         
      'auto_refunded'      
    ],
    default: 'pending'
  },

  paymentInfo: {
    method: {
      type: String,
      enum: ['free', 'cash_on_pickup', 'stripe_escrow'],
      default: 'free'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'GBP',
      uppercase: true
    },
    status: {
      type: String,
      enum: [
        'not_required',      
        'pending_cash',      
        'completed_cash',    
        'escrowed',          
        'captured',          
        'refunded'           
      ],
      default: 'not_required'
    },
    
    stripePaymentIntentId: String,
    stripeSessionId: String,
    paidAt: Date,
    
    escrowDetails: {
      autoRefundAt: Date,
      canRefund: {
        type: Boolean,
        default: false
      },
      isHeld: {
        type: Boolean,
        default: false
      },
      capturedAt: Date,
      refundedAt: Date,
      refundReason: String
    },
    note: String
  },
 
  urgencyLevel: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  contactMethod: {
    type: String,
    enum: ['app', 'phone', 'email'],
    default: 'app'
  },

  pickupTime: Date,

  
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  respondedAt: Date,
  completedAt: Date,

  
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ratedAt: Date
  },

  
  metadata: {
    ipAddress: String,
    userAgent: String,
    platform: String
  }
}, {
  timestamps: true
});

reservationSchema.index({ requester: 1, status: 1 });
reservationSchema.index({ provider: 1, status: 1 });
reservationSchema.index({ foodListing: 1 });
reservationSchema.index({ status: 1, createdAt: -1 });
reservationSchema.index({ 'paymentInfo.status': 1 });
reservationSchema.index({ 'paymentInfo.stripePaymentIntentId': 1 }, { sparse: true });

reservationSchema.virtual('paymentHeld').get(function() {
  return this.paymentInfo && 
         this.paymentInfo.method === 'stripe_escrow' && 
         this.paymentInfo.status === 'escrowed' &&
         this.paymentInfo.escrowDetails?.isHeld;
});

reservationSchema.virtual('needsPaymentRelease').get(function() {
  return this.status === 'paid_accepted' && 
         this.paymentInfo?.status === 'escrowed';
});

reservationSchema.methods.canCancel = function(userId) {
  return this.requester.toString() === userId && 
         ['pending', 'paid_pending', 'accepted'].includes(this.status);
};

reservationSchema.methods.canAccept = function(userId) {
  return this.provider.toString() === userId && 
         ['pending', 'paid_pending'].includes(this.status);
};

reservationSchema.methods.canReject = function(userId) {
  return this.provider.toString() === userId && 
         ['pending', 'paid_pending'].includes(this.status);
};

reservationSchema.methods.canComplete = function(userId) {
  const isParticipant = this.requester.toString() === userId || 
                       this.provider.toString() === userId;
  return isParticipant && 
         ['accepted', 'paid_accepted'].includes(this.status);
};

reservationSchema.methods.canRate = function(userId) {
  const isParticipant = this.requester.toString() === userId || 
                       this.provider.toString() === userId;
  return isParticipant && 
         this.status === 'completed' && 
         !this.rating;
};

reservationSchema.pre('save', function(next) {
  
  if (this.isModified('status') && 
      this.status !== 'pending' && 
      this.status !== 'paid_pending' && 
      !this.respondedAt) {
    this.respondedAt = new Date();
  }

  if (this.isModified('status') && 
      (this.status === 'accepted' || this.status === 'paid_accepted') && 
      !this.acceptedAt) {
    this.acceptedAt = new Date();
  }

  if (this.isModified('status') && 
      this.status === 'completed' && 
      !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

reservationSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { requester: mongoose.Types.ObjectId(userId) },
          { provider: mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $facet: {
        statusCounts: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        paymentCounts: [
          { $group: { _id: '$paymentInfo.method', count: { $sum: 1 } } }
        ],
        totalEarned: [
          {
            $match: {
              provider: mongoose.Types.ObjectId(userId),
              status: 'completed',
              'paymentInfo.status': { $in: ['captured', 'completed_cash'] }
            }
          },
          { $group: { _id: null, total: { $sum: '$paymentInfo.amount' } } }
        ],
        totalSpent: [
          {
            $match: {
              requester: mongoose.Types.ObjectId(userId),
              status: 'completed',
              'paymentInfo.status': { $in: ['captured', 'completed_cash'] }
            }
          },
          { $group: { _id: null, total: { $sum: '$paymentInfo.amount' } } }
        ],
        avgRating: [
          {
            $match: {
              provider: mongoose.Types.ObjectId(userId),
              'rating.score': { $exists: true }
            }
          },
          { $group: { _id: null, avg: { $avg: '$rating.score' }, count: { $sum: 1 } } }
        ]
      }
    }
  ]);

  return stats[0];
};
reservationSchema.statics.findExpiredEscrows = async function() {
  return this.find({
    status: 'paid_pending',
    'paymentInfo.status': 'escrowed',
    'paymentInfo.escrowDetails.autoRefundAt': { $lte: new Date() },
    'paymentInfo.escrowDetails.isHeld': true
  });
};

reservationSchema.set('toJSON', { virtuals: true });
reservationSchema.set('toObject', { virtuals: true });

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;
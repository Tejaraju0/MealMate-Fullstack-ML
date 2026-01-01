const mongoose = require('mongoose');

// Message Schema
const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      maxlength: 1000
    },
    type: {
      type: String,
      enum: ['text', 'image', 'location', 'system'],
      default: 'text'
    },
    imageUrl: String,
    location: {
      address: String,
      coordinates: [Number] 
    }
  },
  readAt: Date,
  editedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  metadata: {
    deliveredAt: Date,
    failedAt: Date,
    retryCount: {
      type: Number,
      default: 0
    },
    isInitialRequest: { 
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, readAt: 1 });

messageSchema.virtual('isRead').get(function() {
  return !!this.readAt;
});

messageSchema.virtual('timeSent').get(function() {
  const now = new Date();
  const sent = new Date(this.createdAt);
  const diff = now - sent;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// Conversation Schema
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  foodListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodListing'
  },
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ foodListing: 1 });
conversationSchema.index({ lastActivity: -1 });

conversationSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Conversation must have exactly 2 participants'));
  }
  next();
});

conversationSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

conversationSchema.methods.getUnreadCount = function(userId) {
  const userIdStr = userId.toString();
  return this.unreadCount.get(userIdStr) || 0;
};

conversationSchema.methods.setUnreadCount = function(userId, count) {
  const userIdStr = userId.toString();
  this.unreadCount.set(userIdStr, count);
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
const mongoose = require('mongoose');

const messageRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  foodListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodListing',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  respondedAt: Date
}, {
  timestamps: true
});

// Indexes
messageRequestSchema.index({ recipient: 1, status: 1 });
messageRequestSchema.index({ requester: 1, status: 1 });
messageRequestSchema.index({ foodListing: 1 });

module.exports = mongoose.model('MessageRequest', messageRequestSchema);
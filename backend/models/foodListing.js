const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    index: true,
  },
  description: String,
  quantity: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    index: true
  },
  ingredients: {
    type: [String], 
    default: [],
    index: true
  },

  images: {
    type: [String], 
    default: [],
    validate: {
      validator: function(images) {
        return images.length <= 5;
      },
      message: 'Maximum 5 images allowed per listing'
    }
  },

  imageUrl: {
    type: String,
    default: '',
  },

  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere',
      required: true
    },
    address: String
  },
  isFree: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    default: 0
  },
  expiryDate: Date,
  pickupTime: {
    type: Date, 
    index: true 
  },
  expiredAt: Date,
  status: {
    type: String,
    enum: ['available', 'reserved', 'collected', 'expired'],
    default: 'available',
    index: true 
  },
  reservedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reservedAt: Date,
  collectedAt: Date,
  views: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  isHotDeal: {
    type: Boolean,
    default: false,
    index: true
  },
  hotDealScore: {
    type: Number,
    default: 0
  },
  originalPrice: {
    type: Number,
    default: null
  },
});

foodListingSchema.index({ status: 1, createdAt: -1 });
foodListingSchema.index({ postedBy: 1, status: 1 });
foodListingSchema.index({ status: 1, expiryDate: 1 });
foodListingSchema.index({ status: 1, pickupTime: 1 });
foodListingSchema.index({ status: 1, location: '2dsphere' });

foodListingSchema.virtual('isExpired').get(function() {
  const now = new Date();
  
  if (this.status === 'expired') return true;
  
  if (this.expiryDate && this.expiryDate <= now) return true;
  
  if (this.pickupTime && this.pickupTime <= now) return true;
  
  return false;
});

// Virtual to get time remaining until expiry
foodListingSchema.virtual('timeUntilExpiry').get(function() {
  const now = new Date();
  let earliestExpiry = null;
  
  if (this.expiryDate && this.expiryDate > now) {
    earliestExpiry = this.expiryDate;
  }
  
  if (this.pickupTime && this.pickupTime > now) {
    if (!earliestExpiry || this.pickupTime < earliestExpiry) {
      earliestExpiry = this.pickupTime;
    }
  }
  
  return earliestExpiry ? earliestExpiry - now : null;
});

// Pre-save hook to auto-expire items
foodListingSchema.pre('save', function(next) {
  if (['available', 'reserved'].includes(this.status) && this.isExpired) {
    this.status = 'expired';
    if (!this.expiredAt) {
      this.expiredAt = new Date();
    }
    console.log(`Auto-expired food listing: ${this.title} (${this._id})`);
  }
  next();
});

foodListingSchema.pre(['find', 'findOne', 'findOneAndUpdate'], async function() {
  try {
    const now = new Date();
    await this.model.updateMany(
      {
        status: { $in: ['available', 'reserved'] },
        $or: [
          { expiryDate: { $lte: now } },
          { pickupTime: { $lte: now } }
        ]
      },
      {
        status: 'expired',
        expiredAt: now
      }
    );
  } catch (error) {
    console.error('Error in pre-find expiry check:', error);
  }
});

foodListingSchema.methods.checkAndUpdateExpiry = function() {
  if (this.isExpired && this.status !== 'expired') {
    this.status = 'expired';
    if (!this.expiredAt) {
      this.expiredAt = new Date();
    }
    return this.save();
  }
  return Promise.resolve(this);
};

foodListingSchema.statics.runExpiryCheck = async function() {
  try {
    const now = new Date();
    const result = await this.updateMany(
      {
        status: { $in: ['available', 'reserved'] },
        $or: [
          { expiryDate: { $lte: now } },
          { pickupTime: { $lte: now } }
        ]
      },
      {
        status: 'expired',
        expiredAt: now
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Expired ${result.modifiedCount} food listings`);
    }
    
    return result.modifiedCount;
  } catch (error) {
    console.error('Error in static expiry check:', error);
    throw error;
  }
};

foodListingSchema.statics.getExpiringSoon = function(hoursFromNow = 24) {
  const now = new Date();
  const futureTime = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
  
  return this.find({
    status: 'available',
    $or: [
      { 
        expiryDate: { 
          $gte: now, 
          $lte: futureTime 
        } 
      },
      { 
        pickupTime: { 
          $gte: now, 
          $lte: futureTime 
        } 
      }
    ]
  }).populate('postedBy', 'name email');
};

foodListingSchema.methods.incrementViews = function() {
  this.views = (this.views || 0) + 1;
  return this.save();
};

foodListingSchema.set('toJSON', { virtuals: true });
foodListingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FoodListing', foodListingSchema);
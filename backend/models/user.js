const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['individual', 'organization', 'admin'],
    default: 'individual'
  },
  
  profile: {
    bio: {
      type: String,
      maxlength: 500
    },
    avatar: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      trim: true
    },
    profilePicture: { 
      type: String,
      default: null
    },
    address: {
      street: String,
      city: String,
      postcode: String,
      country: { 
        type: String, 
        default: 'UK' 
      }
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], 
        default: [0, 0]
      }
    }
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  preferences: {
    dietaryRestrictions: [{
      type: String,
      enum: ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free', 'dairy-free', 'nut-free']
    }],
    allergens: [{
      type: String,
      trim: true
    }],
    favoriteCategories: [{
      type: String,
      enum: ['meal', 'snack', 'bakery', 'fruit', 'other']
    }],
    maxDistance: {
      type: Number,
      default: 5,
      min: 1,
      max: 50
    },
    notifications: {
      email: { 
        type: Boolean, 
        default: true 
      },
      push: { 
        type: Boolean, 
        default: true 
      },
      newFoodNearby: { 
        type: Boolean, 
        default: true 
      },
      reservationUpdates: { 
        type: Boolean, 
        default: true 
      }
    }
  },

  encryptedData: {
    encrypted: String,
    iv: String,
    authTag: String
  },

  stats: {
    totalShared: { 
      type: Number, 
      default: 0 
    },
    totalReceived: { 
      type: Number, 
      default: 0 
    },
    rating: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    },
    reviewCount: { 
      type: Number, 
      default: 0 
    }
  },

  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },

  lastLogin: {
    type: Date
  },
  profileUpdatedAt: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  },
  deletionReason: {
    type: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'profile.location': '2dsphere' }); 
userSchema.index({ isDeleted: 1, isActive: 1 });


userSchema.virtual('displayName').get(function() {
  return this.name;
});

userSchema.methods.isProfileComplete = function() {
  return !!(
    this.name &&
    this.email &&
    this.profile?.phone &&
    this.profile?.address?.city
  );
};

userSchema.methods.incrementShared = async function() {
  this.stats.totalShared += 1;
  return this.save();
};

userSchema.methods.incrementReceived = async function() {
  this.stats.totalReceived += 1;
  return this.save();
};

userSchema.pre('save', function(next) {
  if (this.isModified('profile') || this.isModified('preferences')) {
    this.profileUpdatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
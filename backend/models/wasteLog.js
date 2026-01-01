const mongoose = require('mongoose');

const wasteLogSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['meal', 'snack', 'bakery', 'fruits', 'beverages', 'other'],
    required: true
  },
  
  date: {
    type: Date,
    required: true,
    index: true
  },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  
  preparedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  soldQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  wastedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  
  wastePercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  revenue: {
    type: Number,
    default: 0
  },
  potentialRevenueLoss: {
    type: Number,
    default: 0
  },
  
  mealPeriod: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'all-day'],
    default: 'all-day'
  },
  
  notes: {
    type: String,
    maxlength: 500
  },
  weather: {
    type: String,
    enum: ['sunny', 'rainy', 'cloudy', 'snowy', 'other']
  },
  specialEvent: {
    type: Boolean,
    default: false
  },
  
  isPredictionAccurate: {
    type: Boolean,
    default: null
  },
  followedRecommendation: {
    type: Boolean,
    default: null
  }
  
}, {
  timestamps: true
});

wasteLogSchema.index({ restaurant: 1, date: -1 });
wasteLogSchema.index({ restaurant: 1, category: 1, date: -1 });
wasteLogSchema.index({ restaurant: 1, itemName: 1, date: -1 });

wasteLogSchema.pre('save', function(next) {
  if (this.preparedQuantity > 0) {
    this.wastePercentage = (this.wastedQuantity / this.preparedQuantity) * 100;
  } else {
    this.wastePercentage = 0;
  }
  
  if (this.date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.dayOfWeek = days[new Date(this.date).getDay()];
  }
  
  next();
});

wasteLogSchema.virtual('wasteEfficiency').get(function() {
  return 100 - this.wastePercentage;
});

module.exports = mongoose.model('WasteLog', wasteLogSchema);
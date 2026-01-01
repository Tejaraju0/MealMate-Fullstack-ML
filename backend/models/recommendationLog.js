const mongoose = require('mongoose');

const recommendationLogSchema = new mongoose.Schema({
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modelType: {
    type: String,
    required: true
  },
  inputData: Object, 
  outputData: Object, 
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RecommendationLog', recommendationLogSchema);

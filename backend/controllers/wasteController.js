const WasteLog = require('../models/wasteLog');
const User = require('../models/user');
const axios = require('axios');
const mongoose = require('mongoose');

const ML_SERVICE_URL = 'http://localhost:5001';

// Create a new waste log entry
exports.createWasteLog = async (req, res) => {
  try {
    const {
      itemName,
      category,
      date,
      preparedQuantity,
      soldQuantity,
      wastedQuantity,
      mealPeriod,
      notes,
      weather,
      specialEvent,
      revenue
    } = req.body;

    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (user.role !== 'organization') {
      return res.status(403).json({ message: 'Only restaurants can log waste data' });
    }
   
    const avgPricePerUnit = revenue && soldQuantity > 0 ? revenue / soldQuantity : 5;
    const potentialRevenueLoss = wastedQuantity * avgPricePerUnit;

    const wasteLog = new WasteLog({
      restaurant: userId,
      itemName,
      category,
      date: date || new Date(),
      preparedQuantity,
      soldQuantity,
      wastedQuantity,
      mealPeriod: mealPeriod || 'all-day',
      notes,
      weather,
      specialEvent: specialEvent || false,
      revenue: revenue || 0,
      potentialRevenueLoss
    });

    await wasteLog.save();
  
    const analytics = await getAnalyticsData(userId, 30);

    res.status(201).json({
      message: 'Waste log created successfully',
      wasteLog,
      analytics
    });
  } catch (error) {
    console.error('Create waste log error:', error);
    res.status(500).json({
      message: 'Error creating waste log',
      error: error.message
    });
  }
};

// Get waste logs with filtering and pagination
exports.getWasteLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      startDate,
      endDate,
      category,
      itemName,
      page = 1,
      limit = 20
    } = req.query;

    const query = { restaurant: userId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (itemName) {
      query.itemName = { $regex: itemName, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      WasteLog.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WasteLog.countDocuments(query)
    ]);

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get waste logs error:', error);
    res.status(500).json({
      message: 'Error fetching waste logs',
      error: error.message
    });
  }
};

//get waste analytics summary
exports.getWasteAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query;

    const analytics = await getAnalyticsData(userId, parseInt(period));
    res.json(analytics);
  } catch (error) {
    console.error('Get waste analytics error:', error);
    res.status(500).json({
      message: 'Error fetching waste analytics',
      error: error.message
    });
  }
};


async function getAnalyticsData(userId, periodDays) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const restaurantId = new mongoose.Types.ObjectId(userId);

  const [summary, categoryBreakdown, dayPattern, topWastedItems] = await Promise.all([
    WasteLog.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalPrepared: { $sum: '$preparedQuantity' },
          totalSold: { $sum: '$soldQuantity' },
          totalWasted: { $sum: '$wastedQuantity' },
          avgWastePercentage: { $avg: '$wastePercentage' },
          totalRevenueLoss: { $sum: '$potentialRevenueLoss' },
          totalRevenue: { $sum: '$revenue' },
          logCount: { $sum: 1 }
        }
      }
    ]),

    
    WasteLog.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$category',
          totalWasted: { $sum: '$wastedQuantity' },
          totalPrepared: { $sum: '$preparedQuantity' },
          avgWastePercentage: { $avg: '$wastePercentage' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalWasted: -1 } }
    ]),

    
    WasteLog.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          avgWastePercentage: { $avg: '$wastePercentage' },
          totalWasted: { $sum: '$wastedQuantity' },
          totalPrepared: { $sum: '$preparedQuantity' }
        }
      }
    ]),

    
    WasteLog.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$itemName',
          totalWasted: { $sum: '$wastedQuantity' },
          totalPrepared: { $sum: '$preparedQuantity' },
          avgWastePercentage: { $avg: '$wastePercentage' },
          occurrences: { $sum: 1 },
          potentialRevenueLoss: { $sum: '$potentialRevenueLoss' }
        }
      },
      { $sort: { totalWasted: -1 } },
      { $limit: 10 }
    ])
  ]);

  const summaryData = summary[0] || {
    totalPrepared: 0,
    totalSold: 0,
    totalWasted: 0,
    avgWastePercentage: 0,
    totalRevenueLoss: 0,
    totalRevenue: 0,
    logCount: 0
  };

  return {
    period: periodDays,
    summary: summaryData,
    categoryBreakdown,
    dayPattern,
    topWastedItems
  };
}

// Get waste prediction from ML service
exports.getWastePrediction = async (req, res) => {
  try {
    const {
      itemName,
      category,
      dayOfWeek,
      mealPeriod,
      weather,
      specialEvent,
      preparedQuantity,
      date
    } = req.body;

    if (!itemName || !category || !preparedQuantity) {
      return res.status(400).json({
        message: 'Missing required fields: itemName, category, preparedQuantity'
      });
    }

    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      itemName,
      category,
      dayOfWeek: dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      mealPeriod: mealPeriod || 'all-day',
      weather: weather || 'cloudy',
      specialEvent: specialEvent || false,
      preparedQuantity,
      date: date || new Date().toISOString().split('T')[0]
    });

    return res.status(200).json(response.data);

  } catch (error) {
    console.error('ML Service Error:', error.message);

    return res.status(200).json({
      success: true,
      wastePercentage: 15.0,
      confidence: 'low',
      predictionType: 'fallback',
      suggestedQuantity: Math.round(req.body.preparedQuantity * 0.85),
      message: 'Using fallback prediction (ML service unavailable)'
    });
  }
};

async function getRestaurantCalibrationFactor(userId, itemName) {
  try {
    
    
    const logs = await WasteLog.find({
      restaurant: userId,
      itemName: itemName
    })
    .sort({ date: -1 })  
    .limit(20);          
    if (logs.length < 10) {
      return 1.0;  
    }
  
    const actualWaste = logs.reduce((sum, log) => 
      sum + (log.wastedQuantity / log.preparedQuantity) * 100, 0
    ) / logs.length;
    
    const mlBaseline = 24;    
    const calibrationFactor = actualWaste / mlBaseline;

    
    console.log(`Calibration for ${itemName}: ML baseline=${mlBaseline}%, Restaurant actual=${actualWaste.toFixed(1)}%, Factor=${calibrationFactor.toFixed(2)}`);

    return Math.max(0.3, Math.min(2.0, calibrationFactor));

  } catch (error) {
    console.error('Calibration calculation error:', error);
    return 1.0;  
  }
}

// Get smart suggestions for waste reduction
exports.getSmartSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemName, date } = req.query;

    
    if (!itemName) {
      return res.status(400).json({ message: 'itemName is required' });
    }    
    const historicalData = await WasteLog.find({
      restaurant: userId,
      itemName
    })
    .sort({ date: -1 })
    .limit(30);
    
    if (historicalData.length === 0) {
      return res.status(200).json({
        hasData: false,
        message: 'No historical data yet. Start tracking this item!'
      });
    }
    
    const avgWaste = historicalData.reduce((sum, log) =>
      sum + (log.wastedQuantity / log.preparedQuantity) * 100, 0
    ) / historicalData.length;
    
    const avgPrepared = historicalData.reduce((sum, log) => 
      sum + log.preparedQuantity, 0
    ) / historicalData.length;

    const avgSold = historicalData.reduce((sum, log) => 
      sum + log.soldQuantity, 0
    ) / historicalData.length;

    const maxSold = Math.max(...historicalData.map(l => l.soldQuantity));

    const last7 = historicalData.slice(0, 7);
    const recentWasteRate = last7.reduce((sum, log) =>
      sum + (log.wastedQuantity / log.preparedQuantity) * 100, 0
    ) / last7.length;
 
    let dayOfWeekAdjustment = 1.0;  
    
    if (date) {
      
      const targetDay = new Date(date).getDay();
    
      const sameDayLogs = historicalData.filter(log => 
        new Date(log.date).getDay() === targetDay
      );
    
      if (sameDayLogs.length >= 2) {
        
        const dayAvgSold = sameDayLogs.reduce((s, log) => 
          s + log.soldQuantity, 0
        ) / sameDayLogs.length;
        
        dayOfWeekAdjustment = dayAvgSold / avgSold;
      }
    }

    const adjustedAvgSold = avgSold * dayOfWeekAdjustment;    
    const calibrationFactor = await getRestaurantCalibrationFactor(userId, itemName);
    let recommendedQty = Math.round(adjustedAvgSold * 1.1);  
    let mlConfidence = 'data-driven';
    let predictedWaste = Math.round(avgWaste * 10) / 10;  

    try {
      
      const scenarios = [
        Math.round(adjustedAvgSold),           
        Math.round(adjustedAvgSold * 1.05),    
        Math.round(adjustedAvgSold * 1.10),    
        maxSold                                 
      ];

      const mlPredictions = await Promise.all(
        scenarios.map(qty =>
          axios.post(`${ML_SERVICE_URL}/predict`, {
            itemName,
            category: historicalData[0].category,
            dayOfWeek: date
              ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
              : new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            mealPeriod: historicalData[0].mealPeriod || 'all-day',
            weather: 'cloudy',
            specialEvent: false,
            preparedQuantity: qty,
            date: date || new Date().toISOString().split('T')[0]
          }, { timeout: 5000 }).catch(() => null)  
        )
      );   
      const validPreds = mlPredictions.filter(p => p?.data);

      if (validPreds.length > 0) {
        
        validPreds.forEach(pred => {
          if (pred?.data?.wastePercentage) {
            
            const original = pred.data.wastePercentage;
            
            pred.data.wastePercentage = original * calibrationFactor;
            
            console.log(`  Calibrated ML prediction: ${original.toFixed(1)}% -> ${pred.data.wastePercentage.toFixed(1)}%`);
          }
        });

        const optimal = validPreds.reduce((best, pred) => {
          
          const wasteUnits = pred.data.preparedQuantity * (pred.data.wastePercentage / 100);

          const demandCoverage = pred.data.preparedQuantity / maxSold;
        
          if (demandCoverage >= 0.9 && pred.data.wastePercentage < 15) {
            
            return wasteUnits < best.wasteUnits
              ? { ...pred.data, wasteUnits }
              : best;
          }
          
          return best;  
          
        }, { 
          
          wasteUnits: Infinity, 
          preparedQuantity: scenarios[2],  
          wastePercentage: Math.round(avgWaste * 10) / 10  
        });

        recommendedQty = optimal.preparedQuantity || Math.round(adjustedAvgSold * 1.1);
        mlConfidence = optimal.confidence || 'medium';
        predictedWaste = optimal.wastePercentage || Math.round(avgWaste * 10) / 10;
        
      } else {
        recommendedQty = Math.max(maxSold, Math.round(adjustedAvgSold * 1.1));
      }

    } catch (mlErr) {
      
      console.warn('ML optimization failed, using historical method:', mlErr.message);
      recommendedQty = Math.max(maxSold, Math.round(adjustedAvgSold * 1.1));
    }
    return res.status(200).json({
      hasData: true,
      itemName,
      recommended: recommendedQty,
      reasoning: date
        ? `ML-optimized for ${new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}. Typical demand: ${adjustedAvgSold.toFixed(0)} units. Predicted waste: ${predictedWaste.toFixed(1)}%.`
        : `ML-optimized based on ${historicalData.length} days. Average demand: ${adjustedAvgSold.toFixed(0)} units. Predicted waste: ${predictedWaste.toFixed(1)}%.`,
      
      confidence: mlConfidence,
           
      metrics: {
        historicalAvgSold: Math.round(avgSold),
        peakDemand: maxSold,
        recentWasteRate: Math.round(recentWasteRate * 10) / 10,
        mlPredictedWaste: predictedWaste.toFixed(1),
        calibrationApplied: calibrationFactor !== 1.0  
      }
    });

  } catch (error) {
    console.error('Smart Suggestions Error:', error.message);
    return res.status(500).json({ message: 'Error generating suggestions' });
  }
};

// Delete a waste log entry
exports.deleteWasteLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const log = await WasteLog.findById(id);

    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    if (log.restaurant.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this log' });
    }

    await WasteLog.findByIdAndDelete(id);

    res.status(200).json({ message: 'Log deleted successfully' });
  } catch (error) {
    console.error('Delete waste log error:', error);
    res.status(500).json({
      message: 'Error deleting waste log',
      error: error.message
    });
  }
};

module.exports = exports;

const cron = require('node-cron');
const FoodListing = require('../models/foodListing');

const scheduleExpiryCheck = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const expiredCount = await FoodListing.runExpiryCheck();
      if (expiredCount > 0) {
        console.log(`[${new Date().toISOString()}] Automatically expired ${expiredCount} food listings`);
      }
    } catch (error) {
      console.error('[Expiry Service] Error in scheduled expiry check:', error);
    }
  });

  cron.schedule('0 * * * *', async () => {
    try {
      const expiredCount = await FoodListing.runExpiryCheck();
      console.log(`[${new Date().toISOString()}] Hourly expiry check: ${expiredCount} items expired`);
    } catch (error) {
      console.error('[Expiry Service] Error in hourly expiry check:', error);
    }
  });

  setTimeout(async () => {
    try {
      const expiredCount = await FoodListing.runExpiryCheck();
      console.log(`[${new Date().toISOString()}] Startup expiry check: ${expiredCount} items expired`);
    } catch (error) {
      console.error('[Expiry Service] Error in startup expiry check:', error);
    }
  }, 5000); 

  console.log('[Expiry Service] Scheduled expiry checks initialized (every 5 minutes + hourly backup)');
};

const runManualExpiryCheck = async () => {
  try {
    const expiredCount = await FoodListing.runExpiryCheck();
    console.log(`[${new Date().toISOString()}] Manual expiry check: ${expiredCount} items expired`);
    return expiredCount;
  } catch (error) {
    console.error('[Expiry Service] Error in manual expiry check:', error);
    throw error;
  }
};

const getExpiringSoon = async (hoursFromNow = 2) => {
  try {
    const expiringSoon = await FoodListing.getExpiringSoon(hoursFromNow);
    return expiringSoon;
  } catch (error) {
    console.error('[Expiry Service] Error getting expiring items:', error);
    throw error;
  }
};

const checkListingExpiry = async (listingId) => {
  try {
    const listing = await FoodListing.findById(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }
    
    await listing.checkAndUpdateExpiry();
    return listing;
  } catch (error) {
    console.error('[Expiry Service] Error checking specific listing:', error);
    throw error;
  }
};

module.exports = { 
  scheduleExpiryCheck,
  runManualExpiryCheck,
  getExpiringSoon,
  checkListingExpiry
};
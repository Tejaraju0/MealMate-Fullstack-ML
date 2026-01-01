const FoodListing = require('../models/foodListing');
const User = require('../models/user');
const cloudinary = require('cloudinary').v2;
const socketService = require('../services/socketService');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to check and update expired items
const checkAndUpdateExpiredItems = async () => {
  try {
    const now = new Date();
    const expiredItems = await FoodListing.updateMany(
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
    return expiredItems.modifiedCount;
  } catch (error) {
    console.error('Error in auto-expiry check:', error);
    return 0;
  }
};


const parseLocation = (locationInput) => {
  let parsedLocation;
  if (typeof locationInput === 'string') {
    try {
      parsedLocation = JSON.parse(locationInput);
    } catch (error) {
      return { error: 'Invalid location format' };
    }
  } else {
    parsedLocation = locationInput;
  }

  // Default to London coordinates
  let coordinates = [-0.1278, 51.5074];
  let address = '';

  if (parsedLocation.coordinates && Array.isArray(parsedLocation.coordinates) && parsedLocation.coordinates.length === 2) {
    const lng = parseFloat(parsedLocation.coordinates[0]);
    const lat = parseFloat(parsedLocation.coordinates[1]);
    

    if (!isNaN(lng) && !isNaN(lat) && 
        lng >= -180 && lng <= 180 && 
        lat >= -90 && lat <= 90 &&
        !(lng === 0 && lat === 0)) { 
      coordinates = [lng, lat];
      address = parsedLocation.address || '';
      console.log('Using provided coordinates:', coordinates);
    } else {
      console.log('Invalid coordinates provided, using defaults:', [lng, lat]);
    }
  } else if (parsedLocation.address) {
    address = parsedLocation.address;

    if (parsedLocation.address.includes('Current Location') && parsedLocation.address.includes('(')) {
      try {
        const coordMatch = parsedLocation.address.match(/\(([^,]+),\s*([^)]+)\)/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          
          if (!isNaN(lng) && !isNaN(lat) && 
              lng >= -180 && lng <= 180 && 
              lat >= -90 && lat <= 90 &&
              !(lng === 0 && lat === 0)) {
            coordinates = [lng, lat];
            console.log('Extracted coordinates from address:', coordinates);
          }
        }
      } catch (error) {
        console.log('Could not extract coordinates from address string');
      }
    }
  }

  return {
    coordinates,
    address,
    type: 'Point'
  };
};

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (file) => {
  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'mealmate/food-images',
          transformation: [
            { width: 800, height: 600, crop: 'fill' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      ).end(file.buffer);
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (imageUrl && imageUrl.includes('cloudinary')) {
      const urlParts = imageUrl.split('/');
      const fileWithExt = urlParts[urlParts.length - 1];
      const fileName = fileWithExt.split('.')[0];
      const publicId = `mealmate/food-images/${fileName}`;
      await cloudinary.uploader.destroy(publicId);
      console.log('Image deleted from Cloudinary:', publicId);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// Handle multiple image uploads (up to 5 images)
exports.createFoodListing = async (req, res) => {
  try {
    console.log('Creating food listing...');
    console.log('Request body:', req.body);
    console.log('Files:', req.files ? req.files.length : 0);

    const {
      title,
      description,
      quantity,
      category,
      ingredients,
      pickupLocation,
      coordinates,
      isFree,
      price,
      originalPrice,
      expiryDate,
      pickupTime
    } = req.body;

    if (!title || !quantity || !pickupLocation) {
      return res.status(400).json({ 
        message: 'Title, quantity, and pickup location are required' 
      });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      console.log(`📸 Uploading ${req.files.length} images...`);
      const filesToUpload = req.files.slice(0, 5);
      
      for (const file of filesToUpload) {
        try {
          const imageUrl = await uploadToCloudinary(file);
          imageUrls.push(imageUrl);
          console.log('Image uploaded:', imageUrl);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
        }
      }
    }

    else if (req.file) {
      try {
        const imageUrl = await uploadToCloudinary(req.file);
        imageUrls.push(imageUrl);
      } catch (error) {
        return res.status(500).json({ 
          message: 'Failed to upload image', 
          error: error.message 
        });
      }
    }

    console.log(`Total images uploaded: ${imageUrls.length}`);


    const locationInput = {
      address: pickupLocation,
      coordinates: coordinates ? (typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates) : null
    };
    
    const locationData = parseLocation(JSON.stringify(locationInput));
    
    if (locationData.error) {
      return res.status(400).json({ message: locationData.error });
    }

    let parsedIngredients = [];
    if (ingredients) {
      if (typeof ingredients === 'string') {
        try {
          parsedIngredients = JSON.parse(ingredients);
        } catch (error) {
          parsedIngredients = ingredients.split(',').map(item => item.trim());
        }
      } else {
        parsedIngredients = ingredients;
      }
    }

    const user = await User.findById(req.user.id);
    const isRestaurant = user.role === 'organization';
    const isFreeBoolean = isFree === 'true' || isFree === true;
    const isHotDeal = isRestaurant && !isFreeBoolean && parseFloat(price) > 0;
    
    console.log('Post type:', { isRestaurant, isFree: isFreeBoolean, isHotDeal });


    let hotDealScore = 0;
    if (isHotDeal && originalPrice && parseFloat(price) < parseFloat(originalPrice)) {
      const discount = ((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100;
      hotDealScore = Math.round(discount * 10) / 10;
      console.log(`Hot deal score: ${hotDealScore}% off`);
    }

    // Create food listing with all fields
    const foodListing = new FoodListing({
      title,
      description,
      quantity: parseInt(quantity),
      category,
      ingredients: parsedIngredients,
      images: imageUrls,
      imageUrl: imageUrls[0] || '',
      postedBy: req.user.id,
      location: {
        type: locationData.type,
        coordinates: locationData.coordinates,
        address: locationData.address
      },
      isFree: isFreeBoolean,
      price: !isFreeBoolean ? parseFloat(price || 0) : 0,
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      pickupTime: pickupTime || '',
      isHotDeal: isHotDeal || false,
      hotDealScore: hotDealScore || 0,
      status: 'available'
    });

    console.log('Creating food listing with location:', {
      type: foodListing.location.type,
      coordinates: foodListing.location.coordinates,
      address: foodListing.location.address
    });

    await foodListing.save();

    const populatedListing = await FoodListing.findById(foodListing._id)
      .populate('postedBy', 'name email');


    if (socketService && socketService.notifyNewFood) {
      socketService.notifyNewFood(populatedListing);
    }

    res.status(201).json({
      message: 'Food listing created successfully',
      foodListing: populatedListing
    });

  } catch (error) {
    console.error('Create food listing error:', error);
    res.status(500).json({ 
      message: 'Error creating food listing', 
      error: error.message 
    });
  }
};

// Get all food listings
exports.getFoodListings = async (req, res) => {
  try {
    await checkAndUpdateExpiredItems();

    const {
      page = 1,
      limit = 6,
      category,
      isFree,
      status = 'available',
      search,
      latitude,
      longitude,
      maxDistance = 10000,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { status: 'available' };

    filter.isHotDeal = { $ne: true };

    if (category && category !== 'all') {
      filter.category = new RegExp(category, 'i');
    }

    if (isFree !== undefined) {
      filter.isFree = isFree === 'true';
    }

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { ingredients: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    let pipeline = [];

    if (latitude && longitude) {
      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          distanceField: 'distance',
          maxDistance: parseInt(maxDistance),
          spherical: true,
          query: filter
        }
      });
    } else {
      pipeline.push({ $match: filter });
    }

    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'postedBy',
        foreignField: '_id',
        as: 'postedBy',
        pipeline: [{ $project: { name: 1, email: 1 } }]
      }
    });

    pipeline.push({ $unwind: '$postedBy' });

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortOptions });

    const totalCountPipeline = [...pipeline];
    totalCountPipeline.push({ $count: 'total' });
    const countResult = await FoodListing.aggregate(totalCountPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const foodListings = await FoodListing.aggregate(pipeline);

    const totalPages = Math.ceil(total / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    res.status(200).json({
      foodListings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasMore
      }
    });

  } catch (error) {
    console.error('Get food listings error:', error);
    res.status(500).json({ 
      message: 'Error fetching food listings', 
      error: error.message 
    });
  }
};

//nearby food listings endpoint
exports.getNearbyFoodListings = async (req, res) => {
  try {
    await checkAndUpdateExpiredItems();

    const {
      latitude,
      longitude,
      maxDistance = 5000,
      category,
      isFree,
      sortBy = 'distance',
      limit = 50,
      excludeOwn = 'true'
    } = req.query;

    console.log('Nearby food request:', { latitude, longitude, maxDistance, category, isFree });

    const filter = { status: 'available' };

    if (category && category !== 'all') {
      filter.category = new RegExp(category, 'i');
    }

    if (isFree && isFree !== 'all') {
      filter.isFree = isFree === 'true';
    }

    if (excludeOwn === 'true' && req.user) {
      filter.postedBy = { $ne: req.user.id };
    }

    let pipeline = [];

    if (latitude && longitude) {

      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          distanceField: 'distance',
          maxDistance: parseInt(maxDistance),
          spherical: true,
          query: filter
        }
      });
    } else {

      pipeline.push({ $match: filter });
    }

    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'postedBy',
        foreignField: '_id',
        as: 'postedBy',
        pipeline: [{ $project: { name: 1, email: 1 } }]
      }
    });

    pipeline.push({ $unwind: '$postedBy' });

    // Sort
    const sortOptions = {};
    switch (sortBy) {
      case 'distance':
        sortOptions.distance = 1;
        break;
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      default:
        if (latitude && longitude) {
          sortOptions.distance = 1;
        } else {
          sortOptions.createdAt = -1;
        }
    }

    pipeline.push({ $sort: sortOptions });
    pipeline.push({ $limit: parseInt(limit) });

    const foodListings = await FoodListing.aggregate(pipeline);

    console.log(`Found ${foodListings.length} nearby food items`);

    res.status(200).json({ 
      foodListings,
      stats: {
        total: foodListings.length,
        available: foodListings.filter(item => item.status === 'available').length,
        averageDistance: latitude && longitude && foodListings.length > 0 ? 
          foodListings.reduce((sum, item) => sum + (item.distance || 0), 0) / foodListings.length : 0
      }
    });

  } catch (error) {
    console.error('Get nearby food listings error:', error);
    res.status(500).json({ 
      message: 'Error fetching nearby food listings', 
      error: error.message 
    });
  }
};

// hot deals with location-based priority 
exports.getHotDeals = async (req, res) => {
  try {
    await checkAndUpdateExpiredItems();

    const { 
      limit = 6, 
      latitude, 
      longitude, 
      maxDistance = 10000 
    } = req.query;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let pipeline = [];

    if (latitude && longitude) {
      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          distanceField: 'distance',
          maxDistance: parseInt(maxDistance),
          spherical: true
        }
      });
    }

    // Hot deals criteria
    pipeline = pipeline.concat([
      {
        $match: {
          status: 'available',
          isHotDeal: true, 
          $or: [
            {
              expiryDate: {
                $gte: now,
                $lte: tomorrow
              }
            },
            {
              isFree: false,
              price: { $gt: 0, $lt: 50 }
            },
            {
              createdAt: {
                $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) // Last 4 hours
              }
            }
          ]
        }
      },

      // Join with user data
      {
        $lookup: {
          from: 'users',
          localField: 'postedBy',
          foreignField: '_id',
          as: 'postedBy',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: '$postedBy' },
      {
        $addFields: {
          hotDealScore: {
            $add: [

              {
                $cond: {
                  if: { $ne: ['$expiryDate', null] },
                  then: {
                    $cond: {
                      if: { $lte: ['$expiryDate', new Date(now.getTime() + 4 * 60 * 60 * 1000)] },
                      then: 4,
                      else: {
                        $cond: {
                          if: { $lte: ['$expiryDate', new Date(now.getTime() + 12 * 60 * 60 * 1000)] },
                          then: 3,
                          else: 2
                        }
                      }
                    }
                  },
                  else: 1
                }
              },
              // Price score
              {
                $cond: {
                  if: { $eq: ['$isFree', true] },
                  then: 3,
                  else: {
                    $cond: {
                      if: { $lte: ['$price', 5] },
                      then: 2,
                      else: 1
                    }
                  }
                }
              },
              // Newness score
              {
                $cond: {
                  if: { $gte: ['$createdAt', new Date(now.getTime() - 60 * 60 * 1000)] },
                  then: 2,
                  else: 1
                }
              }
            ]
          },
          isHotDeal: true
        }
      },
      { 
        $sort: latitude && longitude ? 
          { hotDealScore: -1, distance: 1 } : 
          { hotDealScore: -1, createdAt: -1 }
      },
      { $limit: parseInt(limit) }
    ]);

    const hotDeals = await FoodListing.aggregate(pipeline);

    res.status(200).json({ 
      hotDeals,
      dealStats: {
        total: hotDeals.length,
        freeDeals: hotDeals.filter(deal => deal.isFree).length,
        averageScore: hotDeals.length > 0 ? 
          hotDeals.reduce((sum, deal) => sum + deal.hotDealScore, 0) / hotDeals.length : 0
      }
    });

  } catch (error) {
    console.error('Get hot deals error:', error);
    res.status(500).json({ 
      message: 'Error fetching hot deals', 
      error: error.message 
    });
  }
};

// Get single food listing by ID
exports.getFoodListingById = async (req, res) => {
  try {
    const { id } = req.params;

    const foodListing = await FoodListing.findById(id)
      .populate('postedBy', 'name email phone');

    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    await FoodListing.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.status(200).json({ foodListing });

  } catch (error) {
    console.error('Get food listing by ID error:', error);
    res.status(500).json({ 
      message: 'Error fetching food listing', 
      error: error.message 
    });
  }
};

// Get user's own food listings
exports.getUserFoodListings = async (req, res) => {
  try {
    await checkAndUpdateExpiredItems();

    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { postedBy: req.user.id };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const foodListings = await FoodListing.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('postedBy', 'name email');

    const total = await FoodListing.countDocuments(filter);

    res.status(200).json({
      foodListings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user food listings error:', error);
    res.status(500).json({ 
      message: 'Error fetching user food listings', 
      error: error.message 
    });
  }
};

// Update food listing
exports.updateFoodListing = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const foodListing = await FoodListing.findById(id);
    
    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    if (foodListing.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this listing' });
    }

    if (req.file) {
      try {
        if (foodListing.imageUrl) {
          await deleteFromCloudinary(foodListing.imageUrl);
        }
        updates.imageUrl = await uploadToCloudinary(req.file);
      } catch (error) {
        return res.status(500).json({ 
          message: 'Failed to update image', 
          error: error.message 
        });
      }
    }

    if (updates.isFree === true || updates.isFree === 'true') {
      updates.price = 0;
    }

    if (updates.location) {
      const locationData = parseLocation(updates.location);
      if (locationData.error) {
        return res.status(400).json({ message: locationData.error });
      }
      updates.location = {
        type: locationData.type,
        coordinates: locationData.coordinates,
        address: locationData.address
      };
    }

    if (updates.ingredients && typeof updates.ingredients === 'string') {
      try {
        updates.ingredients = JSON.parse(updates.ingredients);
      } catch (error) {
        updates.ingredients = updates.ingredients.split(',').map(item => item.trim());
      }
    }

    const updatedListing = await FoodListing.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('postedBy', 'name email');

    if (socketService && socketService.notifyFoodUpdate) {
      socketService.notifyFoodUpdate(updatedListing);
    }

    res.status(200).json({
      message: 'Food listing updated successfully',
      foodListing: updatedListing
    });

  } catch (error) {
    console.error('Update food listing error:', error);
    res.status(500).json({ 
      message: 'Error updating food listing', 
      error: error.message 
    });
  }
};

// Delete food listing
exports.deleteFoodListing = async (req, res) => {
  try {
    const { id } = req.params;

    const foodListing = await FoodListing.findById(id);
    
    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    if (foodListing.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this listing' });
    }

    if (foodListing.imageUrl) {
      await deleteFromCloudinary(foodListing.imageUrl);
    }

    await FoodListing.findByIdAndDelete(id);

    // Real-time notification
    if (socketService && socketService.notifyFoodDeletion) {
      socketService.notifyFoodDeletion(id, foodListing.location);
    }

    res.status(200).json({ message: 'Food listing deleted successfully' });

  } catch (error) {
    console.error('Delete food listing error:', error);
    res.status(500).json({ 
      message: 'Error deleting food listing', 
      error: error.message 
    });
  }
};

// Update listing status
exports.updateListingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['available', 'reserved', 'collected', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const foodListing = await FoodListing.findById(id);
    
    if (!foodListing) {
      return res.status(404).json({ message: 'Food listing not found' });
    }

    foodListing.status = status;
    await foodListing.save();

    const updatedListing = await FoodListing.findById(id)
      .populate('postedBy', 'name email');

    if (socketService && socketService.notifyFoodUpdate) {
      socketService.notifyFoodUpdate(updatedListing);
    }

    res.status(200).json({
      message: `Listing status updated to ${status}`,
      foodListing: updatedListing
    });

  } catch (error) {
    console.error('Update listing status error:', error);
    res.status(500).json({ 
      message: 'Error updating listing status', 
      error: error.message 
    });
  }
};

exports.getMapClusters = async (req, res) => {
  try {
    const {
      northLat,
      southLat,
      eastLng,
      westLng,
      zoom = 10
    } = req.query;

    if (!northLat || !southLat || !eastLng || !westLng) {
      return res.status(400).json({
        message: 'Bounding box coordinates are required'
      });
    }

    let aggregationLevel = 'individual'; 
    if (zoom < 12) aggregationLevel = 'city';
    else if (zoom < 15) aggregationLevel = 'area';

    const pipeline = [
      {
        $match: {
          status: 'available',
          location: {
            $geoWithin: {
              $box: [
                [parseFloat(westLng), parseFloat(southLat)],
                [parseFloat(eastLng), parseFloat(northLat)]
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'postedBy',
          foreignField: '_id',
          as: 'postedBy',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: '$postedBy' },
      {
        $addFields: {
          isHotDeal: {
            $or: [
              {
                $and: [
                  { $ne: ['$expiryDate', null] },
                  { $lte: ['$expiryDate', new Date(Date.now() + 24 * 60 * 60 * 1000)] },
                  { $gte: ['$expiryDate', new Date()] }
                ]
              },
              {
                $and: [
                  { $eq: ['$isFree', false] },
                  { $lt: ['$price', 10] }
                ]
              },
              {
                $gte: ['$createdAt', new Date(Date.now() - 2 * 60 * 60 * 1000)]
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          category: 1,
          quantity: 1,
          isFree: 1,
          price: 1,
          imageUrl: 1,
          status: 1,
          expiryDate: 1,
          location: 1,
          postedBy: 1,
          createdAt: 1,
          isHotDeal: 1
        }
      }
    ];

    const foodItems = await FoodListing.aggregate(pipeline);

    res.status(200).json({
      items: foodItems,
      bounds: {
        north: parseFloat(northLat),
        south: parseFloat(southLat),
        east: parseFloat(eastLng),
        west: parseFloat(westLng)
      },
      zoom: parseInt(zoom),
      aggregationLevel,
      stats: {
        total: foodItems.length,
        processed: foodItems.length,
        hotDeals: foodItems.filter(item => item.isHotDeal).length
      }
    });

  } catch (error) {
    console.error('Get map clusters error:', error);
    res.status(500).json({
      message: 'Error fetching map data',
      error: error.message
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Promise.all([
      FoodListing.countDocuments({ postedBy: userId, status: { $in: ['collected', 'reserved'] } }),
      Promise.resolve(0),
      FoodListing.countDocuments({ postedBy: userId, status: 'available' }),
      FoodListing.countDocuments({ postedBy: userId })
    ]);

    const co2Saved = Math.round(stats[0] * 0.5);
    const pointsEarned = stats[0] * 10 + stats[1] * 5;

    res.status(200).json({
      mealsShared: stats[0],
      foodReceived: stats[1],
      activeListing: stats[2],
      totalListings: stats[3],
      co2Saved,
      pointsEarned
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching dashboard statistics', 
      error: error.message 
    });
  }
};

// Helper functions
const getCategoryStats = (listings) => {
  const stats = {};
  listings.forEach(item => {
    stats[item.category] = (stats[item.category] || 0) + 1;
  });
  return stats;
};

const performServerSideClustering = (items, level) => {
  // Simple grid-based clustering
  const gridSize = level === 'city' ? 0.1 : 0.01;
  const clusters = new Map();

  items.forEach(item => {
    if (!item.location?.coordinates) return;

    const [lng, lat] = item.location.coordinates;
    const gridLat = Math.floor(lat / gridSize) * gridSize;
    const gridLng = Math.floor(lng / gridSize) * gridSize;
    const key = `${gridLat}_${gridLng}`;

    if (!clusters.has(key)) {
      clusters.set(key, {
        _id: `cluster_${key}`,
        type: 'cluster',
        location: {
          type: 'Point',
          coordinates: [gridLng + gridSize/2, gridLat + gridSize/2]
        },
        items: [],
        count: 0,
        categories: {},
        hotDeals: 0
      });
    }

    const cluster = clusters.get(key);
    cluster.items.push(item);
    cluster.count++;
    cluster.categories[item.category] = (cluster.categories[item.category] || 0) + 1;
    if (item.isHotDeal) cluster.hotDeals++;
  });

  return Array.from(clusters.values());
};
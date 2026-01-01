const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// SPECIFIC ROUTES FIRST
router.get('/stats', authMiddleware, foodController.getDashboardStats);
router.get('/hot-deals', foodController.getHotDeals);
router.get('/my-listings', authMiddleware, foodController.getUserFoodListings);
router.get('/nearby', foodController.getNearbyFoodListings);
router.get('/map-clusters', foodController.getMapClusters);
router.get('/dashboard-stats', authMiddleware, foodController.getDashboardStats);

// GENERAL ROUTES
router.post('/', authMiddleware, upload.array('images', 5), foodController.createFoodListing);
router.get('/', foodController.getFoodListings);

// DYNAMIC ROUTE LAST
router.get('/:id', foodController.getFoodListingById);
router.put('/:id', authMiddleware, upload.array('images', 5), foodController.updateFoodListing);
router.patch('/:id/status', authMiddleware, foodController.updateListingStatus);
router.delete('/:id', authMiddleware, foodController.deleteFoodListing);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum size is 5MB.' 
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ 
      message: 'Only image files are allowed. Please upload a valid image.' 
    });
  }
  
  next(error);
});

module.exports = router;
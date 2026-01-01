const express = require('express');
const router = express.Router();
const authController = require('../controllers/authControllers');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for profile pictures!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

router.post('/register', authController.register);
router.post('/login', authController.login);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

router.put('/change-password', authMiddleware, authController.changePassword);

router.get('/profile', authMiddleware, authController.getProfile);

router.put('/profile', 
  authMiddleware, 
  upload.single('profilePicture'), 
  authController.updateProfile
);

router.put('/payment-info', authMiddleware, authController.updatePaymentInfo);
router.delete('/account', authMiddleware, authController.deleteAccount);
router.get('/stats', authMiddleware, authController.getUserStats);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'Profile picture is too large. Maximum size is 5MB.' 
      });
    }
  }
  
  if (error.message === 'Only image files are allowed for profile pictures!') {
    return res.status(400).json({ 
      message: 'Only image files are allowed for profile pictures.' 
    });
  }
  
  next(error);
});

module.exports = router;
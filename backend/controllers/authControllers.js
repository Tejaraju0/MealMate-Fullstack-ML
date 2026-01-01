const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); //For encryption
const User = require('../models/user');
const FoodListing = require('../models/foodListing'); 
const { Message } = require('../models/message'); 
const Reservation = require('../models/reservation');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');


//CLOUDINARY CONFIGURATION
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Loads env secret code
const JWT_SECRET = process.env.JWT_SECRET;

// Registers User
exports.register = async (req, res) => {
  try {
    const { name, email, password, role} = req.body;

    // Checks if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Hashes password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creates user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'individual'
    });

    await user.save();

    // Creates token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Finds user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Compares password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Create token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "No account with this email" });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 15; // 15 minutes

    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Email sender

    console.log("SMTP EMAIL:", process.env.SMTP_EMAIL);
console.log("SMTP PASS:", process.env.SMTP_PASS ? "Loaded" : "MISSING");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      to: user.email,
      subject: "MealMate Password Reset",
      html: `
        <h3>Password Reset</h3>
        <p>Click below to reset your password:</p>
        <a href="${resetURL}">${resetURL}</a>
        <p>This link will expires in 15 minutes.</p>
      `
    });

    return res.json({ message: "Reset link sent to your email" });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Error sending reset link" });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { token } = req.params;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();

    await user.save();

    res.json({ message: "Password updated successfully!" });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userProfile = user.toObject();
    
    // Decrypt sensitive data (payment info)
    if (user.encryptedData && user.encryptedData.encrypted) {
      const decryptedData = decryptSensitiveData(user.encryptedData, user._id);
      if (decryptedData) {
        userProfile.paymentInfo = decryptedData;
      }
    }

    // Removes encrypted data from response
    delete userProfile.encryptedData;
    delete userProfile.__v;

    res.status(200).json({
      user: userProfile
    });

  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
};
//Update User Profile with Profile Picture Support
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      profile: profileData,
      preferences: preferencesData
    } = req.body;

    // Parse JSON strings if needed
    let profile = profileData;
    let preferences = preferencesData;
    
    if (typeof profileData === 'string') {
      profile = JSON.parse(profileData);
    }
    
    if (typeof preferencesData === 'string') {
      preferences = JSON.parse(preferencesData);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic info
    if (name) user.name = name;
    if (email) user.email = email;

    // Handle profile picture upload
    if (req.file) {
      try {
        // Delete old profile picture if exists
        if (user.profile?.profilePicture) {
          await deleteProfilePicture(user.profile.profilePicture);
        }

        // Upload new profile picture
        const profilePictureUrl = await uploadProfilePicture(req.file);
        
        // Add to profile data
        if (!profile) profile = {};
        profile.profilePicture = profilePictureUrl;
        
        console.log('Profile picture uploaded successfully');
      } catch (uploadError) {
        console.error('Profile picture upload failed:', uploadError);
        return res.status(500).json({ 
          message: 'Failed to upload profile picture',
          error: uploadError.message 
        });
      }
    }

    // Update profile
    if (profile) {
      user.profile = {
        ...user.profile.toObject(),
        ...profile,
        address: {
          ...user.profile.address,
          ...(profile.address || {})
        },
        location: profile.location || user.profile.location
      };
    }

    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences.toObject(),
        ...preferences,
        notifications: {
          ...(user.preferences.notifications || {}),
          ...(preferences.notifications || {})
        }
      };
    }

    user.profileUpdatedAt = new Date();
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password -encryptedData');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Error updating profile', 
      error: error.message 
    });
  }
};
// Update Payment Information
exports.updatePaymentInfo = async (req, res) => {
  try {
    const { bankDetails, paypalEmail, preferredMethod } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Decrypt existing payment info
    let paymentInfo = {};
    if (user.encryptedData && user.encryptedData.encrypted) {
      const decrypted = decryptSensitiveData(user.encryptedData, user._id);
      if (decrypted) {
        paymentInfo = decrypted;
      }
    }

    // Update payment info
    if (bankDetails) {
      paymentInfo.bankDetails = {
        ...(paymentInfo.bankDetails || {}),
        ...bankDetails,
        verified: false
      };
    }

    if (paypalEmail) {
      paymentInfo.paypalEmail = paypalEmail;
    }

    if (preferredMethod) {
      paymentInfo.preferredMethod = preferredMethod;
    }

    // Encrypt and save
    const encrypted = encryptSensitiveData(paymentInfo, user._id);
    user.encryptedData = encrypted;

    await user.save();

    res.json({
      message: 'Payment information updated successfully',
      paymentInfo: {
        preferredMethod: paymentInfo.preferredMethod,
        hasBank: !!paymentInfo.bankDetails?.accountNumber,
        hasPayPal: !!paymentInfo.paypalEmail,
        verified: paymentInfo.bankDetails?.verified || false
      }
    });
  } catch (error) {
    console.error('Update payment info error:', error);
    res.status(500).json({ 
      message: 'Error updating payment info', 
      error: error.message 
    });
  }
};

// Get User Statistics
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const Reservation = require('../models/reservation');
    const FoodListing = require('../models/foodListing');

    const [
      totalShared,
      totalReceived,
      completedReservations,
      averageRating
    ] = await Promise.all([
      FoodListing.countDocuments({ postedBy: userId }),
      Reservation.countDocuments({ requester: userId, status: 'completed' }),
      Reservation.countDocuments({ provider: userId, status: 'completed' }),
      Reservation.aggregate([
        { $match: { provider: userId, 'rating.score': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating.score' }, count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      totalShared,
      totalReceived,
      completedReservations,
      rating: averageRating[0]?.avgRating || 0,
      reviewCount: averageRating[0]?.count || 0
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching stats', 
      error: error.message 
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.passwordChangedAt = new Date();

    await user.save();

    res.status(200).json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Error changing password', 
      error: error.message 
    });
  }
};

// Delete Account
exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Deletes profile picture from Cloudinary if exists
    if (user.profile?.profilePicture) {
      await deleteProfilePicture(user.profile.profilePicture);
    }

    // Delete user's food listings and their images
    const userListings = await FoodListing.find({ provider: req.user.id });
    for (const listing of userListings) {
      if (listing.images && listing.images.length > 0) {
        // Delete images from Cloudinary
        for (const imageUrl of listing.images) {
          if (imageUrl && imageUrl.includes('cloudinary')) {
            const urlParts = imageUrl.split('/');
            const fileWithExt = urlParts[urlParts.length - 1];
            const fileName = fileWithExt.split('.')[0];
            const publicId = `mealmate/food-images/${fileName}`;
            await cloudinary.uploader.destroy(publicId);
          }
        }
      }
      await listing.deleteOne();
    }

    // Delete user's messages
    await Message.deleteMany({
      $or: [{ sender: req.user.id }, { receiver: req.user.id }]
    });

    // Delete user's reservations
    await Reservation.deleteMany({
      $or: [{ requester: req.user.id }, { provider: req.user.id }]
    });

    // Delete the user account
    await user.deleteOne();

    res.json({
      message: 'Account and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      message: 'Error deleting account', 
      error: error.message 
    });
  }
};

// Encrypt sensitive data
function encryptSensitiveData(data, userId) {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production', 
      'salt', 
      32
    );
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
}

function decryptSensitiveData(encryptedData, userId) {
  try {
    if (!encryptedData || !encryptedData.encrypted) {
      return null;
    }

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'mealmate-default-encryption-key-change-in-production', 
      'salt', 
      32
    );
    
    const decipher = crypto.createDecipheriv(
      algorithm, 
      key, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Helper function to upload profile picture to Cloudinary
const uploadProfilePicture = async (file) => {
  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'mealmate/profile-pictures',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
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
    throw new Error('Failed to upload profile picture');
  }
};

// Helper function to delete profile picture
const deleteProfilePicture = async (imageUrl) => {
  try {
    if (imageUrl && imageUrl.includes('cloudinary')) {
      const urlParts = imageUrl.split('/');
      const fileWithExt = urlParts[urlParts.length - 1];
      const fileName = fileWithExt.split('.')[0];
      const publicId = `mealmate/profile-pictures/${fileName}`;
      
      await cloudinary.uploader.destroy(publicId);
      console.log('Old profile picture deleted from Cloudinary');
    }
  } catch (error) {
    console.error('Failed to delete old profile picture:', error);
  }
};
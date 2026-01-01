import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../css/Dashboard.module.css';
import profileStyles from '../css/UserProfile.module.css';
import axios from '../api/axios';

// Import components
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import RestaurantSidebar from '../components/layout/RestaurantSidebar';

const UserProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [editMode, setEditMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  
  // User data state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    address: {
      street: '',
      city: '',
      postcode: '',
      country: 'UK'
    },
    location: {
      coordinates: [0, 0]
    },
    profilePicture: ''
  });

  const [preferences, setPreferences] = useState({
    dietaryRestrictions: [],
    allergens: [],
    favoriteCategories: [],
    maxDistance: 5,
    notifications: {
      email: true,
      push: true,
      newFoodNearby: true,
      reservationUpdates: true
    }
  });

  const [paymentInfo, setPaymentInfo] = useState({
    bankDetails: {
      accountHolderName: '',
      sortCode: '',
      accountNumber: ''
    },
    paypalEmail: '',
    preferredMethod: 'none'
  });

  const [stats, setStats] = useState({
    totalShared: 0,
    totalReceived: 0,
    rating: 0,
    reviewCount: 0,
    mealsShared: 0,
    foodReceived: 0
  });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const showToast = (type, title, message) => {
    const id = Date.now();
    const toast = { id, type, title, message };
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/auth');
          return;
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        const [profileRes, statsRes] = await Promise.all([
          axios.get('/auth/profile'),
          axios.get('/foodRoutes/stats')
        ]);

        const userData = profileRes.data.user;
        const statsData = statsRes.data;

        setUserRole(userData.role);

        console.log('Fetched user data:', userData); 
        console.log('Profile picture URL:', userData.profile?.profilePicture); 

        setStats({
          totalShared: statsData.mealsShared || 0,
          totalReceived: statsData.foodReceived || 0,
          rating: 0,
          reviewCount: 0,
          mealsShared: statsData.mealsShared || 0,
          foodReceived: statsData.foodReceived || 0
        });

        setProfile({
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.profile?.phone || '',
          bio: userData.profile?.bio || '',
          address: userData.profile?.address || {
            street: '',
            city: '',
            postcode: '',
            country: 'UK'
          },
          location: userData.profile?.location || { coordinates: [0, 0] },
          profilePicture: userData.profile?.profilePicture || ''
        });

        if (userData.profile?.profilePicture) {
          console.log(' Setting profile image preview:', userData.profile.profilePicture); 
          setProfileImagePreview(userData.profile.profilePicture);
        } else {
          console.log(' No profile picture found in user data'); 
          setProfileImagePreview(null);
        }

        if (userData.preferences) {
          setPreferences({
            dietaryRestrictions: userData.preferences.dietaryRestrictions || [],
            allergens: userData.preferences.allergens || [],
            favoriteCategories: userData.preferences.favoriteCategories || [],
            maxDistance: userData.preferences.maxDistance || 5,
            notifications: userData.preferences.notifications || {
              email: true,
              push: true,
              newFoodNearby: true,
              reservationUpdates: true
            }
          });
        }

        if (userData.paymentInfo) {
          setPaymentInfo({
            bankDetails: userData.paymentInfo.bankDetails || {
              accountHolderName: '',
              sortCode: '',
              accountNumber: ''
            },
            paypalEmail: userData.paymentInfo.paypalEmail || '',
            preferredMethod: userData.paymentInfo.preferredMethod || 'none'
          });
        }

      } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('error', 'Error', 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid File', 'Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File Too Large', 'Image must be less than 5MB');
      return;
    }

    setProfileImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfileImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Get current location
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setProfile(prev => ({
            ...prev,
            location: { coordinates: [longitude, latitude] }
          }));
          showToast('success', 'Location Updated', 'Your location has been detected successfully');
        },
        (error) => {
          console.error('Location error:', error);
          showToast('error', 'Location Error', 'Could not detect your location. Please enable location services');
        }
      );
    } else {
      showToast('error', 'Not Supported', 'Geolocation is not supported by your browser');
    }
  };

  // Save profile 
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      
      formData.append('name', profile.name);
      formData.append('email', profile.email);
      formData.append('profile', JSON.stringify({
        phone: profile.phone,
        bio: profile.bio,
        address: profile.address,
        location: profile.location
      }));
      formData.append('preferences', JSON.stringify(preferences));

      // Add profile picture if changed
      if (profileImage) {
        console.log(' Uploading profile picture...', profileImage.name);
        formData.append('profilePicture', profileImage);
      }

      const response = await axios.put('/auth/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log(' Profile update response:', response.data); 

      // Update local state with the returned data
      const updatedUser = response.data.user;
      
      console.log(' New profile picture URL:', updatedUser.profile?.profilePicture); 
      
      setProfile({
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        phone: updatedUser.profile?.phone || '',
        bio: updatedUser.profile?.bio || '',
        address: updatedUser.profile?.address || {
          street: '',
          city: '',
          postcode: '',
          country: 'UK'
        },
        location: updatedUser.profile?.location || { coordinates: [0, 0] },
        profilePicture: updatedUser.profile?.profilePicture || '' 
      });

      if (updatedUser.profile?.profilePicture) {
        console.log(' Setting new profile image preview'); 
        setProfileImagePreview(updatedUser.profile.profilePicture);
      }

      showToast('success', 'Profile Saved!', 'Your profile has been updated successfully');
      setEditMode(false);
      setProfileImage(null); 
    } catch (error) {
      console.error(' Save error:', error);
      console.error('Error details:', error.response?.data); 
      showToast('error', 'Error', error.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      await axios.put('/auth/payment-info', paymentInfo);
      showToast('success', 'Payment Info Saved!', 'Payment information updated successfully');
      setEditMode(false);
    } catch (error) {
      console.error('Payment save error:', error);
      showToast('error', 'Error', 'Failed to save payment information');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete('/auth/account');
      showToast('success', 'Account Deleted', 'Your account has been permanently deleted');
      setTimeout(() => {
        localStorage.removeItem('token');
        navigate('/auth');
      }, 2000);
    } catch (error) {
      console.error('Delete account error:', error);
      showToast('error', 'Error', 'Failed to delete account');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      window.location.reload();
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showToast('error', 'Missing Fields', 'Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('error', 'Password Mismatch', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showToast('error', 'Weak Password', 'Password must be at least 6 characters long');
      return;
    }

    setSaving(true);
    try {
      await axios.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      showToast('success', 'Password Changed!', 'Your password has been updated successfully');
      setShowChangePasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Change password error:', error);
      showToast('error', 'Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      showToast('success', 'Logged Out', 'You have been logged out successfully');
      setTimeout(() => {
        navigate('/auth');
      }, 1500);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <Header 
        toggleSidebar={toggleSidebar}
        isMobile={isMobile}
      />

    <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>

      {!isMobile && !isTablet && (
        <>
          {userRole === "organization" ? (
            <RestaurantSidebar
              isMobile={false}
              isOpen={false}
              onClose={() => setSidebarOpen(false)}
              currentPage="profile"
            />
          ) : (
            <Sidebar
              isMobile={false}
              isOpen={false}
              onClose={() => setSidebarOpen(false)}
              currentPage="profile"
            />
          )}
        </>
      )}

      {isTablet && (
        <>
          {userRole === "organization" ? (
            <RestaurantSidebar
              isMobile={true}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              currentPage="profile"
            />
          ) : (
            <Sidebar
              isMobile={true}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              currentPage="profile"
            />
          )}
        </>
      )}


        <div className={styles.contentArea}>
          {/* Profile Header */}
          <div className={profileStyles.profileHeader}>
            <div className={profileStyles.headerContent}>
              <div className={profileStyles.avatarSection}>
                <div className={profileStyles.avatarWrapper}>
                  {profileImagePreview ? (
                    <img 
                      src={profileImagePreview} 
                      alt="Profile" 
                      className={profileStyles.avatarImage}
                    />
                  ) : (
                    <div className={profileStyles.avatar}>
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {editMode && (
                    <label className={profileStyles.avatarEdit}>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        style={{ display: 'none' }}
                      />
                      📷
                    </label>
                  )}
                </div>
                
                <div className={profileStyles.userInfo}>
                  <h1>{profile.name}</h1>
                  <p>{profile.email}</p>
                </div>

                <button 
                  className={profileStyles.editToggleBtn}
                  onClick={toggleEditMode}
                >
                  {editMode ? '❌ Cancel' : '✏️ Edit'}
                </button>
              </div>

              <div className={profileStyles.statsGrid}>
                <div className={profileStyles.statCard}>
                  <span className={profileStyles.statValue}>
                    {stats?.totalShared || 0}
                  </span>
                  <span className={profileStyles.statLabel}>Shared</span>
                </div>
                <div className={profileStyles.statCard}>
                  <span className={profileStyles.statValue}>
                    {stats?.totalReceived || 0}
                  </span>
                  <span className={profileStyles.statLabel}>Received</span>
                </div>
                <div className={profileStyles.statCard}>
                  <span className={profileStyles.statValue}>
                    {stats?.rating ? stats.rating.toFixed(1) : 'N/A'}
                  </span>
                  <span className={profileStyles.statLabel}>Rating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className={profileStyles.tabNav}>
            <button
              className={`${profileStyles.tabButton} ${activeSection === 'personal' ? profileStyles.active : ''}`}
              onClick={() => setActiveSection('personal')}
            >
              Personal Info
            </button>
            <button
              className={`${profileStyles.tabButton} ${activeSection === 'preferences' ? profileStyles.active : ''}`}
              onClick={() => setActiveSection('preferences')}
            >
              Preferences
            </button>
            
            {userRole === 'individual' && (
              <button
                className={`${profileStyles.tabButton} ${activeSection === 'payment' ? profileStyles.active : ''}`}
                onClick={() => setActiveSection('payment')}
              >
                Payment Info
              </button>
            )}
            
            <button
              className={`${profileStyles.tabButton} ${activeSection === 'security' ? profileStyles.active : ''}`}
              onClick={() => setActiveSection('security')}
            >
              Security
            </button>
          </div>

          {/* Personal Info Section */}
          {activeSection === 'personal' && (
            <div className={profileStyles.section}>
              <h2>Personal Information</h2>
              
              {!editMode ? (
                <div className={profileStyles.viewMode}>
                  <div className={profileStyles.viewField}>
                    <label>Full Name</label>
                    <p>{profile.name || 'Not provided'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Email</label>
                    <p>{profile.email || 'Not provided'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Phone Number</label>
                    <p>{profile.phone || 'Not provided'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Bio</label>
                    <p>{profile.bio || 'No bio added yet'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Address</label>
                    <p>
                      {profile.address.street && profile.address.city 
                        ? `${profile.address.street}, ${profile.address.city}, ${profile.address.postcode}`
                        : 'Not provided'}
                    </p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Location</label>
                    <p>
                      {profile.location.coordinates[0] !== 0 
                        ? `📍 ${profile.location.coordinates[1].toFixed(4)}, ${profile.location.coordinates[0].toFixed(4)}`
                        : 'Location not set'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={profileStyles.formGrid}>
                  <div className={profileStyles.formGroup}>
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Enter your name"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+44 1234 567890"
                    />
                  </div>

                  <div className={`${profileStyles.formGroup} ${profileStyles.fullWidth}`}>
                    <label>Bio</label>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Tell others about yourself..."
                      rows="3"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={profile.address.street}
                      onChange={(e) => setProfile({
                        ...profile,
                        address: { ...profile.address, street: e.target.value }
                      })}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>City</label>
                    <input
                      type="text"
                      value={profile.address.city}
                      onChange={(e) => setProfile({
                        ...profile,
                        address: { ...profile.address, city: e.target.value }
                      })}
                      placeholder="London"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Postcode</label>
                    <input
                      type="text"
                      value={profile.address.postcode}
                      onChange={(e) => setProfile({
                        ...profile,
                        address: { ...profile.address, postcode: e.target.value }
                      })}
                      placeholder="SW1A 1AA"
                    />
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Location</label>
                    <div className={profileStyles.locationInput}>
                      <input
                        type="text"
                        value={profile.location.coordinates[0] !== 0 
                          ? `${profile.location.coordinates[1].toFixed(4)}, ${profile.location.coordinates[0].toFixed(4)}`
                          : 'Click to detect'}
                        readOnly
                        placeholder="Click to detect location"
                      />
                      <button 
                        type="button"
                        className={profileStyles.locationButton}
                        onClick={handleGetLocation}
                      >
                        📍 Detect
                      </button>
                    </div>
                  </div>

                  <button
                    className={`${profileStyles.saveButton} ${profileStyles.fullWidth}`}
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preferences Section */}
          {activeSection === 'preferences' && (
            <div className={profileStyles.section}>
              <h2>Food Preferences & Notifications</h2>
              
              {!editMode ? (
                <div className={profileStyles.viewMode}>
                  <div className={profileStyles.viewField}>
                    <label>Dietary Restrictions</label>
                    <p>{preferences.dietaryRestrictions.length > 0 
                      ? preferences.dietaryRestrictions.join(', ') 
                      : 'None specified'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Allergens</label>
                    <p>{preferences.allergens.length > 0 
                      ? preferences.allergens.join(', ') 
                      : 'None specified'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Favorite Categories</label>
                    <p>{preferences.favoriteCategories.length > 0 
                      ? preferences.favoriteCategories.join(', ') 
                      : 'None specified'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Maximum Distance</label>
                    <p>{preferences.maxDistance} km</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Email Notifications</label>
                    <p>{preferences.notifications.email ? '✅ Enabled' : '❌ Disabled'}</p>
                  </div>
                  <div className={profileStyles.viewField}>
                    <label>Push Notifications</label>
                    <p>{preferences.notifications.push ? '✅ Enabled' : '❌ Disabled'}</p>
                  </div>
                </div>
              ) : (
                <>
                  <h3>Dietary Restrictions</h3>
                  <div className={profileStyles.checkboxGrid}>
                    {['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free', 'Dairy-Free'].map(item => (
                      <label key={item} className={profileStyles.checkbox}>
                        <input
                          type="checkbox"
                          checked={preferences.dietaryRestrictions.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPreferences({
                                ...preferences,
                                dietaryRestrictions: [...preferences.dietaryRestrictions, item]
                              });
                            } else {
                              setPreferences({
                                ...preferences,
                                dietaryRestrictions: preferences.dietaryRestrictions.filter(i => i !== item)
                              });
                            }
                          }}
                        />
                        {item}
                      </label>
                    ))}
                  </div>

                  <h3>Allergens</h3>
                  <div className={profileStyles.checkboxGrid}>
                    {['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Wheat', 'Fish'].map(item => (
                      <label key={item} className={profileStyles.checkbox}>
                        <input
                          type="checkbox"
                          checked={preferences.allergens.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPreferences({
                                ...preferences,
                                allergens: [...preferences.allergens, item]
                              });
                            } else {
                              setPreferences({
                                ...preferences,
                                allergens: preferences.allergens.filter(i => i !== item)
                              });
                            }
                          }}
                        />
                        {item}
                      </label>
                    ))}
                  </div>

                  <div className={profileStyles.formGroup}>
                    <label>Maximum Distance (km): {preferences.maxDistance}</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={preferences.maxDistance}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        maxDistance: parseInt(e.target.value)
                      })}
                    />
                  </div>

                  <h3>Notification Settings</h3>
                  <div className={profileStyles.checkboxGrid}>
                    <label className={profileStyles.checkbox}>
                      <input
                        type="checkbox"
                        checked={preferences.notifications.email}
                        onChange={(e) => setPreferences({
                          ...preferences,
                          notifications: {
                            ...preferences.notifications,
                            email: e.target.checked
                          }
                        })}
                      />
                      Email Notifications
                    </label>
                    <label className={profileStyles.checkbox}>
                      <input
                        type="checkbox"
                        checked={preferences.notifications.push}
                        onChange={(e) => setPreferences({
                          ...preferences,
                          notifications: {
                            ...preferences.notifications,
                            push: e.target.checked
                          }
                        })}
                      />
                      Push Notifications
                    </label>
                  </div>

                  <button
                    className={profileStyles.saveButton}
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : '💾 Save Preferences'}
                  </button>
                </>
              )}
            </div>
          )}

         
          {/* Security Section */}
          {activeSection === 'security' && (
            <div className={profileStyles.section}>
              <h2>Security & Account</h2>
              
              <div className={profileStyles.securityOptions}>
                {/* Change Password */}
                <div className={profileStyles.securityCard}>
                  <div className={profileStyles.securityCardContent}>
                    <div>
                      <h3>Change Password</h3>
                      <p>Update your account password</p>
                    </div>
                  </div>
                  <button
                    className={profileStyles.primaryButton}
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    Change Password
                  </button>
                </div>

                {/* Logout */}
                <div className={profileStyles.securityCard}>
                  <div className={profileStyles.securityCardContent}>
                    <div>
                      <h3>Logout</h3>
                      <p>Sign out from your account</p>
                    </div>
                  </div>
                  <button
                    className={profileStyles.secondaryButton}
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>

                {/* Delete Account */}
                <div className={profileStyles.securityCard}>
                  <div className={profileStyles.securityCardContent}>
                    <div>
                      <h3>Delete Account</h3>
                      <p className={profileStyles.dangerText}>
                        Permanently delete your account and all data
                      </p>
                    </div>
                  </div>
                  <button
                    className={profileStyles.deleteButton}
                    onClick={handleDeleteAccount}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMobile && (
        <MobileBottomNav 
          currentPage="profile"
          unreadCount={0}
          pendingReservations={0}
          onTabNavigation={(path) => navigate(path)}
        />
      )}

      {/* Toast Notifications */}
      <div className={styles.toastContainer}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${styles[toast.type]} ${styles.show}`}
            onClick={() => removeToast(toast.id)}
          >
            <div className={styles.toastIcon}>
              {toast.type === 'success' && '✅'}
              {toast.type === 'error' && '❌'}
              {toast.type === 'warning' && '⚠️'}
              {toast.type === 'info' && 'ℹ️'}
            </div>
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>{toast.title}</div>
              <div className={styles.toastMessage}>{toast.message}</div>
            </div>
            <button 
              className={styles.toastClose}
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className={profileStyles.modalOverlay} onClick={() => setShowChangePasswordModal(false)}>
          <div className={profileStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={profileStyles.modalHeader}>
              <h2>Change Password</h2>
              <button onClick={() => setShowChangePasswordModal(false)}>×</button>
            </div>
            
            <div className={profileStyles.modalBody}>
              <div className={profileStyles.formGroup}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div className={profileStyles.formGroup}>
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div className={profileStyles.formGroup}>
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className={profileStyles.modalFooter}>
              <button 
                className={profileStyles.cancelButton}
                onClick={() => setShowChangePasswordModal(false)}
              >
                Cancel
              </button>
              <button 
                className={profileStyles.saveButton}
                onClick={handleChangePassword}
                disabled={saving}
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
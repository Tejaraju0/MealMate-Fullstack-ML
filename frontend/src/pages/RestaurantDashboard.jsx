import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../css/Dashboard.module.css';
import restaurantStyles from '../css/RestaurantDashboard.module.css';
import myPostsStyles from '../css/MyPosts.module.css';
import axios from '../api/axios';

import Header from '../components/layout/Header';
import RestaurantSidebar from '../components/layout/RestaurantSidebar';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PostCard from '../components/ui/PostCard';
import DetailModal from '../components/ui/DetailModal';

const RestaurantDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  // Dashboard data
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    completedReservations: 0,
    totalRevenue: 0,
    avgWastePercentage: 0,
    totalWasted: 0
  });

  // Listings data
  const [myListings, setMyListings] = useState([]);
  const [wasteAnalytics, setWasteAnalytics] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Post food form state
  const [foodForm, setFoodForm] = useState({
    title: '',
    description: '',
    quantity: '',
    category: 'meal',
    price: '',
    originalPrice: '',
    isFree: false,
    pickupTime: '',
    pickupLocation: ''
  });
  
  // Location state
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Image upload state
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

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

  // Toast notification
  const showToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const checkRole = async () => {
      try {
        const response = await axios.get('/auth/profile');
        const user = response.data.user;
        
        if (user.role !== 'organization') {
          showToast('error', 'Access Denied', 'Only restaurants can access this page');
          navigate('/individual-dashboard');
          return;
        }
        
        await loadDashboardData();
      } catch (error) {
        console.error('Role check error:', error);
        navigate('/auth');
      }
    };

    checkRole();
  }, [navigate]);

  const fetchMyPosts = useCallback(async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      
      const response = await axios.get('/foodRoutes/my-listings');
      const posts = response.data.foodListings || [];
      
      setMyListings(posts);
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      showToast('error', 'Error', 'Failed to load your posts');
      setMyListings([]);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  }, []);


  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load listings
      await fetchMyPosts(false);
      
      try {
        const wasteResponse = await axios.get('/waste/analytics?period=30');
        console.log('Waste Analytics Response:', wasteResponse.data);
        setWasteAnalytics(wasteResponse.data);
      } catch (wasteError) {
        console.log('Waste analytics error:', wasteError);
        setWasteAnalytics(null);
      }

    } catch (error) {
      console.error('Error loading listings:', error);
      showToast('error', 'Error', 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  // Delete post function 
  const deletePost = async (postId, postTitle) => {
    try {
      setDeletingPostId(postId);
      
      await axios.delete(`/foodRoutes/${postId}`);
      showToast('success', 'Deleted!', `"${postTitle}" deleted successfully`);
      await fetchMyPosts(false); 
      
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('error', 'Error', error.response?.data?.message || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  // Change post status function 
  const changePostStatus = async (postId, newStatus) => {
    try {
      await axios.patch(`/foodRoutes/${postId}/status`, { status: newStatus });
      
      const statusMessages = {
        collected: 'Post marked as collected',
        available: 'Post marked as available',
        expired: 'Post marked as expired'
      };

      showToast('success', 'Updated!', statusMessages[newStatus] || `Status updated to ${newStatus}`);
      await fetchMyPosts(false); 
      
    } catch (error) {
      console.error('Error updating post status:', error);
      showToast('error', 'Error', error.response?.data?.message || 'Failed to update post status');
    }
  };

  const handleDeletePost = (postId, postTitle) => {
    if (window.confirm(`Are you sure you want to delete "${postTitle}"? This action cannot be undone.`)) {
      deletePost(postId, postTitle);
    }
  };
 
  const handleStatusUpdate = (postId, newStatus) => {
    const statusMessages = {
      collected: 'Mark this post as collected?',
      available: 'Mark this post as available again?',
      expired: 'Mark this post as expired?'
    };

    if (window.confirm(statusMessages[newStatus] || `Change status to ${newStatus}?`)) {
      changePostStatus(postId, newStatus);
    }
  };

  // Navigation functions 
  const handleViewMessages = (postId) => {
    navigate(`/messages?post=${postId}`);
  };

  const handleShowDetails = (post) => {
    setSelectedPost(post);
    setShowDetailModal(true);
  };

  const handleViewDetails = (post) => {
    setSelectedPost(post);
    setShowDetailModal(true);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Limit to 5 images
    if (files.length + selectedImages.length > 5) {
      showToast('warning', 'Too Many Images', 'Maximum 5 images allowed');
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        showToast('warning', 'File Too Large', `${file.name} exceeds 5MB`);
        return false;
      }
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Not Supported', 'Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          
          const address = data.display_name || `${latitude}, ${longitude}`;
          setFoodForm(prev => ({
            ...prev,
            pickupLocation: address
          }));
          
          showToast('success', 'Location Detected!', 'Your current location has been set');
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          setFoodForm(prev => ({
            ...prev,
            pickupLocation: `Current Location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`
          }));
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        showToast('error', 'Location Error', 'Unable to detect your location');
        setDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Handle food form submission
  const handlePostFood = async (e) => {
    e.preventDefault();
    
    if (selectedImages.length === 0) {
      showToast('warning', 'Images Required', 'Please upload at least 1 image for your hot deal');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', foodForm.title);
      formData.append('description', foodForm.description);
      formData.append('quantity', foodForm.quantity);
      formData.append('category', foodForm.category);
      formData.append('pickupTime', foodForm.pickupTime);
      formData.append('pickupLocation', foodForm.pickupLocation);
      formData.append('isFree', foodForm.isFree);
      
      if (!foodForm.isFree) {
        formData.append('price', foodForm.price);
        if (foodForm.originalPrice) {
          formData.append('originalPrice', foodForm.originalPrice);
        }
      }

      // Append all selected images
      selectedImages.forEach((image, index) => {
        formData.append('images', image);
      });

      const response = await axios.post('/foodRoutes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showToast('success', 'Posted!', 'Hot deal posted successfully');
      
      // Reset form
      setFoodForm({
        title: '',
        description: '',
        quantity: '',
        category: 'meal',
        price: '',
        originalPrice: '',
        isFree: false,
        pickupTime: '',
        pickupLocation: ''
      });
      setSelectedImages([]);
      setImagePreviews([]);
      
      // Reload listings
      await loadDashboardData();
      setActiveTab('listings');

    } catch (error) {
      console.error('Post food error:', error);
      showToast('error', 'Error', error.response?.data?.message || 'Failed to post hot deal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.dashboardContainer}>
      <Header 
        toggleSidebar={toggleSidebar}
        isMobile={isMobile}
      />

      {/* Sidebar Overlay */}
      <div 
        className={`${styles.sidebarOverlay} ${sidebarOpen && isTablet ? styles.show : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>
        {!isMobile && !isTablet && (
          <RestaurantSidebar 
            isMobile={false}
            isOpen={false}
            onClose={() => setSidebarOpen(false)}
            currentPage="dashboard"
          />
        )}

        {isTablet && (
          <RestaurantSidebar 
            isMobile={true}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentPage="dashboard"
          />
        )}

        <main className={styles.mainContent}>
          {/* Restaurant Header */}
          <div className={restaurantStyles.restaurantHeader}>
            <div className={restaurantStyles.headerContent}>
              <h1> Organisation Dashboard</h1>
              <p>Manage your food listings and track waste reduction</p>
            </div>
            <button
              className={restaurantStyles.wastePredictionBtn}
              onClick={() => navigate('/waste-prediction')}
            >
               Waste Prediction & Analytics
            </button>
          </div>

          {/* Tab Navigation */}
          <div className={restaurantStyles.tabNav}>
            <button
              className={`${restaurantStyles.tabButton} ${activeTab === 'overview' ? restaurantStyles.active : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`${restaurantStyles.tabButton} ${activeTab === 'post' ? restaurantStyles.active : ''}`}
              onClick={() => setActiveTab('post')}
            >
              Post Hot Deal
            </button>
            <button
              className={`${restaurantStyles.tabButton} ${activeTab === 'listings' ? restaurantStyles.active : ''}`}
              onClick={() => setActiveTab('listings')}
            >
              My Listings
              {/* Add count badge */}
              {myListings.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {myListings.length}
                </span>
              )}
            </button>
          </div>

          {/* Overview Tab */}
          <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div style={{ padding: '1.5rem' }}>
            <div className={restaurantStyles.overviewSection}>
              {/* Stats Grid */}
              <div className={restaurantStyles.statsGrid}>
                <div className={restaurantStyles.statCard}>
                  <div className={restaurantStyles.statIcon}>📋</div>
                  <div className={restaurantStyles.statContent}>
                    <h3>{myListings.length}</h3>
                    <p>Total Listings</p>
                  </div>
                </div>
                
                <div className={restaurantStyles.statCard}>
                  <div className={restaurantStyles.statIcon}>✅</div>
                  <div className={restaurantStyles.statContent}>
                    <h3>{myListings.filter(l => l.status === 'available').length}</h3>
                    <p>Active Listings</p>
                  </div>
                </div>
                
                <div className={restaurantStyles.statCard}>
                  <div className={restaurantStyles.statIcon}>🎯</div>
                  <div className={restaurantStyles.statContent}>
                    <h3>{stats.completedReservations}</h3>
                    <p>Completed</p>
                  </div>
                </div>
                
                <div className={restaurantStyles.statCard}>
                  <div className={restaurantStyles.statIcon}>💰</div>
                  <div className={restaurantStyles.statContent}>
                    <h3>£{(stats.totalRevenue || 0).toFixed(2)}</h3>
                    <p>Total Revenue</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className={restaurantStyles.quickActions}>
                <h2>Quick Actions</h2>
                <div className={restaurantStyles.actionButtons}>
                  <button
                    className={restaurantStyles.primaryButton}
                    onClick={() => setActiveTab('post')}
                  >
                     Post New Hot Deal
                  </button>
                  <button
                    className={restaurantStyles.secondaryButton}
                    onClick={() => navigate('/waste-prediction')}
                  >
                     View Waste Analytics
                  </button>
                  <button
                    className={restaurantStyles.secondaryButton}
                    onClick={() => navigate('/messages')}
                  >
                     View Messages
                  </button>
                  <button
                    className={restaurantStyles.secondaryButton}
                    onClick={() => navigate('/reservations')}
                  >
                     View Reservations
                  </button>
                </div>
              </div>

              {/* Waste Summary */}
              {wasteAnalytics && wasteAnalytics.summary ? (
                <div className={restaurantStyles.wasteSection}>
                  <h2>Waste Analytics (Last 30 Days)</h2>
                  <div className={restaurantStyles.wasteSummary}>
                    <div className={restaurantStyles.wasteCard}>
                      <h4>Total Prepared</h4>
                      <p className={restaurantStyles.wasteValue}>
                        {wasteAnalytics.summary.totalPrepared || 0} units
                      </p>
                    </div>
                    <div className={restaurantStyles.wasteCard}>
                      <h4>Total Sold</h4>
                      <p className={restaurantStyles.wasteValue}>
                        {wasteAnalytics.summary.totalSold || 0} units
                      </p>
                    </div>
                    <div className={restaurantStyles.wasteCard}>
                      <h4>Total Wasted</h4>
                      <p className={restaurantStyles.wasteValue}>
                        {wasteAnalytics.summary.totalWasted || 0} units
                      </p>
                    </div>
                    <div className={restaurantStyles.wasteCard}>
                      <h4>Avg Waste %</h4>
                      <p className={restaurantStyles.wasteValue} style={{
                        color: (wasteAnalytics.summary.avgWastePercentage || 0) > 30 ? '#ef4444' :
                               (wasteAnalytics.summary.avgWastePercentage || 0) > 15 ? '#f59e0b' : '#10b981'
                      }}>
                        {(wasteAnalytics.summary.avgWastePercentage || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                      className={restaurantStyles.secondaryButton}
                      onClick={() => navigate('/waste-prediction')}
                    >
                      View Detailed Analytics →
                    </button>
                  </div>
                </div>
              ) : (
                <div className={restaurantStyles.wasteSection}>
                  <h2>Waste Analytics</h2>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem',
                    background: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
                      No waste data yet. Start logging your waste to see analytics.
                    </p>
                    <button
                      className={restaurantStyles.primaryButton}
                      onClick={() => navigate('/waste-prediction')}
                    >
                      Log Waste Data
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Post Hot Deal Tab */}
          {activeTab === 'post' && (
            <div style={{ padding: '1.5rem' }}>
            <div className={restaurantStyles.postSection}>
              <h2>Post a Hot Deal</h2>
              <p className={restaurantStyles.subtitle}>
                List surplus food at discounted prices to reduce waste
              </p>

              <form onSubmit={handlePostFood} className={restaurantStyles.postForm}>
                <div className={restaurantStyles.formRow}>
                  <div className={restaurantStyles.formGroup}>
                    <label>Food Name *</label>
                    <input
                      type="text"
                      value={foodForm.title}
                      onChange={(e) => setFoodForm({ ...foodForm, title: e.target.value })}
                      placeholder="e.g., Fresh Pasta Meals"
                      required
                    />
                  </div>

                  <div className={restaurantStyles.formGroup}>
                    <label>Category *</label>
                    <select
                      value={foodForm.category}
                      onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                      required
                    >
                      <option value="meal">Meal</option>
                      <option value="snack">Snack</option>
                      <option value="bakery">Bakery</option>
                      <option value="fruits">Fruits</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className={restaurantStyles.formGroup}>
                  <label>Description</label>
                  <textarea
                    value={foodForm.description}
                    onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                    placeholder="Describe the food item..."
                    rows="3"
                  />
                </div>

                {/* Image Upload */}
                <div className={restaurantStyles.formGroup}>
                  <label>Food Images (Up to 5) *</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className={restaurantStyles.fileInput}
                    id="imageUpload"
                  />
                  <label htmlFor="imageUpload" className={restaurantStyles.fileInputLabel}>
                    📷 Choose Images (Max 5)
                  </label>
                  
                  {imagePreviews.length > 0 && (
                    <div className={restaurantStyles.imagePreviewGrid}>
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className={restaurantStyles.imagePreview}>
                          <img src={preview} alt={`Preview ${index + 1}`} />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className={restaurantStyles.removeImageBtn}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={restaurantStyles.helpText}>
                    {selectedImages.length}/5 images selected
                  </p>
                </div>

                <div className={restaurantStyles.formRow}>
                  <div className={restaurantStyles.formGroup}>
                    <label>Quantity (servings) *</label>
                    <input
                      type="number"
                      value={foodForm.quantity}
                      onChange={(e) => setFoodForm({ ...foodForm, quantity: e.target.value })}
                      placeholder="e.g., 10"
                      min="1"
                      required
                    />
                  </div>

                  <div className={restaurantStyles.formGroup}>
                    <label>Available Until *</label>
                    <input
                      type="datetime-local"
                      value={foodForm.pickupTime}
                      onChange={(e) => setFoodForm({ ...foodForm, pickupTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={restaurantStyles.formGroup}>
                  <label>Pickup Location *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={foodForm.pickupLocation}
                      onChange={(e) => setFoodForm({ ...foodForm, pickupLocation: e.target.value })}
                      placeholder="e.g., 123 Main St, London"
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={detectingLocation}
                      className={restaurantStyles.locationBtn}
                      style={{
                        padding: '0 16px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      {detectingLocation ? ' Detecting...' : ' Detect'}
                    </button>
                  </div>
                  <p className={restaurantStyles.helpText} style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Click "Detect" to use your current location
                  </p>
                </div>

                <div className={restaurantStyles.priceSection}>
                  <div className={restaurantStyles.checkboxGroup}>
                    <input
                      type="checkbox"
                      id="isFree"
                      checked={foodForm.isFree}
                      onChange={(e) => setFoodForm({ ...foodForm, isFree: e.target.checked })}
                    />
                    <label htmlFor="isFree">Offer for free (recommended for near-expiry items)</label>
                  </div>

                  {!foodForm.isFree && (
                    <div className={restaurantStyles.formGroup}>
                      <label>Price (£) *</label>
                      <input
                        type="number"
                        value={foodForm.price}
                        onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                        placeholder="e.g., 5.99"
                        min="0"
                        step="0.01"
                        required={!foodForm.isFree}
                      />
                    </div>
                  )}

                  {!foodForm.isFree && (
                    <>
                      <div className={restaurantStyles.formGroup}>
                        <label>Original Price (£) *</label>
                        <input
                          type="number"
                          value={foodForm.originalPrice}
                          onChange={(e) => setFoodForm({ ...foodForm, originalPrice: e.target.value })}
                          placeholder="e.g., 12.99"
                          min="0"
                          step="0.01"
                          required={!foodForm.isFree}
                        />
                        <p className={restaurantStyles.helpText}>
                          The regular menu price (for comparison)
                        </p>
                      </div>
                      
                      <div className={restaurantStyles.formGroup}>
                        <label>Deal Price (£) *</label>
                        <input
                          type="number"
                          value={foodForm.price}
                          onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                          placeholder="e.g., 5.99"
                          min="0"
                          step="0.01"
                          required={!foodForm.isFree}
                        />
                        <p className={restaurantStyles.helpText}>
                          The discounted price you're offering
                        </p>
                      </div>
                      
                      {foodForm.originalPrice && foodForm.price && (
                        <div style={{
                          padding: '0.75rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '6px',
                          marginTop: '0.5rem'
                        }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#059669', fontWeight: '600' }}>
                            💰 Customers save £{(parseFloat(foodForm.originalPrice) - parseFloat(foodForm.price)).toFixed(2)}
                            ({(((parseFloat(foodForm.originalPrice) - parseFloat(foodForm.price)) / parseFloat(foodForm.originalPrice)) * 100).toFixed(0)}% off)
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  className={restaurantStyles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : ' Post Hot Deal'}
                </button>
              </form>
            </div>
            </div>
          )}

          {/* My Listings Tab */}
          {activeTab === 'listings' && (
            <div className={myPostsStyles.pageWrapper}>
              <div className={myPostsStyles.mobileMainContainer}>
                {/* Header */}
                <div className={myPostsStyles.filterBar}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                      My Listings
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Manage your hot deals and food listings
                    </p>
                  </div>
                  <button
                    className={myPostsStyles.createBtn}
                    onClick={() => setActiveTab('post')}
                  >
                    + New Deal
                  </button>
                </div>

                {/* Status Filter Tabs */}
                <div className={myPostsStyles.statusFilters}>
                  <button
                    className={`${myPostsStyles.filterChip} ${statusFilter === 'all' ? myPostsStyles.active : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({myListings.length})
                  </button>
                  <button
                    className={`${myPostsStyles.filterChip} ${statusFilter === 'available' ? myPostsStyles.active : ''}`}
                    onClick={() => setStatusFilter('available')}
                  >
                    Available ({myListings.filter(p => p.status === 'available').length})
                  </button>
                  <button
                    className={`${myPostsStyles.filterChip} ${statusFilter === 'reserved' ? myPostsStyles.active : ''}`}
                    onClick={() => setStatusFilter('reserved')}
                  >
                    Reserved ({myListings.filter(p => p.status === 'reserved').length})
                  </button>
                  <button
                    className={`${myPostsStyles.filterChip} ${statusFilter === 'collected' ? myPostsStyles.active : ''}`}
                    onClick={() => setStatusFilter('collected')}
                  >
                    Collected ({myListings.filter(p => p.status === 'collected').length})
                  </button>
                  <button
                    className={`${myPostsStyles.filterChip} ${statusFilter === 'expired' ? myPostsStyles.active : ''}`}
                    onClick={() => setStatusFilter('expired')}
                  >
                    Expired ({myListings.filter(p => p.status === 'expired').length})
                  </button>
                </div>

                {/* Posts Grid */}
                {loading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    {myListings.filter(post => statusFilter === 'all' || post.status === statusFilter).length === 0 ? (
                      <div className={myPostsStyles.emptyState}>
                        <div className={myPostsStyles.emptyIcon}>
                          {statusFilter === 'all' ? '📦' : '🔍'}
                        </div>
                        <h3 className={myPostsStyles.emptyTitle}>
                          {statusFilter === 'all' ? 'No listings yet' : `No ${statusFilter} listings`}
                        </h3>
                        <p className={myPostsStyles.emptyText}>
                          {statusFilter === 'all'
                            ? 'Post your first hot deal to start reducing food waste'
                            : `You don't have any ${statusFilter} listings at the moment`}
                        </p>
                        {statusFilter === 'all' && (
                          <button
                            className={myPostsStyles.createBtn}
                            onClick={() => setActiveTab('post')}
                          >
                            Post Hot Deal
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={myPostsStyles.postsGrid}>
                        {myListings
                          .filter(post => statusFilter === 'all' || post.status === statusFilter)
                          .map(post => (
                            <PostCard
                              key={post._id}
                              item={post}
                              type="mypost"
                              isHotDeal={post.isHotDeal || false}
                              onClick={handleShowDetails}
                              onDelete={handleDeletePost}
                              onStatusUpdate={handleStatusUpdate}
                              onViewMessages={handleViewMessages}
                              isDeleting={deletingPostId === post._id}
                              deletingPostId={deletingPostId}
                            />
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          </div>
        </main>
      </div>

      {isMobile && (
        <MobileBottomNav 
          currentPage="restaurant-dashboard"
          onTabNavigation={(path) => navigate(path)}
        />
      )}

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        type="mypost"
        onStatusUpdate={handleStatusUpdate}
        onDelete={handleDeletePost}
        onViewMessages={handleViewMessages}
      />

      {/* Toast Notifications */}
      <div className={styles.toastContainer}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${styles[toast.type]} ${styles.show}`}
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default RestaurantDashboard;
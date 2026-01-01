import React, { useState, useEffect, useCallback } from 'react';
import styles from '../css/Dashboard.module.css';
import axios from '../api/axios';

// Import components
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PostCard from '../components/ui/PostCard';
import Modal from '../components/ui/Modal';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import FloatingActionButton from '../components/ui/FloatingActionButton';
import DetailModal from '../components/ui/DetailModal';
import EmptyState from '../components/ui/EmptyState';
import FoodMap from '../components/ui/FoodMap';
import ReservationModal from '../components/ui/ReservationModal'; 
import PaymentModal from '../components/ui/PaymentModal';
import LocationSharingModal from '../components/ui/LocationSharingModal';
import useSocket from '../hooks/useSocket';
import { 
  DiscoverIcon, 
  MapIcon, 
  ShareIcon, 
  DealsIcon,
  MealIcon,
  SnackIcon,
  BakeryIcon,
  FruitIcon,
  OtherFoodIcon,
  LocationIcon,
  QuantityIcon,
  ViewsIcon,
  MessagesIcon,
  ReservationsIcon
} from '../components/ui/Icons';

const Dashboard = ({ activeTab: initialActiveTab = 'discover', setActiveTab: setParentActiveTab }) => {
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showTabsExpanded, setShowTabsExpanded] = useState(false);
  
  // Socket integration
  const { socket, isConnected } = useSocket();
  
  // State for real data
  const [foodListings, setFoodListings] = useState([]);
  const [hotDeals, setHotDeals] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    mealsShared: 0,
    foodReceived: 0,
    co2Saved: 0,
    pointsEarned: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [userLocation, setUserLocation] = useState(null);

  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState(null);
  const [isReserving, setIsReserving] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReservations, setPendingReservations] = useState(0);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailFood, setSelectedDetailFood] = useState(null);

  useEffect(() => {
    if (setParentActiveTab) {
      setParentActiveTab(activeTab);
    }
  }, [activeTab, setParentActiveTab]);

  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  };

  // Toast notification system
  const showToast = (type, title, message) => {
    const id = Date.now();
    const toast = { id, type, title, message };
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch pending reservations count
  const fetchPendingReservations = useCallback(async () => {
    try {
      const response = await axios.get('/reservations?status=pending');
      setPendingReservations(response.data.reservations?.length || 0);
    } catch (error) {
      console.error('Error fetching pending reservations:', error);
      setPendingReservations(0);
    }
  }, []);

  const fetchFoodListings = async (page = 1, loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      }
      
      const response = await axios.get(`/foodRoutes?limit=6&page=${page}`);
      
      const listings = response.data?.foodListings || [];
      const pagination = response.data?.pagination || {};
      
      if (page === 1 || !loadMore) {
        setFoodListings(Array.isArray(listings) ? listings : []);
      } else {
        setFoodListings(prev => [
          ...prev,
          ...(Array.isArray(listings) ? listings : [])
        ]);
      }
      
      setCurrentPage(pagination.currentPage || page);
      setTotalPages(pagination.totalPages || 1);
      setHasMore(pagination.currentPage < pagination.totalPages);
      
    } catch (error) {
      if (page === 1) {
        setFoodListings([]);
      }
    } finally {
      if (loadMore) {
        setLoadingMore(false);
      }
    }
  };

  const fetchHotDeals = async () => {
    try {
      const response = await axios.get('/foodRoutes/hot-deals?limit=6');
      const deals = response.data?.hotDeals || [];
      setHotDeals(Array.isArray(deals) ? deals : []);
    } catch (error) {
      console.error('Error fetching hot deals:', error);
      setHotDeals([]);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await axios.get('/foodRoutes/dashboard-stats');
      const stats = response.data || {
        mealsShared: 0,
        foodReceived: 0,
        co2Saved: 0,
        pointsEarned: 0
      };
      setDashboardStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/messages/unread-count');
      const newUnreadCount = response.data.totalUnread || 0;
      
      if (newUnreadCount > unreadCount && unreadCount !== null) {
        showToast('info', 'New Message', `You have ${newUnreadCount} unread message${newUnreadCount > 1 ? 's' : ''}`);
      }
      
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, [unreadCount]);

    // Handle Stripe payment success callback
  const handleStripePaymentSuccess = async (sessionId, foodId) => {
    try {
      setIsProcessingPayment(true);
      
      const storedFood = sessionStorage.getItem('pendingReservationFood');
      const foodItem = storedFood ? JSON.parse(storedFood) : null;
      
      console.log('Retrieved stored food item:', foodItem);
      
      const paymentResponse = await axios.post('/payments/handle-payment-success', {
        sessionId,
        foodId
      });
      
      if (paymentResponse.data.success) {
        setSelectedFoodItem(foodItem);
        setPaymentResult({
          success: true,
          paymentInfo: paymentResponse.data.paymentInfo,
          foodId: foodItem._id,
          foodItem: foodItem
        });
        
        sessionStorage.removeItem('pendingReservationFood');
        
        showToast('success', 'Payment Secured!', paymentResponse.data.message);
        
        setTimeout(() => {
          setShowReservationModal(true);
        }, 500);
      }
    } catch (error) {
      console.error('Payment error:', error);
      showToast('error', 'Payment Error', error.response?.data?.message);
      sessionStorage.removeItem('pendingReservationFood');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStartConversation = async (foodItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        showToast('error', 'Authentication Required', 'Please log in to start a conversation');
        return;
      }

      const response = await axios.post('/messages/conversations', {
        foodListingId: foodItem._id,
        initialMessage: `Hi! I'm interested in your ${foodItem.title}. Is it still available?`
      });
      
      const { status } = response.data;
      
      if (status === 'exists') {
        showToast('info', 'Conversation Exists', 'You already have a conversation about this item. Check your messages.');
      } else if (status === 'request_sent') {
        showToast('success', 'Message Request Sent!', 'Your message has been sent to the food owner. They will be notified.');
      }
      
      fetchUnreadCount();
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      
      if (error.response?.status === 400 && error.response.data.message?.includes('cannot message yourself')) {
        showToast('warning', 'Cannot Message Yourself', 'You cannot message yourself about your own food post.');
      } else {
        showToast('error', 'Message Failed', error.response?.data?.message || 'Failed to start conversation. Please try again.');
      }
    }
  };

  // Handle reserve food item
  const handleReserveFood = async (foodItem, isHotDeal = false) => {
    if (!foodItem || !foodItem._id) {
      showToast('error', 'Invalid Food Item', 'Cannot reserve this food item');
      return;
    }

    console.log('Reserving food item:', foodItem, 'isHotDeal:', isHotDeal);
    
    setSelectedFoodItem(foodItem);
    sessionStorage.setItem('pendingReservationFood', JSON.stringify(foodItem));
    
    if (isHotDeal || foodItem.isHotDeal) {
      showToast('info', 'Hot Deal!', `Original Price: £${foodItem.originalPrice || 'N/A'} | Deal Price: £${foodItem.price}. Visit the restaurant to grab this deal!`);
      return;
    }
    
    if (!foodItem.isFree && foodItem.price > 0) {
      setTimeout(() => {
        setShowPaymentModal(true);
      }, 10);
    } else {
      setTimeout(() => {
        setShowReservationModal(true);
      }, 10);
    }
  };
  const handlePayment = async (paymentData) => {
    if (!selectedFoodItem) return;
    
    setIsProcessingPayment(true);
    
    try {
      let paymentInfo = null;
      
      if (paymentData.method === 'cash_on_pickup') {
        const response = await axios.post('/payments/confirm-cash', {
          foodId: selectedFoodItem._id,
          message: paymentData.paymentNote || 'Payment will be made in cash during pickup'
        });
        
        if (response.data.success) {
          paymentInfo = response.data.paymentInfo;
          showToast('success', 'Cash Payment Confirmed!', 'You can now send your reservation request.');
        }
        
      } else if (paymentData.method === 'stripe') {
        const response = await axios.post('/payments/create-checkout-session', {
          foodId: selectedFoodItem._id
        });
        
        if (response.data.success) {
          window.location.href = response.data.sessionUrl;
          return; 
        }
      }
     
      if (paymentInfo) {
        setPaymentResult({
          success: true,
          paymentInfo
        });
        
        setShowPaymentModal(false);
        setTimeout(() => setShowReservationModal(true), 100);
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      showToast('error', 'Payment Failed', error.response?.data?.message || 'Payment could not be processed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCloseReservationModal = () => {
    setShowReservationModal(false);
    setSelectedFoodItem(null);
    setIsReserving(false);
    setPaymentResult(null);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedFoodItem(null);
    setPaymentResult(null);
  };

  const submitReservation = async (reservationData) => {
    const foodId = selectedFoodItem?._id || 
                  paymentResult?.foodId || 
                  new URLSearchParams(window.location.search).get('food');
    
    if (!foodId) {
      console.error('No food ID available!', {
        selectedFoodItem,
        paymentResult,
        urlParams: window.location.search
      });
      showToast('error', 'Error', 'Unable to identify food item. Please try again.');
      return;
    }
    
    console.log('Creating reservation with Food ID:', foodId);
    
    setIsReserving(true);
    try {
      const requestData = {
        foodListingId: foodId,  
        message: reservationData.message,
        urgencyLevel: reservationData.urgencyLevel,
        contactMethod: reservationData.contactMethod,
        paymentInfo: paymentResult?.paymentInfo || null
      };

      console.log('Sending reservation request:', JSON.stringify(requestData, null, 2));

      const response = await axios.post('/reservations', requestData);

      console.log('Reservation created:', response.data);

      let successTitle = 'Request Sent!';
      let successMessage = 'Your reservation request has been sent.';
      
      if (paymentResult?.paymentInfo?.method === 'stripe_escrow') {
        successTitle = 'Payment Secured & Request Sent!';
        successMessage = 'Your payment is held securely. The provider can accept or decline your request.';
      } else if (paymentResult?.paymentInfo?.method === 'cash_on_pickup') {
        successMessage = 'Your request has been sent with cash payment option.';
      }

      showToast('success', successTitle, successMessage);
      
      fetchFoodListings(1);
      fetchUnreadCount();
      fetchPendingReservations();
      
      handleCloseReservationModal();
      
    } catch (error) {
      console.error(' Error creating reservation:', error);
      console.error('Response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 'Failed to send reservation request';
      
      if (errorMessage.includes('already have an active reservation')) {
        showToast('info', 'Already Reserved', 'You already have a reservation for this item. Check your reservations page.');
        handleCloseReservationModal(); 
        return; 
      }
      
      showToast('error', 'Reservation Failed', errorMessage);
      throw error;
    } finally {
      setIsReserving(false);
    }
  };

  const checkExistingReservation = async (foodId) => {
    try {
      const response = await axios.get('/reservations');
      const reservations = response.data.reservations || [];
      
      const existingReservation = reservations.find(
        res => res.foodListing?._id === foodId && 
              res.status !== 'cancelled' && 
              res.status !== 'rejected'
      );
      
      if (existingReservation) {
        console.log('Found existing reservation:', existingReservation);
        showToast('success', 'Reservation Found', 'Your reservation already exists. Redirecting...');
        
        setTimeout(() => {
          window.location.href = '/reservations';
        }, 2000);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking reservations:', error);
      return false;
    }
  };

  const handleShowDetails = (food) => {
    setSelectedDetailFood(food);
    setShowDetailModal(true);
  };

  // Location sharing functionality
  const handleShareLocation = () => {
    setShowLocationModal(true);
  };

  const handleLocationShared = (locationData) => {
    setShowLocationModal(false);
    showToast('success', 'Location Shared!', 'Your location has been shared successfully.');
    
    console.log('Location shared:', locationData);
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleFoodAdded = (newFood) => {
      setFoodListings(prev => [newFood, ...prev]);
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;
          const [lng, lat] = newFood.location?.coordinates || [0, 0];
          
          const distance = getDistanceFromLatLonInKm(latitude, longitude, lat, lng);
          if (distance <= 2) {
            showToast('info', ' New Food Nearby!', `${newFood.title} is available ${distance.toFixed(1)}km away`);
          }
        });
      }
    };

    const handleFoodUpdated = (updatedFood) => {
      setFoodListings(prev => 
        prev.map(item => item._id === updatedFood._id ? updatedFood : item)
      );
      setHotDeals(prev => 
        prev.map(item => item._id === updatedFood._id ? updatedFood : item)
      );
    };

    const handleFoodDeleted = (deletedFoodId) => {
      setFoodListings(prev => prev.filter(item => item._id !== deletedFoodId));
      setHotDeals(prev => prev.filter(item => item._id !== deletedFoodId));
    };

    const handleReservationCreated = ({ reservation }) => {
      fetchPendingReservations();
      showToast('info', 'New Reservation', 'You have a new reservation request!');
    };

    socket.on('food_added', handleFoodAdded);
    socket.on('food_updated', handleFoodUpdated);
    socket.on('food_deleted', handleFoodDeleted);
    socket.on('reservation_created', handleReservationCreated);

    return () => {
      socket.off('food_added', handleFoodAdded);
      socket.off('food_updated', handleFoodUpdated);
      socket.off('food_deleted', handleFoodDeleted);
      socket.off('reservation_created', handleReservationCreated);
    };
  }, [socket, isConnected]);

  // Utility function for distance calculation
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI/180);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
      
      if (width > 1024) {
        setSidebarOpen(false);
        setShowTabsExpanded(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (foodListings.length === 0 && hotDeals.length === 0) {
        setLoading(true);
      }
      
      await Promise.all([
        fetchFoodListings(1),
        fetchHotDeals(),
        fetchDashboardStats(),
        fetchUnreadCount(),
        fetchPendingReservations()
      ]);
      
      setLoading(false);
    };  
    
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['discover', 'map', 'post', 'deals'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    loadData();
  }, []);

  // Periodic unread count check
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchUnreadCount();
        fetchPendingReservations();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, fetchUnreadCount, fetchPendingReservations]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const foodId = urlParams.get('food'); 
    const sessionId = urlParams.get('session');

    console.log(' URL Params:', { paymentStatus, foodId, sessionId });

    if (paymentStatus === 'success' && foodId && sessionId) {
      console.log('Payment success detected, handling...');
      handleStripePaymentSuccess(sessionId, foodId);  
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      showToast('warning', 'Payment Cancelled', 'Your payment was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load more function for pagination
  const loadMoreListings = async () => {
    if (hasMore && !loadingMore) {
      await fetchFoodListings(currentPage + 1, true);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Navigation functions
  const handleTabNavigation = (path) => {
    if (path === '/my-posts') {
      window.location.href = '/my-posts';
    } else if (path === '/messages') {
      window.location.href = '/messages';
    } else if (path === '/reservations') {
      window.location.href = '/reservations';
    } else if (path === '/individual-dashboard') {
      // Already on dashboard
    } else if (path === '#profile') {
      console.log('Profile clicked');
    }
  };

  // Helper functions
  const formatTime = (timeString) => {
    if (!timeString) return 'Until available';
    try {
      const date = new Date(timeString);
      return `Until ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return timeString;
    }
  };

  const getCategoryIcon = (category, className = '') => {
    switch(category) {
      case 'meal':
        return <MealIcon className={className} />;
      case 'snack':
        return <SnackIcon className={className} />;
      case 'bakery':
        return <BakeryIcon className={className} />;
      case 'fruits':
        return <FruitIcon className={className} />;
      default:
        return <OtherFoodIcon className={className} />;
    }
  };

  const postFood = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      const form = event.target;
      
      formData.append('title', form.foodName.value);
      formData.append('description', form.description.value);
      formData.append('quantity', form.servings.value);
      formData.append('category', form.category.value);
      formData.append('pickupTime', form.availableUntil.value);
      
      const locationAddress = form.pickupLocation.value;
      let locationData = { address: locationAddress };

      if (locationAddress.includes('Current Location')) {
        const storedLocation = sessionStorage.getItem('userLocation');
        const location = userLocation || (storedLocation ? JSON.parse(storedLocation) : null);

        if (location) {
          locationData = {
            address: locationAddress,
            coordinates: [location.lng, location.lat]
          };
        } else {
          locationData = {
            address: locationAddress,
            coordinates: [-0.1278, 51.5074]
          };
        }
      } else {
        locationData = {
          address: locationAddress,
          coordinates: [-0.1278, 51.5074]
        };
      }

      formData.append("pickupLocation", locationData.address);
      formData.append("coordinates", JSON.stringify(locationData.coordinates));

      const isFree = form.isFree.checked;
      formData.append('isFree', isFree);
      if (!isFree && form.price.value) {
        formData.append('price', form.price.value);
      }
      
      if (form.ingredients.value.trim()) {
        formData.append('ingredients', form.ingredients.value.trim());
      }
      
      if (selectedImages.length > 0 && selectedImages[0].file) {
        formData.append("images", selectedImages[0].file);
      }

      const token = getAuthToken();
      if (!token) {
        showToast('error', 'Authentication Required', 'Please log in to post food');
        return;
      }

      const response = await axios.post('/foodRoutes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      
      form.reset();
      setSelectedImages([]);
      
      if (socket && isConnected) {
        socket.emit('food_posted', response.data.foodListing);
      }
      
      fetchFoodListings(1);
      fetchDashboardStats();

      showToast('success', 'Food Posted!', 'Your food listing is now live and visible to everyone nearby.');

      // Navigate to discover tab after posting
      setTimeout(() => {
        setActiveTab('discover');
      }, 1000);

    } catch (error) {
      console.error('Error posting food:', error);
      const errorMessage = error.response?.data?.message || 'Failed to post food. Please try again.';
      showToast('error', 'Post Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // location button handler
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Not Supported', 'Geolocation is not supported by this browser.');
      return;
    }

    const locationInput = document.getElementById('pickupLocation');
    const originalValue = locationInput.value;
    locationInput.value = 'Getting your location...';
    locationInput.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { lat: latitude, lng: longitude };

        setUserLocation(location);
        sessionStorage.setItem('userLocation', JSON.stringify(location));

        locationInput.value = `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        locationInput.disabled = false;

        showToast('success', 'Location Found', 'Your current location has been set');
      },
      (error) => {
        locationInput.value = originalValue;
        locationInput.disabled = false;

        let errorMessage = 'Could not get your location. Please enter manually.';
        if (error.code === 1) {
          errorMessage = 'Location permission denied. Please allow location access.';
        } else if (error.code === 2) {
          errorMessage = 'Location unavailable. Please check your device settings.';
        } else if (error.code === 3) {
          errorMessage = 'Location request timed out. Please try again.';
        }

        showToast('error', 'Location Error', errorMessage);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Image handling functions
  const handleImageUpload = () => {
    document.getElementById('imageInput').click();
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        showToast('error', 'Invalid File', `${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File Too Large', `${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const remainingSlots = 5 - selectedImages.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);
    
    if (validFiles.length > remainingSlots) {
      showToast('warning', 'Too Many Images', `Can only add ${remainingSlots} more images (max 5 total)`);
    }

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage = {
          id: Date.now() + Math.random(),
          file: file,
          preview: e.target.result,
          name: file.name
        };
        
        setSelectedImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (imageId) => {
    setSelectedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const editImage = (index) => {
    setEditingImageIndex(index);
    setShowImageEditor(true);
  };

  const closeImageEditor = () => {
    setShowImageEditor(false);
    setEditingImageIndex(null);
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <div>
      {isMobile ? (
        <header className={styles.mobileHeaderDashboard}>
          <h1 className={styles.mobileTitle}>MealMate</h1>
          <div className={styles.headerActions}>
            <button 
              className={styles.mobileNotificationBtn} 
              aria-label="Reservations"
              onClick={() => window.location.href = '/reservations'}
            >
              <ReservationsIcon className={styles.notificationIcon} />
              {pendingReservations > 0 && (
                <span className={styles.mobileNotificationBadge}>
                  {pendingReservations > 99 ? '99+' : pendingReservations}
                </span>
              )}
            </button>
            <button 
              className={styles.mobileNotificationBtn} 
              aria-label="Messages"
              onClick={() => window.location.href = '/messages'}
            >
              <MessagesIcon className={styles.notificationIcon} />
              {unreadCount > 0 && (
                <span className={styles.mobileNotificationBadge}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
      ) : (
        <Header 
          showMobileMenuButton={isTablet}
          onMobileMenuClick={toggleSidebar}
          unreadCount={unreadCount}
          pendingReservations={pendingReservations}
          isMobile={isMobile}
        />
      )}

        {/* SIDEBAR OVERLAY */}
        <div 
          className={`${styles.overlayFixed} ${sidebarOpen ? styles.show : ''}`}
          onClick={() => setSidebarOpen(false)}
        ></div>

        {/* SIDEBAR PANEL */}
        <div className={`${styles.sidebarFixed} ${sidebarOpen ? styles.open : ''}`}>
          <Sidebar
            isMobile={true}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            stats={dashboardStats}
            unreadCount={unreadCount}
            pendingReservations={pendingReservations}
            currentPage="dashboard"
          />
        </div>

      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>
        {/* Desktop Sidebar */}
        {!isMobile && !isTablet && (
          <Sidebar
            isMobile={false}
            isOpen={false}
            onClose={() => setSidebarOpen(false)}
            stats={dashboardStats}
            unreadCount={unreadCount}
            pendingReservations={pendingReservations}
            currentPage="dashboard"
          />
        )}

        {/* Toast Notifications */}
        <div className={styles.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.type]} ${styles.show}`}>
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

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Tab Navigation */}
          <div className={styles.tabNav}>
            {isMobile && !showTabsExpanded ? (
              <>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'map' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('map')}
                >
                  <MapIcon className={styles.tabIcon} />
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'post' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('post')}
                >
                  <ShareIcon className={styles.tabIcon} />
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'deals' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('deals')}
                >
                  <DealsIcon className={styles.tabIcon} />
                </button>
              </>
            ) : (
              <>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('discover')}
                >
                  <DiscoverIcon className={styles.tabIcon} />
                  <span className={styles.tabText}>Discover</span>
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'map' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('map')}
                >
                  <MapIcon className={styles.tabIcon} />
                  <span className={styles.tabText}>Map</span>
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'post' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('post')}
                >
                  <ShareIcon className={styles.tabIcon} />
                  <span className={styles.tabText}>Share</span>
                </button>
                <button 
                  className={`${styles.tabBtn} ${activeTab === 'deals' ? styles.active : ''}`} 
                  onClick={() => setActiveTab('deals')}
                >
                  <DealsIcon className={styles.tabIcon} />
                  <span className={styles.tabText}>Deals</span>
                </button>
              </>
            )}
          </div>

          {/* Tab Expander for mobile */}
          {isMobile && (
            <div className={styles.tabExpander}>
              <button 
                className={styles.expanderBtn}
                onClick={() => setShowTabsExpanded(!showTabsExpanded)}
              >
                {showTabsExpanded ? '▲' : '▼'}
              </button>
            </div>
          )}


          {/* Discover Food Tab */}
          {activeTab === 'discover' && (
            <div className={styles.tabContent}>
              <div className={styles.foodGrid}>
                {foodListings.map((item) => (
                  <PostCard
                    key={item._id}
                    item={item}
                    type="discover"
                    onReserve={handleReserveFood}
                    onMessage={handleStartConversation}
                    onClick={handleShowDetails}
                  />
                ))}
                {foodListings.length === 0 && (
                  <EmptyState
                    icon="🍽"
                    title="No food listings available"
                    description="No food listings available at the moment."
                    className={styles.noItems}
                  />
                )}
              </div>
              
              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button 
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.loadMoreBtn}`}
                    onClick={loadMoreListings}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <div className={styles.spinner} style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></div>
                        Loading...
                      </>
                    ) : (
                      `Load More (${currentPage}/${totalPages})`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className={styles.tabContent}>
              <FoodMap
                onReserve={handleReserveFood}
                onMessage={handleStartConversation}
                onShowDetails={handleShowDetails}
                socket={socket}
                isConnected={isConnected}
              />
            </div>
          )}

          {/* Hot Deals Tab */}
          {activeTab === 'deals' && (
            <div className={styles.tabContent}>
              <div className={styles.foodGrid}>
                {hotDeals.map((item) => (
                  <PostCard
                    key={item._id}
                    item={item}
                    type="deals"
                    isHotDeal={true}
                    onReserve={handleReserveFood}
                    onMessage={handleStartConversation}
                    onClick={handleShowDetails}
                  />
                ))}
                {hotDeals.length === 0 && (
                  <EmptyState
                    icon="🔥"
                    title="No hot deals available"
                    description="No hot deals available at the moment."
                    className={styles.noItems}
                  />
                )}
              </div>
            </div>
          )}

          {/* Share Food Tab */}
          {activeTab === 'post' && (
            <div className={styles.tabContent}>
              <form className={styles.form} onSubmit={postFood}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="foodName" className={styles.formLabel}>Food Name *</label>
                    <input 
                      type="text" 
                      id="foodName" 
                      name="foodName" 
                      className={styles.formInput} 
                      required 
                      placeholder="e.g., Fresh Vegetable Curry" 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="category" className={styles.formLabel}>Category *</label>
                    <select id="category" name="category" className={styles.formInput} required>
                      <option value="">Select category</option>
                      <option value="meal">Complete Meal</option>
                      <option value="snack">Snacks</option>
                      <option value="bakery">Bakery Items</option>
                      <option value="fruits">Fruits & Vegetables</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description" className={styles.formLabel}>Description</label>
                  <textarea 
                    id="description" 
                    name="description" 
                    className={`${styles.formInput} ${styles.formTextarea}`} 
                    placeholder="Describe your food item..."
                  ></textarea>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="servings" className={styles.formLabel}>Number of Servings *</label>
                    <input 
                      type="number" 
                      id="servings" 
                      name="servings" 
                      className={styles.formInput} 
                      required 
                      min="1" 
                      placeholder="e.g., 4" 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="availableUntil" className={styles.formLabel}>Available Until *</label>
                    <input 
                      type="datetime-local" 
                      id="availableUntil" 
                      name="availableUntil" 
                      className={styles.formInput} 
                      required 
                    />
                  </div>
                </div>

        {/* Price section */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Pricing</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="isFree" 
                name="isFree" 
                defaultChecked 
                onChange={(e) => {
                  const priceInput = document.getElementById('price');
                  if (e.target.checked) {
                    priceInput.disabled = true;
                    priceInput.value = '';
                  } else {
                    priceInput.disabled = false;
                    priceInput.focus();
                  }
                }}
              />
              <span className={styles.formLabel}>Free food</span>
            </label>
          </div>
          <div className={styles.locationInput}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: '500' }}>£</span>
            <input 
              type="number" 
              id="price" 
              name="price" 
              className={styles.formInput} 
              disabled
              min="0.50"
              step="0.50"
              placeholder="Enter price"
            />
          </div>
          <small className={styles.fieldHint}>Set a fair price or keep it free to help the community</small>
        </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Food Images</label>
                  
                  <div className={styles.imageUploadContainer}>
                    {selectedImages.length > 0 && (
                      <div className={styles.imageCarousel}>
                        {selectedImages.map((image, index) => (
                          <div key={image.id} className={styles.imageCarouselItem}>
                            <img src={image.preview} alt={`Food ${index + 1}`} className={styles.carouselImage} />
                            <div className={styles.imageActions}>
                              <button
                                type="button"
                                className={styles.editImageBtn}
                                onClick={() => editImage(index)}
                                title="Edit image"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={styles.removeImageBtn}
                                onClick={() => removeImage(image.id)}
                                title="Remove image"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {selectedImages.length < 5 && (
                          <div className={styles.addMoreBtn} onClick={handleImageUpload}>
                            <div className={styles.addIcon}>+</div>
                            <span>Add</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedImages.length === 0 && (
                      <div className={styles.initialUpload} onClick={handleImageUpload}>
                        <div className={styles.uploadIcon}>📷</div>
                        <div className={styles.uploadText}>Add food photos</div>
                        <div className={styles.uploadSubtext}>Select up to 5 images</div>
                      </div>
                    )}

                    {selectedImages.length > 0 && (
                      <div className={styles.imageCounter}>
                        {selectedImages.length}/5 images
                      </div>
                    )}

                    <input 
                      type="file" 
                      id="imageInput" 
                      accept="image/*" 
                      multiple
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="ingredients" className={styles.formLabel}>Ingredients Used</label>
                  <input 
                    type="text" 
                    id="ingredients" 
                    name="ingredients" 
                    className={styles.formInput} 
                    placeholder="e.g., rice, chicken, tomatoes, onions (comma separated)" 
                  />
                  <small className={styles.fieldHint}>This helps others with allergies and dietary preferences</small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Pickup Location *</label>
                  <div className={styles.locationInput}>
                    <input 
                      type="text" 
                      id="pickupLocation" 
                      name="pickupLocation" 
                      className={styles.formInput} 
                      required 
                      placeholder="Enter your approximate area (e.g., Downtown, Main Street)" 
                    />
                    <button 
                      type="button" 
                      className={styles.locationBtn}
                      onClick={handleUseMyLocation}
                    >
                      📍 Use My Location
                    </button>
                  </div>
                  <small className={styles.fieldHint}>Exact address will only be shared after food is reserved</small>
                </div>

                <button 
                  type="submit" 
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.submitBtn}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : 'Share Food'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          currentPage="dashboard"
          unreadCount={unreadCount}
          pendingReservations={pendingReservations}
          onTabNavigation={handleTabNavigation}
        />
      )}

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={() => setActiveTab('post')}
        isMobile={isMobile}
      />

      {/* Food Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        post={selectedDetailFood}
        type="discover"
        onReserve={handleReserveFood}
        onMessage={handleStartConversation}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={handleClosePaymentModal}
        foodItem={selectedFoodItem}
        onPayment={handlePayment}
        isProcessing={isProcessingPayment}
      />

      {/*Reservation Modal */}
      <ReservationModal
        isOpen={showReservationModal}
        onClose={handleCloseReservationModal}
        foodItem={selectedFoodItem}
        onSubmit={submitReservation}
        isSubmitting={isReserving}
        paymentResult={paymentResult}
      />

      {/*Location Sharing Modal */}
      <LocationSharingModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationShared={handleLocationShared}
      />
    </div>
  );
};

export default Dashboard;
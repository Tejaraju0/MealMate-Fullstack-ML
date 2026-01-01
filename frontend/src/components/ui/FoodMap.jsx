import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from '../../api/axios';
import styles from '../../css/Map.module.css';

const FoodMap = ({ 
  onReserve, 
  onMessage, 
  onShowDetails,
  socket,
  isConnected 
}) => {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef(new Map());
  const infoWindowRef = useRef(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [foodListings, setFoodListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [mapCenter, setMapCenter] = useState({ lat: 51.5074, lng: -0.1278 });
  const [selectedFilters, setSelectedFilters] = useState({
    category: 'all',
    isFree: 'all',
    radius: 'distance'
  });
  const [customRadius, setCustomRadius] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationPermissionState, setLocationPermissionState] = useState('unknown'); 
  const [nearbyStats, setNearbyStats] = useState({ total: 0, available: 0 });
  const [error, setError] = useState(null);

  const getCategoryIcon = (category, isHotDeal = false) => {
    const icons = {
      meal: '🍽️',
      snack: '🍪',
      bakery: '🥖',
      fruits: '🍎',
      other: '🥘'
    };
    return isHotDeal ? '🔥' : (icons[category] || '🍽️');
  };

  const initializeMap = useCallback(() => {
    if (!window.google?.maps?.Map || !mapRef.current) {
      return;
    }

    try {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      infoWindowRef.current = new window.google.maps.InfoWindow({
        maxWidth: 320
      });

      setIsLoaded(true);
      fetchNearbyFood();
      
    } catch (error) {
      setError('Failed to initialize map');
    }
  }, [mapCenter]);


  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError('Google Maps API key not found. Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file');
      return;
    }

    if (window.google?.maps?.Map) {
      initializeMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(checkLoaded);
          initializeMap();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    
    script.onload = () => {
      setTimeout(() => {
        initializeMap();
      }, 100);
    };
    
    script.onerror = () => {
      setError('Failed to load Google Maps. Check your API key.');
    };
    
    document.head.appendChild(script);
  }, [initializeMap]);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermissionState(result.state);
        
        if (result.state === 'granted') {
          getUserLocationSilently();
        } else if (result.state === 'prompt') {
          getUserLocationSilently();
        }
        
        result.addEventListener('change', () => {
          setLocationPermissionState(result.state);
          if (result.state === 'granted') {
            getUserLocationSilently();
          }
        });
      });
    } else {
      getUserLocationSilently();
    }
  }, []);

  useEffect(() => {
    if (isLoaded && !userLocation) {
      getUserLocationSilently();
    }
  }, [isLoaded]);

  const fetchNearbyFood = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const params = { 
        limit: 100, 
        status: 'available'
      };

      if (selectedFilters.radius !== 'distance' && userLocation && typeof selectedFilters.radius === 'number') {
        const radiusInMeters = selectedFilters.radius * 1000; 
        params.latitude = userLocation.lat;
        params.longitude = userLocation.lng;
        params.maxDistance = radiusInMeters;
      }

      const response = await axios.get('/foodRoutes', {
        params,
        headers
      });
      
      const listings = response.data?.foodListings || [];
      
      const validListings = listings.filter(item => {
        const coords = item.location?.coordinates;
        if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
        const [lng, lat] = coords;
        return lng !== 0 && lat !== 0 && !isNaN(lng) && !isNaN(lat);
      }).map(item => {
        if (userLocation) {
          const [lng, lat] = item.location.coordinates;
          item.distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
        }
        return item;
      });

      let filteredListings = validListings;
      if (selectedFilters.radius !== 'distance' && typeof selectedFilters.radius === 'number' && userLocation) {
        filteredListings = validListings.filter(item => 
          !item.distance || item.distance <= selectedFilters.radius * 1000
        );
      }

      setFoodListings(filteredListings);
      setNearbyStats({
        total: filteredListings.length,
        available: filteredListings.filter(item => item.status === 'available').length
      });
      
      updateMapMarkers(filteredListings);
      
    } catch (error) {
      setFoodListings([]);
      setNearbyStats({ total: 0, available: 0 });
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  };

  // Get user location silently without prompting
  const getUserLocationSilently = () => {
    if (!navigator.geolocation) {
      return;
    }

    if (locationPermissionState === 'denied') {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        setUserLocation(newLocation);
        
        if (googleMapRef.current) {
          if (mapCenter.lat === 51.5074 && mapCenter.lng === -0.1278) {
            googleMapRef.current.setCenter(newLocation);
            googleMapRef.current.setZoom(14);
            setMapCenter(newLocation);
          }
          addUserMarker(newLocation, accuracy);
        }
        
        if (isLoaded) {
          fetchNearbyFood();
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionState('denied');
        }
      },
      { 
        enableHighAccuracy: false, 
        timeout: 10000,
        maximumAge: 60000 
      }
    );
  };

  // Get user location with user interaction
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    if (locationPermissionState === 'denied') {
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        setUserLocation(newLocation);
        setMapCenter(newLocation);
        
        if (googleMapRef.current) {
          googleMapRef.current.setCenter(newLocation);
          googleMapRef.current.setZoom(15);
          addUserMarker(newLocation, accuracy);
        }
        
        setLocationPermissionState('granted');
        
        fetchNearbyFood();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionState('denied');
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const addUserMarker = (location, accuracy = 50) => {
    if (!googleMapRef.current || !window.google) return;

    const existingMarker = markersRef.current.get('user-location');
    const existingCircle = markersRef.current.get('user-accuracy');
    
    if (existingMarker) {
      existingMarker.setMap(null);
      markersRef.current.delete('user-location');
    }
    if (existingCircle) {
      existingCircle.setMap(null);
      markersRef.current.delete('user-accuracy');
    }

    const marker = new window.google.maps.Marker({
      position: location,
      map: googleMapRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4285f4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      title: 'Your Location',
      zIndex: 1000, 
      optimized: false
    });

    const accuracyCircle = new window.google.maps.Circle({
      strokeColor: '#4285f4',
      strokeOpacity: 0.2,
      strokeWeight: 1,
      fillColor: '#4285f4',
      fillOpacity: 0.1,
      map: googleMapRef.current,
      center: location,
      radius: Math.max(accuracy, 30) 
    });

    markersRef.current.set('user-location', marker);
    markersRef.current.set('user-accuracy', accuracyCircle);

    marker.addListener('click', () => {
      if (googleMapRef.current) {
        googleMapRef.current.setCenter(location);
        googleMapRef.current.setZoom(16);
      }
    });
  };

  const createFoodMarker = (foodItem) => {
    if (!googleMapRef.current || !foodItem.location?.coordinates) return null;

    const [lng, lat] = foodItem.location.coordinates;
    if (isNaN(lat) || isNaN(lng)) return null;

    const isAvailable = foodItem.status === 'available';
    const isHotDeal = checkIsHotDeal(foodItem);
    const categoryIcon = getCategoryIcon(foodItem.category, isHotDeal);

    try {
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: googleMapRef.current,
        title: foodItem.title,
        icon: {
          path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
          fillColor: isHotDeal ? '#ff6b35' : (isAvailable ? '#dc2626' : '#6b7280'), 
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.5,
          labelOrigin: new window.google.maps.Point(0, -30)
        },
        label: {
          text: categoryIcon,
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#ffffff'
        },
        zIndex: isHotDeal ? 100 : 50 
      });

      marker.addListener('click', () => {
        if (onShowDetails) {
          onShowDetails(foodItem);
        }
      });

      return marker;
    } catch (error) {
      return null;
    }
  };

  // Check if food item is a hot deal
  const checkIsHotDeal = (foodItem) => {
    if (!foodItem.expiryDate) return false;
    const now = new Date();
    const expiry = new Date(foodItem.expiryDate);
    const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);
    return (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) || 
           (!foodItem.isFree && foodItem.price < 10) ||
           (new Date() - new Date(foodItem.createdAt) < 2 * 60 * 60 * 1000);
  };

  const updateMapMarkers = (listings) => {
    if (!googleMapRef.current) return;

    markersRef.current.forEach((marker, key) => {
      if (key !== 'user-location' && key !== 'user-accuracy') {
        marker.setMap(null);
        markersRef.current.delete(key);
      }
    });

    listings.forEach(foodItem => {
      const marker = createFoodMarker(foodItem);
      if (marker) {
        markersRef.current.set(foodItem._id, marker);
      }
    });
  };

  // Handle radius filter change with auto-refresh
  const handleRadiusChange = (value) => {
    if (value === 'custom') {
     
      setSelectedFilters(prev => ({ ...prev, radius: 'custom' }));
      return;
    }
    setSelectedFilters(prev => ({ ...prev, radius: value }));
    setCustomRadius('');
  };

 
  const handleCustomRadiusChange = (value) => {
    setCustomRadius(value);
  };
  const handleCustomRadiusBlur = () => {
    const numValue = parseFloat(customRadius);
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedFilters(prev => ({ ...prev, radius: numValue }));
    } else {
      setSelectedFilters(prev => ({ ...prev, radius: 'distance' }));
      setCustomRadius('');
    }
  };
  const handleRefresh = () => {
    setSelectedFilters({
      category: 'all',
      isFree: 'all',
      radius: 'distance'
    });
    setCustomRadius('');
    setSearchQuery('');
    fetchNearbyFood();
  };

  useEffect(() => {
    if (isLoaded) {
      fetchNearbyFood();
    }
  }, [selectedFilters.radius, isLoaded]);

  useEffect(() => {
    let filtered = foodListings;

    if (selectedFilters.category !== 'all') {
      filtered = filtered.filter(item => 
        item.category?.toLowerCase() === selectedFilters.category.toLowerCase()
      );
    }

    if (selectedFilters.isFree !== 'all') {
      filtered = filtered.filter(item => 
        item.isFree === (selectedFilters.isFree === 'true')
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredListings(filtered);
    updateMapMarkers(filtered);
  }, [foodListings, selectedFilters.category, selectedFilters.isFree, searchQuery]);

  
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleFoodAdded = (newFood) => {
      if (newFood.location?.coordinates) {
        const [lng, lat] = newFood.location.coordinates;
        if (lng !== 0 && lat !== 0 && !isNaN(lng) && !isNaN(lat)) {
          setFoodListings(prev => [newFood, ...prev]);
        }
      }
    };

    const handleFoodUpdated = (updatedFood) => {
      setFoodListings(prev => 
        prev.map(item => item._id === updatedFood._id ? updatedFood : item)
      );
    };

    const handleFoodDeleted = (deletedFoodId) => {
      setFoodListings(prev => prev.filter(item => item._id !== deletedFoodId));
      
      const marker = markersRef.current.get(deletedFoodId);
      if (marker) {
        marker.setMap(null);
        markersRef.current.delete(deletedFoodId);
      }
    };

    socket.on('food_added', handleFoodAdded);
    socket.on('food_updated', handleFoodUpdated);
    socket.on('food_deleted', handleFoodDeleted);

    return () => {
      socket.off('food_added', handleFoodAdded);
      socket.off('food_updated', handleFoodUpdated);
      socket.off('food_deleted', handleFoodDeleted);
    };
  }, [socket, isConnected]);

  if (error) {
    return (
      <div className={styles.mapContainer}>
        <div className={styles.errorContainer}>
          <h3>Map Error</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className={styles.reloadBtn}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapContainer}>
      <div className={styles.mapControls}>
        <div className={styles.searchSection}>
          <div className={styles.searchInputContainer}>
            <input
              type="text"
              placeholder="Search food..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button 
              className={styles.locationBtn}
              onClick={getUserLocation}
              title={userLocation ? "Re-center to your location" : "Get my location"}
              style={{
                backgroundColor: userLocation ? '#10b981' : 'var(--primary)',
                animation: !userLocation && locationPermissionState === 'prompt' ? 'pulse 2s infinite' : 'none'
              }}
            >
              {userLocation ? '🎯' : '📍'}
            </button>
          </div>
        </div>

        <div className={styles.filterSection}>
          <select
            value={selectedFilters.category}
            onChange={(e) => setSelectedFilters(prev => ({ ...prev, category: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="all">All Categories</option>
            <option value="meal">Meals</option>
            <option value="snack">Snacks</option>
            <option value="bakery">Bakery</option>
            <option value="fruits">Fruits</option>
            <option value="other">Other</option>
          </select>

          <select
            value={selectedFilters.isFree}
            onChange={(e) => setSelectedFilters(prev => ({ ...prev, isFree: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="all">All Prices</option>
            <option value="true">Free Only</option>
            <option value="false">Paid Only</option>
          </select>

          <div className={styles.radiusFilterGroup}>
            <select
              value={selectedFilters.radius === 'custom' || (typeof selectedFilters.radius === 'number' && ![1, 2, 5, 10, 25].includes(selectedFilters.radius)) ? 'custom' : selectedFilters.radius}
              onChange={(e) => handleRadiusChange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="distance">Distance</option>
              <option value="1">1 km</option>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="custom">Custom</option>
            </select>

            {(selectedFilters.radius === 'custom' || (typeof selectedFilters.radius === 'number' && ![1, 2, 5, 10, 25].includes(selectedFilters.radius))) && (
              <input
                type="number"
                min="1"
                max="100"
                value={customRadius}
                onChange={(e) => handleCustomRadiusChange(e.target.value)}
                onBlur={handleCustomRadiusBlur}
                onKeyPress={(e) => e.key === 'Enter' && handleCustomRadiusBlur()}
                className={styles.customRadiusInput}
                placeholder="km"
                autoFocus
              />
            )}
          </div>

          <button
            onClick={handleRefresh}
            className={styles.refreshBtn}
            title="Reset filters and refresh"
          >
            🔄
          </button>
        </div>

        <div className={styles.mapStats}>
          <span className={styles.statItem}>📍 {nearbyStats.total} total</span>
          <span className={styles.statItem}>✅ {nearbyStats.available} available</span>
          {userLocation && selectedFilters.radius !== 'distance' && (
            <span className={styles.statItem}>📏 {selectedFilters.radius}km radius</span>
          )}
          {userLocation && (
            <span className={styles.statItem}>🎯 Location found</span>
          )}
          {locationPermissionState === 'denied' && (
            <span className={styles.statItem}>❌ Location denied</span>
          )}
        </div>
      </div>

      <div ref={mapRef} className={styles.map} />

      {!isLoaded && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
          <p>Loading map...</p>
        </div>
      )}
      {isLoaded && !userLocation && locationPermissionState === 'denied' && (
        <div className={styles.locationPrompt}>
          <div className={styles.promptContent}>
            <div className={styles.promptIcon}>📍</div>
            <h3>Enable Location</h3>
            <p>Enable location access to see nearby food and get accurate distance filtering.</p>
            <button 
              className={styles.enableLocationBtn}
              onClick={() => {
                
                alert('To enable location:\n1. Click the location icon in your address bar\n2. Select "Allow"\n3. Refresh the page');
              }}
            >
              How to Enable Location
            </button>
            <button className={styles.skipBtn} onClick={() => setLocationPermissionState('skipped')}>
              Continue without location
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodMap;
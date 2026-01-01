const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { Message, Conversation } = require('../models/message');
const User = require('../models/user');
const FoodListing = require('../models/foodListing');

class SocketService {
  constructor() {
    this.io = null;
    this.users = new Map(); 
    this.mapViewers = new Map(); 
    this.roomSubscriptions = new Map(); 
    this.geographicRooms = new Map(); 
    this.locationUpdates = new Map(); 
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(` User ${socket.user.name} connected: ${socket.id}`);
      
      this.users.set(socket.user._id.toString(), {
        socketId: socket.id,
        location: socket.user.location,
        lastSeen: new Date(),
        mapViewport: null,
        preferences: {
          notifyRadius: 5000, 
          categories: [],
          priceRange: 'all',
          hotDealsOnly: false,
          realTimeUpdates: true
        },
        viewingMap: false
      });
      
      this.updateUserStatus(socket.user._id, true);

      this.joinUserConversations(socket);

      socket.on('map_session_start', (data) => {
        this.handleMapSessionStart(socket, data);
      });

      socket.on('map_session_end', () => {
        this.handleMapSessionEnd(socket);
      });

      
      socket.on('map_viewport_change', (data) => {
        this.handleMapViewportChange(socket, data);
      });

      
      socket.on('join_geographic_area', (data) => {
        this.handleJoinGeographicArea(socket, data);
      });

      socket.on('leave_geographic_area', (data) => {
        this.handleLeaveGeographicArea(socket, data);
      });

      
      socket.on('food_marker_viewed', (data) => {
        this.handleFoodMarkerViewed(socket, data);
      });

      socket.on('food_marker_clicked', (data) => {
        this.handleFoodMarkerClicked(socket, data);
      });

      
      socket.on('location_update', (data) => {
        this.handleLocationUpdate(socket, data);
      });

      
      socket.on('set_notification_preferences', (data) => {
        this.handleSetNotificationPreferences(socket, data);
      });

      
      socket.on('map_search', (data) => {
        this.handleMapSearch(socket, data);
      });

      socket.on('map_filter_change', (data) => {
        this.handleMapFilterChange(socket, data);
      });

      
      socket.on('food_reserve_attempt', (data) => {
        this.handleFoodReserveAttempt(socket, data);
      });

      socket.on('food_message_sent', (data) => {
        this.handleFoodMessageSent(socket, data);
      });

      
      socket.on('map_analytics', (data) => {
        this.handleMapAnalytics(socket, data);
      });

      socket.on('disconnect', () => {
        console.log(` User ${socket.user.name} disconnected`);
        this.cleanupUserSession(socket);
      });

      
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        console.log(`${socket.user.name} joined conversation ${conversationId}`);
      });

      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
      });

      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      socket.on('message_read', async (data) => {
        await this.handleMessageRead(socket, data);
      });

      socket.on('message_delivered', async (data) => {
        await this.handleMessageDelivered(socket, data);
      });
    });

    return this.io;
  }
  handleMapSessionStart(socket, data) {
    const { viewport, preferences } = data;
    const userId = socket.user._id.toString();
    const userData = this.users.get(userId);
    
    if (userData) {
      userData.viewingMap = true;
      userData.mapViewport = viewport;
      if (preferences) {
        userData.preferences = { ...userData.preferences, ...preferences };
      }
      this.users.set(userId, userData);
    }

    
    if (viewport) {
      this.joinGeographicRoomsForViewport(socket, viewport);
    }

    console.log(`${socket.user.name} started map session`);
  }

  handleMapSessionEnd(socket) {
    const userId = socket.user._id.toString();
    const userData = this.users.get(userId);
    
    if (userData) {
      userData.viewingMap = false;
      userData.mapViewport = null;
      this.users.set(userId, userData);
    }

    this.leaveAllGeographicRooms(socket);

    console.log(`${socket.user.name} ended map session`);
  }

  handleMapViewportChange(socket, data) {
    const { bounds, zoom, center, filters } = data;
    const userId = socket.user._id.toString();
    
    
    this.mapViewers.set(socket.id, {
      bounds,
      zoom,
      center,
      filters: filters || {},
      lastUpdate: new Date()
    });
   
    const userData = this.users.get(userId);
    if (userData) {
      userData.mapViewport = { bounds, zoom, center };
      this.users.set(userId, userData);
    }
    
    this.updateGeographicRooms(socket, bounds, zoom);
    
    this.debouncedViewportUpdate(socket, bounds, filters);
  }

  handleJoinGeographicArea(socket, data) {
    const { latitude, longitude, radius, areaId } = data;
    
    const finalAreaId = areaId || this.generateAreaId(latitude, longitude, radius);
    const roomId = `geo_area_${finalAreaId}`;
    
    socket.join(roomId);
        
    if (!this.roomSubscriptions.has(roomId)) {
      this.roomSubscriptions.set(roomId, new Set());
    }
    this.roomSubscriptions.get(roomId).add(socket.id);

    console.log(` ${socket.user.name} joined geographic area ${finalAreaId}`);
  }

  handleLeaveGeographicArea(socket, data) {
    const { areaId } = data;
    const roomId = `geo_area_${areaId}`;
    
    socket.leave(roomId);
    
    
    const subscribers = this.roomSubscriptions.get(roomId);
    if (subscribers) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        this.roomSubscriptions.delete(roomId);
      }
    }

    console.log(` ${socket.user.name} left geographic area ${areaId}`);
  }

  handleFoodMarkerViewed(socket, data) {
    const { foodId, duration, userLocation, markerData } = data;
    
    
    this.trackFoodInteraction('marker_viewed', {
      foodId,
      userId: socket.user._id,
      duration,
      userLocation,
      markerData,
      timestamp: new Date()
    });
    
    this.updateFoodViewCount(foodId, 'map_marker', userLocation);
  }

  handleFoodMarkerClicked(socket, data) {
    const { foodId, userLocation, actionType } = data;
    
    this.trackFoodInteraction('marker_clicked', {
      foodId,
      userId: socket.user._id,
      actionType, 
      userLocation,
      timestamp: new Date()
    });
  
    this.updateFoodViewCount(foodId, 'map_click', userLocation);
   
    this.notifyFoodOwnerOfInteraction(foodId, socket.user._id, 'viewed_on_map');
  }

  handleLocationUpdate(socket, data) {
    const { latitude, longitude, accuracy, shareLevel } = data;
    const userId = socket.user._id.toString();
    
    if (shareLevel === 'none') return;
    
    const lastUpdate = this.locationUpdates.get(userId);
    const now = Date.now();
    if (lastUpdate && now - lastUpdate < 10000) { 
      return;
    }
    this.locationUpdates.set(userId, now);

    const userData = this.users.get(userId);
    if (userData) {
      userData.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
        accuracy,
        shareLevel,
        updatedAt: new Date()
      };
      this.users.set(userId, userData);
    }

    if (accuracy < 100) { 
      this.updateUserLocationInDB(socket.user._id, latitude, longitude);
    }

    
    this.updateGeographicRoomsForLocation(socket, latitude, longitude);

    console.log(`Location updated for ${socket.user.name}: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${accuracy}m)`);
  }

  handleSetNotificationPreferences(socket, data) {
    const { 
      notifyRadius, 
      categories, 
      priceRange, 
      hotDealsOnly, 
      realTimeUpdates,
      soundEnabled,
      frequency 
    } = data;
    
    const userId = socket.user._id.toString();
    const userData = this.users.get(userId);
    
    if (userData) {
      userData.preferences = {
        ...userData.preferences,
        notifyRadius: notifyRadius !== undefined ? notifyRadius : userData.preferences.notifyRadius,
        categories: categories || userData.preferences.categories,
        priceRange: priceRange || userData.preferences.priceRange,
        hotDealsOnly: hotDealsOnly !== undefined ? hotDealsOnly : userData.preferences.hotDealsOnly,
        realTimeUpdates: realTimeUpdates !== undefined ? realTimeUpdates : userData.preferences.realTimeUpdates,
        soundEnabled: soundEnabled !== undefined ? soundEnabled : userData.preferences.soundEnabled,
        frequency: frequency || userData.preferences.frequency || 'normal'
      };
      this.users.set(userId, userData);
    }

    socket.emit('notification_preferences_updated', userData.preferences);
    console.log(` Notification preferences updated for ${socket.user.name}`);
  }

  handleMapSearch(socket, data) {
    const { query, filters, location } = data;
    
    
    this.trackSearchAnalytics({
      userId: socket.user._id,
      query,
      filters,
      location,
      timestamp: new Date()
    });

  
    if (location) {
      this.broadcastToNearbyUsers(location.coordinates, 1000, 'search_activity', {
        searchType: 'map_search',
        area: location
      }, socket.user._id);
    }
  }

  handleMapFilterChange(socket, data) {
    const { filters, viewport } = data;
    const userId = socket.user._id.toString();
    
    const userData = this.users.get(userId);
    if (userData && userData.mapViewport) {
      userData.mapViewport.filters = filters;
      this.users.set(userId, userData);
    }

    const viewerData = this.mapViewers.get(socket.id);
    if (viewerData) {
      viewerData.filters = filters;
      this.mapViewers.set(socket.id, viewerData);
    }

    console.log(`Map filters updated for ${socket.user.name}:`, filters);
  }

  handleFoodReserveAttempt(socket, data) {
    const { foodId, reservationType } = data;
        
    this.trackFoodInteraction('reserve_attempt', {
      foodId,
      userId: socket.user._id,
      reservationType,
      timestamp: new Date()
    });

    this.notifyFoodOwnerOfInteraction(foodId, socket.user._id, 'reservation_attempt');
  }

  handleFoodMessageSent(socket, data) {
    const { foodId, messageType } = data;
        
    this.trackFoodInteraction('message_sent', {
      foodId,
      userId: socket.user._id,
      messageType,
      timestamp: new Date()
    });
  }

  handleMapAnalytics(socket, data) {
    const { eventType, eventData } = data;
     
    this.trackAnalyticsEvent(eventType, {
      userId: socket.user._id,
      ...eventData,
      timestamp: new Date()
    });
  }

  broadcastNewFood(foodItem) {
    if (!foodItem.location?.coordinates) return;

    const [lng, lat] = foodItem.location.coordinates;
    
    
    const notificationTiers = [
      { radius: 1000, priority: 'critical', delay: 0 },
      { radius: 3000, priority: 'high', delay: 2000 },
      { radius: 10000, priority: 'medium', delay: 5000 },
      { radius: 25000, priority: 'low', delay: 10000 }
    ];

    notificationTiers.forEach((tier, index) => {
      setTimeout(() => {
        const nearbyUsers = this.findUsersInRadius(lat, lng, tier.radius);
        
        nearbyUsers.forEach(userData => {
          const { socketId, preferences, location } = userData;
                   
          if (!this.shouldNotifyUser(foodItem, preferences)) return;
          
          const distance = this.calculateDistance(
            location?.coordinates,
            [lng, lat]
          );
          this.io.to(socketId).emit('nearby_food_added', {
            food: foodItem,
            distance,
            priority: tier.priority,
            notificationTier: index + 1,
            personalizedMessage: this.generatePersonalizedMessage(foodItem, userData, distance)
          });
        });
      }, tier.delay);
    });

    this.broadcastToGeographicRooms(foodItem, 'food_added');
  }

  broadcastFoodUpdate(foodItem) {
    
    this.io.emit('food_updated', foodItem);
    
    this.broadcastToGeographicRooms(foodItem, 'food_updated');
    
    this.notifyInterestedUsers(foodItem, 'food_updated');
  }

  broadcastFoodDeletion(foodId, location) {
    this.io.emit('food_deleted', foodId);
    
    if (location?.coordinates) {
      const mockFoodItem = { _id: foodId, location };
      this.broadcastToGeographicRooms(mockFoodItem, 'food_deleted');
    }
  }
  joinGeographicRoomsForViewport(socket, viewport) {
    const { bounds, zoom } = viewport;
    if (!bounds) return;

    const { north, south, east, west } = bounds;
      
    const gridSize = this.calculateGridSize(zoom);
        
    const rooms = this.generateRoomsForBounds(north, south, east, west, gridSize);
        
    rooms.forEach(roomId => {
      socket.join(roomId);
      this.trackGeographicRoomJoin(roomId, socket.id);
    });
  }

  updateGeographicRooms(socket, bounds, zoom) {
    
    this.leaveAllGeographicRooms(socket);
    
        this.joinGeographicRoomsForViewport(socket, { bounds, zoom });
  }

  updateGeographicRoomsForLocation(socket, lat, lng) {
    const gridSize = 0.01; 
    const rooms = this.generateRoomsForPoint(lat, lng, gridSize, 2); 
    
    rooms.forEach(roomId => {
      socket.join(roomId);
      this.trackGeographicRoomJoin(roomId, socket.id);
    });
  }

  leaveAllGeographicRooms(socket) {
    
    const rooms = Array.from(socket.rooms);
    rooms.forEach(roomId => {
      if (roomId.startsWith('geo_')) {
        socket.leave(roomId);
        this.trackGeographicRoomLeave(roomId, socket.id);
      }
    });
  }

  generateAreaId(latitude, longitude, radius) {
    const lat = parseFloat(latitude).toFixed(3);
    const lng = parseFloat(longitude).toFixed(3);
    const rad = parseInt(radius);
    return `${lat}_${lng}_${rad}`;
  }

  calculateGridSize(zoom) {
    
    if (zoom >= 16) return 0.001; 
    if (zoom >= 14) return 0.01;  
    if (zoom >= 12) return 0.05;  
    return 0.1; 
  }

  generateRoomsForBounds(north, south, east, west, gridSize) {
    const rooms = [];
    
    for (let lat = Math.floor(south / gridSize) * gridSize; lat <= north; lat += gridSize) {
      for (let lng = Math.floor(west / gridSize) * gridSize; lng <= east; lng += gridSize) {
        rooms.push(`geo_${lat.toFixed(3)}_${lng.toFixed(3)}`);
      }
    }
    
    return rooms;
  }

  generateRoomsForPoint(lat, lng, gridSize, gridRadius = 1) {
    const rooms = [];
    const centerLat = Math.floor(lat / gridSize) * gridSize;
    const centerLng = Math.floor(lng / gridSize) * gridSize;
    
    for (let i = -gridRadius; i <= gridRadius; i++) {
      for (let j = -gridRadius; j <= gridRadius; j++) {
        const roomLat = centerLat + (i * gridSize);
        const roomLng = centerLng + (j * gridSize);
        rooms.push(`geo_${roomLat.toFixed(3)}_${roomLng.toFixed(3)}`);
      }
    }
    
    return rooms;
  }

  trackGeographicRoomJoin(roomId, socketId) {
    if (!this.geographicRooms.has(roomId)) {
      this.geographicRooms.set(roomId, new Set());
    }
    this.geographicRooms.get(roomId).add(socketId);
  }

  trackGeographicRoomLeave(roomId, socketId) {
    const room = this.geographicRooms.get(roomId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.geographicRooms.delete(roomId);
      }
    }
  }

  debouncedViewportUpdate(socket, bounds, filters) {
    const key = `viewport_${socket.id}`;
    
    
    if (this[key]) {
      clearTimeout(this[key]);
    }
    
    
    this[key] = setTimeout(() => {
      this.sendViewportFoodUpdate(socket, bounds, filters);
      delete this[key];
    }, 500); 
  }

  sendViewportFoodUpdate(socket, bounds, filters) {
    
    
    socket.emit('viewport_food_update', {
      bounds,
      filters,
      timestamp: new Date()
    });
  }

  findUsersInRadius(centerLat, centerLng, radius) {
    const nearbyUsers = [];
    
    this.users.forEach((userData, userId) => {
      if (!userData.viewingMap || !userData.preferences.realTimeUpdates) return;
      
      const userLocation = userData.location?.coordinates;
      if (!userLocation) return;
      
      const [userLng, userLat] = userLocation;
      const distance = this.calculateDistance([centerLng, centerLat], [userLng, userLat]);
      
      if (distance <= radius) {
        nearbyUsers.push({
          userId,
          ...userData,
          distance
        });
      }
    });
    
    return nearbyUsers;
  }

  shouldNotifyUser(foodItem, preferences) {
    
    
    
    if (!preferences.realTimeUpdates) return false;
    
    
    if (preferences.categories.length > 0) {
      if (!preferences.categories.includes(foodItem.category)) {
        return false;
      }
    }
    
    
    if (preferences.priceRange === 'free' && !foodItem.isFree) {
      return false;
    }
    
    
    if (preferences.hotDealsOnly && !this.isHotDeal(foodItem)) {
      return false;
    }
    
    
    if (preferences.frequency === 'minimal') {
      
      return this.isHotDeal(foodItem);
    }
    
    return true;
  }

  generatePersonalizedMessage(foodItem, userData, distance) {
    const distanceText = distance < 1000 ? 
      `${Math.round(distance)}m away` : 
      `${(distance / 1000).toFixed(1)}km away`;
    
    const urgency = this.isHotDeal(foodItem) ? 'Hot deal alert! ' : '';
    const category = foodItem.category === 'meal' ? '🍽️' : '🍪';
    
    return `${urgency}${category} ${foodItem.title} is ${distanceText}`;
  }

  broadcastToGeographicRooms(foodItem, eventType) {
    if (!foodItem.location?.coordinates) return;
    
    const [lng, lat] = foodItem.location.coordinates;
    
    
    const affectedRooms = this.calculateAffectedRooms(lat, lng);
    
    affectedRooms.forEach(roomId => {
      this.io.to(roomId).emit(eventType, foodItem);
    });
  }

  calculateAffectedRooms(lat, lng, radius = 0.02) {
    const rooms = [];
    const gridSizes = [0.001, 0.01, 0.05, 0.1];
    
    gridSizes.forEach(gridSize => {
      const gridRadius = Math.ceil(radius / gridSize);
      const roomsForGrid = this.generateRoomsForPoint(lat, lng, gridSize, gridRadius);
      rooms.push(...roomsForGrid);
    });
    
    return [...new Set(rooms)]; 
  }

  broadcastToNearbyUsers(coordinates, radius, eventType, data, excludeUserId = null) {
    const [lng, lat] = coordinates;
    const nearbyUsers = this.findUsersInRadius(lat, lng, radius);
    
    nearbyUsers.forEach(userData => {
      if (excludeUserId && userData.userId === excludeUserId.toString()) return;
      
      this.io.to(userData.socketId).emit(eventType, {
        ...data,
        distance: userData.distance
      });
    });
  }

  isHotDeal(foodItem) {
    if (!foodItem.expiryDate) return false;
    const now = new Date();
    const expiry = new Date(foodItem.expiryDate);
    const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);
    return (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) || 
           (!foodItem.isFree && foodItem.price < 10) ||
           (new Date() - new Date(foodItem.createdAt) < 2 * 60 * 60 * 1000);
  }

  calculateDistance(coords1, coords2) {
    if (!coords1 || !coords2) return null;
    
    const [lng1, lat1] = coords1;
    const [lng2, lat2] = coords2;
    
    const R = 6371000; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  

  trackFoodInteraction(interactionType, data) {
    
    console.log(`Food interaction tracked: ${interactionType}`, {
      foodId: data.foodId,
      userId: data.userId,
      timestamp: data.timestamp
    });
    
    
  }

  trackSearchAnalytics(data) {
    console.log(`Search analytics:`, {
      userId: data.userId,
      query: data.query,
      timestamp: data.timestamp
    });
  }

  trackAnalyticsEvent(eventType, data) {
    console.log(`Analytics event: ${eventType}`, data);
  }

  

  async updateFoodViewCount(foodId, viewType, userLocation) {
    try {
      await FoodListing.findByIdAndUpdate(foodId, {
        $inc: { 
          views: 1,
          [`viewsByType.${viewType}`]: 1
        }
      });
    } catch (error) {
      console.error('Error updating food view count:', error);
    }
  }

  async updateUserLocationInDB(userId, latitude, longitude) {
    try {
      await User.findByIdAndUpdate(userId, {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]
        }
      });
    } catch (error) {
      console.error('Error updating user location in DB:', error);
    }
  }

  async notifyFoodOwnerOfInteraction(foodId, interactingUserId, interactionType) {
    try {
      const food = await FoodListing.findById(foodId).populate('postedBy', 'name');
      if (!food || food.postedBy._id.toString() === interactingUserId.toString()) return;
      
      const ownerData = this.users.get(food.postedBy._id.toString());
      if (ownerData && ownerData.preferences.realTimeUpdates) {
        const interactingUser = await User.findById(interactingUserId).select('name');
        
        this.io.to(ownerData.socketId).emit('food_interaction_notification', {
          foodId,
          foodTitle: food.title,
          interactionType,
          interactingUser: interactingUser.name,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error notifying food owner:', error);
    }
  }

  async notifyInterestedUsers(foodItem, eventType) {
    
    
    if (foodItem.location?.coordinates) {
      const [lng, lat] = foodItem.location.coordinates;
      this.broadcastToNearbyUsers([lng, lat], 5000, eventType, { food: foodItem });
    }
  }
  cleanupUserSession(socket) {
    const userId = socket.user._id.toString();
        
    this.users.delete(userId);
       
    this.mapViewers.delete(socket.id);
       
    this.updateUserStatus(socket.user._id, false);
        
    this.cleanupRoomSubscriptions(socket.id);
     
    const viewportKey = `viewport_${socket.id}`;
    if (this[viewportKey]) {
      clearTimeout(this[viewportKey]);
      delete this[viewportKey];
    }
  }

  cleanupRoomSubscriptions(socketId) {
    
    this.roomSubscriptions.forEach((subscribers, roomId) => {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.roomSubscriptions.delete(roomId);
      }
    });
    
    
    this.geographicRooms.forEach((subscribers, roomId) => {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.geographicRooms.delete(roomId);
      }
    });
  }

  async joinUserConversations(socket) {
    try {
      const conversations = await Conversation.find({
        participants: socket.user._id
      }).select('_id');

      conversations.forEach(conv => {
        socket.join(`conversation_${conv._id}`);
      });
    } catch (error) {
      console.error('Error joining user conversations:', error);
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content } = data;
      const userId = socket.user._id;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const otherParticipant = conversation.participants.find(
        id => id.toString() !== userId.toString()
      );

      const Message = require('../models/message').Message;
      const message = new Message({
        conversation: conversationId,
        sender: userId,
        recipient: otherParticipant,
        content: {
          text: content.text || '',
          type: content.type || 'text',
          imageUrl: content.imageUrl || null,
          location: content.location || null
        }
      });

      await message.save();

      conversation.lastMessage = message._id;
      conversation.lastActivity = new Date();
      
      const currentUnread = conversation.getUnreadCount(otherParticipant);
      await conversation.setUnreadCount(otherParticipant, currentUnread + 1);

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name email');

      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        message: populatedMessage,
        conversationId
      });

      const recipientSocketId = this.users.get(otherParticipant.toString())?.socketId;
      if (!recipientSocketId) {
        this.sendPushNotification(otherParticipant, {
          title: `New message from ${socket.user.name}`,
          body: content.text,
          conversationId
        });
      }

      this.updateUnreadCounts([userId, otherParticipant]);

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleTypingStart(socket, data) {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing_start', {
      userId: socket.user._id,
      userName: socket.user.name,
      conversationId
    });
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing_stop', {
      userId: socket.user._id,
      conversationId
    });
  }

  async handleMessageRead(socket, data) {
    try {
      const { messageId, conversationId } = data;
      
      const Message = require('../models/message').Message;
      await Message.findByIdAndUpdate(messageId, { 
        readAt: new Date() 
      });

      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        await conversation.setUnreadCount(socket.user._id, 0);
      }

      socket.to(`conversation_${conversationId}`).emit('message_read', {
        messageId,
        readBy: socket.user._id,
        readAt: new Date()
      });

      this.updateUnreadCounts([socket.user._id]);

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  async handleMessageDelivered(socket, data) {
    try {
      const { messageId } = data;
      
      const Message = require('../models/message').Message;
      await Message.findByIdAndUpdate(messageId, {
        'metadata.deliveredAt': new Date()
      });

      socket.to(`conversation_${data.conversationId}`).emit('message_delivered', {
        messageId,
        deliveredAt: new Date()
      });

    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  }

  updateUserStatus(userId, isOnline) {
    this.io.emit('user_status_change', {
      userId: userId.toString(),
      isOnline,
      lastSeen: isOnline ? null : new Date()
    });
  }

  async updateUnreadCounts(userIds) {
    for (const userId of userIds) {
      const userData = this.users.get(userId.toString());
      if (userData?.socketId) {
        try {
          const conversations = await Conversation.find({
            participants: userId,
            isActive: true
          });

          let totalUnread = 0;
          conversations.forEach(conversation => {
            totalUnread += conversation.getUnreadCount(userId);
          });

          this.io.to(userData.socketId).emit('unread_count_update', {
            totalUnread
          });
        } catch (error) {
          console.error('Error updating unread counts:', error);
        }
      }
    }
  }

  sendPushNotification(userId, notification) {
    console.log(`Push notification for user ${userId}:`, notification);
  }

  sendToUser(userId, event, data) {
    const userData = this.users.get(userId.toString());
    if (userData?.socketId) {
      this.io.to(userData.socketId).emit(event, data);
    }
  }

  sendToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  getOnlineUsers() {
    return Array.from(this.users.keys());
  }

  

  
  notifyNewFood(foodItem) {
    this.broadcastNewFood(foodItem);
  }

  
  notifyFoodUpdate(foodItem) {
    this.broadcastFoodUpdate(foodItem);
  }

  
  notifyFoodDeletion(foodId, location) {
    this.broadcastFoodDeletion(foodId, location);
  }

  
  getRealtimeStats() {
    return {
      connectedUsers: this.users.size,
      mapViewers: Array.from(this.users.values()).filter(user => user.viewingMap).length,
      activeGeographicRooms: this.geographicRooms.size,
      totalRoomSubscriptions: this.roomSubscriptions.size
    };
  }
}

module.exports = new SocketService();
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../css/Dashboard.module.css';
import messageStyles from '../css/Messages.module.css';
import axios from '../api/axios';
import useSocket from '../hooks/useSocket';

import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { LocationIcon } from '../components/ui/Icons';
import RestaurantSidebar from '../components/layout/RestaurantSidebar';

const userRole = localStorage.getItem("userRole");
const ConversationItem = ({ conversation, isActive, onClick, currentUserId }) => {
  const otherUser = conversation.otherParticipant;
  const foodListing = conversation.foodListing;
  
  const getUserInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = (now - date) / (1000 * 60);
      const diffInHours = diffInMinutes / 60;
      
      if (diffInMinutes < 1) return 'now';
      if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
      if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status = 'available') => {
    switch(status) {
      case 'available': return '#10b981';
      case 'reserved': return '#f59e0b';
      case 'completed': return '#6b7280';
      default: return '#10b981';
    }
  };

  const truncateMessage = (text, maxLength = 35) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const isUnread = conversation.unreadCount > 0;

  return (
    <div
      className={`${messageStyles.conversationItem} ${isActive ? messageStyles.active : ''}`}
      onClick={() => onClick(conversation)}
    >
      <div className={messageStyles.conversationContent}>
        <div className={messageStyles.avatarContainer}>
          <div className={messageStyles.avatar}>
            {getUserInitials(otherUser?.name)}
          </div>
        </div>
        
        <div className={messageStyles.conversationDetails}>
          <div className={messageStyles.conversationHeader}>
            <h4 className={`${messageStyles.userName} ${isUnread ? messageStyles.unread : ''}`}>
              {otherUser?.name || 'Unknown User'}
            </h4>
            <div className={messageStyles.timeAndBadge}>
              <span className={messageStyles.time}>
                {conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : ''}
              </span>
              {isUnread && (
                <span className={messageStyles.unreadBadge}>
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
          
          {foodListing && (
            <div className={messageStyles.foodInfo}>
              <div 
                className={messageStyles.statusDot} 
                style={{ backgroundColor: getStatusColor(foodListing.status) }}
              ></div>
              <span className={messageStyles.foodTitle}>{foodListing.title}</span>
            </div>
          )}
          
          <p className={`${messageStyles.lastMessage} ${isUnread ? messageStyles.unreadText : ''}`}>
            {conversation.lastMessage?.sender === currentUserId && 'You: '}
            {truncateMessage(conversation.lastMessage?.content?.text || 'New conversation')}
          </p>
        </div>
      </div>
    </div>
  );
};

const FoodContextCard = ({ foodListing, onQuickAction }) => {
  if (!foodListing) return null;

  const getStatusColor = (status = 'available') => {
    switch(status) {
      case 'available': return '#10b981';
      case 'reserved': return '#f59e0b';
      case 'completed': return '#6b7280';
      default: return '#10b981';
    }
  };

  return (
    <div className={messageStyles.foodContextCard}>
      <div className={messageStyles.foodImageContainer}>
        {foodListing.imageUrl ? (
          <img src={foodListing.imageUrl} alt={foodListing.title} className={messageStyles.foodImage} />
        ) : (
          <div className={messageStyles.foodPlaceholder}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px' }}>
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
        )}
      </div>
      
      <div className={messageStyles.foodDetails}>
        <div className={messageStyles.foodHeader}>
          <h4 className={messageStyles.foodName}>{foodListing.title}</h4>
          <div className={messageStyles.foodStatus}>
            <div 
              className={messageStyles.statusDot} 
              style={{ backgroundColor: getStatusColor(foodListing.status) }}
            ></div>
            <span>{foodListing.status || 'available'}</span>
          </div>
        </div>
        <p className={messageStyles.foodMeta}>
          {foodListing.quantity} servings • Available until {new Date(foodListing.pickupTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </p>
        
        {foodListing.status === 'available' && (
          <div className={messageStyles.quickActions}>
            <button 
              className={messageStyles.quickActionBtn}
              onClick={() => onQuickAction('reserve')}
            >
              Reserve
            </button>
            <button 
              className={messageStyles.quickActionBtn}
              onClick={() => onQuickAction('location')}
            >
              <LocationIcon style={{ width: '12px', height: '12px' }} />
              Location
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EnhancedMessageBubble = ({ message, isMe, showAvatar, otherUserName }) => {
  const getUserInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isLocationMessage = message.content?.type === 'location' || message.content?.text?.includes('Location Shared');

  return (
    <div className={`${messageStyles.messageRow} ${isMe ? messageStyles.messageMe : messageStyles.messageThem}`}>
      {!isMe && showAvatar && (
        <div className={messageStyles.messageAvatar}>
          {getUserInitials(otherUserName)}
        </div>
      )}
      
      <div className={messageStyles.messageBubbleContainer}>
        <div className={`${messageStyles.messageBubble} ${isMe ? messageStyles.myMessage : messageStyles.theirMessage}`}>
          {/*  Location message display */}
          {isLocationMessage && (
            <div className={messageStyles.locationMessage}>
              <div className={messageStyles.locationHeader}>
                <LocationIcon style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                <span style={{ fontSize: '11px', fontWeight: '500' }}>Location Shared</span>
              </div>
              
              {/* Large location icon */}
              <div className={messageStyles.locationIconLarge}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '48px', height: '48px', color: '#3b82f6' }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              
              <div className={messageStyles.locationText}>
                {message.content?.location?.address || 'Pickup location'}
              </div>
              
              {/* Action buttons */}
              <div className={messageStyles.locationActions}>

                {/* View Map */}
                <button
                  className={messageStyles.locationActionBtn}
                  style={{ background: '#3b82f6' }}
                  onClick={(e) => {
                    e.stopPropagation(); 

                    const coords =
                      message?.content?.location?.coordinates ||
                      message?.location?.coordinates ||
                      null;

                    if (!coords || coords.length !== 2) {
                      console.warn("No coordinates found in message:", message);
                      return;
                    }

                    const [lng, lat] = coords;
                    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
                  }}
                >
                  View Map
                </button>

                {/* Directions */}
                <button
                  className={messageStyles.locationActionBtn}
                  style={{ background: '#10b981' }}
                  onClick={(e) => {
                    e.stopPropagation(); 
                    const coords =
                      message?.content?.location?.coordinates ||
                      message?.location?.coordinates ||
                      null;

                    if (!coords || coords.length !== 2) {
                      console.warn("No coordinates found in message:", message);
                      return;
                    }

                    const [lng, lat] = coords;
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                      "_blank"
                    );
                  }}
                >
                  Directions
                </button>

              </div>


            </div>
          )}

          {/* Regular text message */}
          {!isLocationMessage && (
            <div className={messageStyles.messageText}>
              {message.content?.text}
            </div>
          )}
          
          <div className={messageStyles.messageTime}>
            {formatTime(message.createdAt)}
            {isMe && (
              <span className={messageStyles.messageStatus}>
                {message.readAt ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Typing Indicator
const TypingIndicator = ({ userName }) => (
  <div className={messageStyles.typingIndicator}>
    <div className={messageStyles.messageAvatar}>
      {userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
    </div>
    <div className={messageStyles.typingBubble}>
      <span>{userName} is typing</span>
      <div className={messageStyles.typingDots}>
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>
);

const EnhancedMessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  onAttach, 
  disabled,
  onQuickAction,
  onShareLocation
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={messageStyles.messageInputContainer}>
      {/* Quick Actions */}
      <div className={messageStyles.quickActionBar}>
        {['Still available?', 'Pickup time?', 'Ready for pickup!', 'Thank you! 🙏'].map(action => (
          <button 
            key={action}
            className={messageStyles.quickActionChip}
            onClick={() => {
              const actionMap = {
                'Still available?': 'still-available',
                'Pickup time?': 'pickup-time', 
                'Ready for pickup!': 'ready-pickup',
                'Thank you!': 'thank-you'
              };
              onQuickAction(actionMap[action]);
            }}
          >
            {action}
          </button>
        ))}
      </div>
      
      <div className={messageStyles.inputRow}>
        <button 
          className={messageStyles.attachBtn}
          onClick={onAttach}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={disabled}
          className={messageStyles.messageInput}
          rows={1}
        />
        
        <button 
          className={messageStyles.locationShareBtn}
          onClick={onShareLocation}
          title="Share Location"
        >
          <LocationIcon style={{ width: '16px', height: '16px' }} />
        </button>
        
        <button 
          className={`${messageStyles.sendBtn} ${value.trim() ? messageStyles.sendBtnActive : ''}`}
          onClick={onSend}
          disabled={disabled || !value.trim()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Main Messages Component
const Messages = () => {
  // Core state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());

  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('conversations');

  // Socket integration
  const { socket, isConnected, joinConversation, leaveConversation, sendMessage: socketSendMessage } = useSocket();

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
      
      if (width > 1024) {
        setSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auth setup
  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.id);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
    return token;
  }, []);

  // API functions
  const fetchConversations = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await axios.get('/messages/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [getAuthToken]);

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await axios.get(`/messages/conversations/${conversationId}/messages`);
      const fetchedMessages = response.data.messages || [];
      setMessages(fetchedMessages);
      
      markMessagesAsRead(conversationId);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [getAuthToken]);

  const markMessagesAsRead = useCallback(async (conversationId) => {
    try {
      await axios.patch(`/messages/conversations/${conversationId}/read`);
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/messages/unread-count');
      setUnreadCount(response.data.totalUnread || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, []);

  const handleQuickAction = useCallback(async (action) => {
    const quickMessages = {
      'still-available': 'Is this still available?',
      'pickup-time': 'What time would work best for pickup?',
      'ready-pickup': 'Ready for pickup!',
      'thank-you': 'Thank you! '
    };

    if (quickMessages[action]) {
      setNewMessage(quickMessages[action]);
      setTimeout(() => handleSendMessage(), 100);
    }
  }, []);

  // Location sharing handler
  const handleShareLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          const locationMessage = {
            text: 'Location Shared',
            type: 'location',
            location: {
              coordinates: [longitude, latitude],
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            }
          };
          
          if (socket && isConnected && selectedConversation) {
            socketSendMessage(selectedConversation._id, locationMessage);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Could not get your location. Please try again.');
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }, [socket, isConnected, selectedConversation, socketSendMessage]);

  const handleAttachment = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('Upload image:', file);
      }
    };
    input.click();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ message, conversationId }) => {
      if (selectedConversation && selectedConversation._id === conversationId) {
        setMessages(prev => {
          const filtered = prev.filter(msg => !msg._id.startsWith('temp-'));
          return [...filtered, message];
        });
        
        if (document.hasFocus() && !document.hidden) {
          markMessagesAsRead(conversationId);
        }
      }
      
      fetchConversations();
    };

    const handleTypingStart = ({ userId, conversationId }) => {
      if (selectedConversation && selectedConversation._id === conversationId) {
        setTypingUsers(prev => new Set([...prev, userId]));
      }
    };

    const handleTypingStop = ({ userId }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing_start', handleTypingStart);
    socket.on('user_typing_stop', handleTypingStop);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing_start', handleTypingStart);
      socket.off('user_typing_stop', handleTypingStop);
    };
  }, [socket, selectedConversation, markMessagesAsRead, fetchConversations]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchConversations(),
        fetchUnreadCount()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchUnreadCount]);

  // Conversation selection
  const handleConversationSelect = useCallback((conversation) => {
    if (selectedConversation) {
      leaveConversation(selectedConversation._id);
    }
    
    setSelectedConversation(conversation);
    setMessages([]);
    
    if (socket && isConnected) {
      joinConversation(conversation._id);
    }
    
    fetchMessages(conversation._id);
    
    if (isMobile) {
      setActiveView('chat');
    }
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, [selectedConversation, leaveConversation, socket, isConnected, joinConversation, fetchMessages, isMobile]);

  // Back to conversations
  const handleBackToConversations = useCallback(() => {
    if (selectedConversation) {
      leaveConversation(selectedConversation._id);
    }
    
    setActiveView('conversations');
    setSelectedConversation(null);
    setMessages([]);
  }, [selectedConversation, leaveConversation]);

  // Enhanced message sending
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSendingMessage(true);

    // Create optimistic message
    const tempMessage = {
      _id: 'temp-' + Date.now(),
      sender: { _id: currentUserId, name: 'You' },
      content: { text: messageText, type: 'text' },
      createdAt: new Date().toISOString(),
      isTemp: true
    };
    
    setMessages(prev => [...prev, tempMessage]);

    try {
      if (socket && isConnected) {
        socketSendMessage(selectedConversation._id, {
          text: messageText,
          type: 'text'
        });
      } else {
        throw new Error('Not connected');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
      setNewMessage(messageText);
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, selectedConversation, sendingMessage, currentUserId, socket, isConnected, socketSendMessage]);

  // Navigation
  const handleTabNavigation = useCallback((path) => {
    if (path === '/my-posts') {
      window.location.href = '/my-posts';
    } else if (path === '/individual-dashboard') {
      window.location.href = '/individual-dashboard';
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen]);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    
    const otherUser = conv.otherParticipant;
    const userName = otherUser?.name?.toLowerCase() || '';
    const foodTitle = conv.foodListing?.title?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    return userName.includes(query) || foodTitle.includes(query);
  });

  if (loading) {
    return <LoadingSpinner message="Loading messages..." />;
  }

  return (
    <div>
      {/* Header */}
      <Header 
        title="Messages"
        showBackButton={!isMobile}
        onBackClick={() => window.location.href = '/individual-dashboard'}
        showMobileMenuButton={isTablet}
        onMobileMenuClick={toggleSidebar}
        unreadCount={unreadCount}
        isMobile={isMobile}
      />

      {/* Sidebar Overlay for Tablet */}
      <div 
        className={`${styles.sidebarOverlay} ${sidebarOpen && isTablet ? styles.show : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main container */}
      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>

        {/* Sidebar for desktop */}
        {!isMobile && !isTablet && (
          <>
            {userRole === "organization" ? (
              <RestaurantSidebar
                isMobile={false}
                isOpen={false}
                onClose={() => setSidebarOpen(false)}
                stats={{
                  totalConversations: conversations.length,
                  unreadMessages: unreadCount,
                  activeChats: conversations.filter(c => c.lastMessage).length
                }}
                statsTitle="Messages"
                currentPage="messages"
                unreadCount={unreadCount}
              />
            ) : (
              <Sidebar
                isMobile={false}
                isOpen={false}
                onClose={() => setSidebarOpen(false)}
                stats={{
                  totalConversations: conversations.length,
                  unreadMessages: unreadCount,
                  activeChats: conversations.filter(c => c.lastMessage).length
                }}
                statsTitle="Messages"
                currentPage="messages"
                unreadCount={unreadCount}
              />
            )}
          </>
        )}

        {/* Sidebar for tablet */}
        {isTablet && (
          <>
            {userRole === "organization" ? (
              <RestaurantSidebar
                isMobile={true}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                stats={{
                  totalConversations: conversations.length,
                  unreadMessages: unreadCount,
                  activeChats: conversations.filter(c => c.lastMessage).length
                }}
                statsTitle="Messages"
                currentPage="messages"
                unreadCount={unreadCount}
              />
            ) : (
              <Sidebar
                isMobile={true}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                stats={{
                  totalConversations: conversations.length,
                  unreadMessages: unreadCount,
                  activeChats: conversations.filter(c => c.lastMessage).length
                }}
                statsTitle="Messages"
                currentPage="messages"
                unreadCount={unreadCount}
              />
            )}
          </>
        )}

        {/* Main Content */}
        <main className={styles.mainContent}>
          <div className={messageStyles.messagesContainer}>
            
            {/* Conversations List */}
            <div className={`${messageStyles.conversationsPanel} ${activeView === 'chat' && isMobile ? messageStyles.hidden : ''}`}>
              {/* Header */}
              <div className={messageStyles.panelHeader}>
                <div className={messageStyles.headerTop}>
                  <h3 className={messageStyles.panelTitle}>Messages</h3>
                  <span className={messageStyles.countBadge}>{filteredConversations.length}</span>
                </div>
                
                {/* Search */}
                <div className={messageStyles.searchContainer}>
                  <svg className={messageStyles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    type="text" 
                    className={messageStyles.searchInput}
                    placeholder="Search conversations..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Conversations */}
              <div className={messageStyles.conversationsList}>
                {filteredConversations.length === 0 ? (
                  <div className={messageStyles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '48px', height: '48px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h4>{searchQuery ? 'No matches' : 'No conversations'}</h4>
                    <p>{searchQuery ? 'Try different keywords' : 'Start messaging about food'}</p>
                  </div>
                ) : (
                  filteredConversations.map(conversation => (
                    <ConversationItem
                      key={conversation._id}
                      conversation={conversation}
                      isActive={selectedConversation?._id === conversation._id}
                      onClick={handleConversationSelect}
                      currentUserId={currentUserId}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`${messageStyles.chatPanel} ${activeView === 'conversations' && isMobile ? messageStyles.hidden : ''}`}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className={messageStyles.chatHeader}>
                    {isMobile && (
                      <button 
                        className={messageStyles.backBtn}
                        onClick={handleBackToConversations}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    
                    <div className={messageStyles.chatUserInfo}>
                      <div className={messageStyles.chatAvatar}>
                        {selectedConversation.otherParticipant?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                      </div>
                      
                      <div className={messageStyles.chatUserDetails}>
                        <h4 className={messageStyles.chatUserName}>
                          {selectedConversation.otherParticipant?.name || 'Unknown User'}
                        </h4>
                        <p className={messageStyles.chatUserStatus}>
                          {typingUsers.size > 0 ? 'typing...' : 'online'}
                        </p>
                      </div>
                    </div>
                    
                    <button className={messageStyles.infoBtn}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9,9h6v6H9z"/>
                        <path d="M9,9h6v6H9z" opacity="0.5"/>
                      </svg>
                    </button>
                  </div>

                  {/* Food Context Card */}
                  {selectedConversation.foodListing && (
                    <FoodContextCard
                      foodListing={selectedConversation.foodListing}
                      onQuickAction={handleQuickAction}
                    />
                  )}

                  {/* Messages Area */}
                  <div className={messageStyles.messagesArea}>
                    {messages.length === 0 ? (
                      <div className={messageStyles.emptyChat}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '64px', height: '64px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <h3>Start the conversation</h3>
                        <p>Send your first message about the food</p>
                      </div>
                    ) : (
                      <div className={messageStyles.messagesList}>
                        {messages.map((message, index) => {
                          const isMe = message.sender._id === currentUserId || message.sender === currentUserId;
                          const prevMessage = messages[index - 1];
                          const showAvatar = !prevMessage || prevMessage.sender._id !== message.sender._id;
                          
                          return (
                            <EnhancedMessageBubble
                              key={message._id}
                              message={message}
                              isMe={isMe}
                              showAvatar={showAvatar}
                              otherUserName={selectedConversation.otherParticipant?.name}
                            />
                          );
                        })}
                        
                        {/* Typing indicator */}
                        {typingUsers.size > 0 && (
                          <TypingIndicator userName={selectedConversation.otherParticipant?.name} />
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <EnhancedMessageInput
                    ref={inputRef}
                    value={newMessage}
                    onChange={setNewMessage}
                    onSend={handleSendMessage}
                    onAttach={handleAttachment}
                    disabled={sendingMessage}
                    onQuickAction={handleQuickAction}
                    onShareLocation={handleShareLocation}
                  />
                </>
              ) : (
                <div className={messageStyles.noConversationSelected}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '64px', height: '64px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h2>Select a conversation</h2>
                  <p>Choose a food conversation to start messaging</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          currentPage="messages"
          unreadCount={unreadCount}
          onTabNavigation={handleTabNavigation}
        />
      )}
    </div>
  );
};

export default Messages;
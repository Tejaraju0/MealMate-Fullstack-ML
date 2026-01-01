import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import styles from '../../css/Dashboard.module.css';
import { LocationIcon } from './Icons';

const LocationSharingModal = ({ 
  isOpen, 
  onClose, 
  onShareLocation,
  foodItem 
}) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [customAddress, setCustomAddress] = useState('');
  const [shareType, setShareType] = useState('current'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && shareType === 'current' && !currentLocation) {
      getCurrentLocation();
    }
  }, [isOpen, shareType, currentLocation]);

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Could not get your current location. Please enter address manually.');
        setShareType('custom');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  };

  const handleShareLocation = async () => {
    let locationData = null;

    if (shareType === 'current' && currentLocation) {
      locationData = {
        type: 'current',
        coordinates: [currentLocation.lng, currentLocation.lat],
        address: `📍 Live Location (${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)})`,
        timestamp: new Date().toISOString()
      };
    } else if (shareType === 'custom' && customAddress.trim()) {
      locationData = {
        type: 'address',
        address: customAddress.trim(),
        timestamp: new Date().toISOString()
      };
    }

    if (locationData && onShareLocation) {
      await onShareLocation(locationData);
      onClose();
    }
  };

  const getGoogleMapsUrl = () => {
    if (currentLocation) {
      return `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;
    }
    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Pickup Location"
      size="medium"
      actions={
        <>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleShareLocation}
            disabled={
              loading || 
              (shareType === 'current' && !currentLocation) ||
              (shareType === 'custom' && !customAddress.trim())
            }
          >
            {loading ? 'Getting Location...' : 'Share Location'}
          </button>
        </>
      }
    >
      <div>
        {foodItem && (
          <div className={styles.foodSummary} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.foodSummaryImage}>
              {foodItem.imageUrl ? (
                <img src={foodItem.imageUrl} alt={foodItem.title} />
              ) : (
                '🍽️'
              )}
            </div>
            <div className={styles.foodSummaryDetails}>
              <h4>Sharing location for: {foodItem.title}</h4>
              <p>This will help coordinate the pickup with precision</p>
            </div>
          </div>
        )}

        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Location Type</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setShareType('current')}
              style={{
                flex: '1',
                padding: '0.75rem',
                border: shareType === 'current' ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                borderRadius: '0.375rem',
                background: shareType === 'current' ? 'rgba(59, 130, 246, 0.1)' : 'var(--black)',
                color: 'var(--gray-700)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>📍 Current Location</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Share live GPS location</div>
            </button>
            <button
              type="button"
              onClick={() => setShareType('custom')}
              style={{
                flex: '1',
                padding: '0.75rem',
                border: shareType === 'custom' ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                borderRadius: '0.375rem',
                background: shareType === 'custom' ? 'rgba(59, 130, 246, 0.1)' : 'var(--black)',
                color: 'var(--gray-700)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>🏠 Custom Address</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Enter specific address</div>
            </button>
          </div>
        </div>

        {shareType === 'current' && (
          <div>
            {loading && (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: 'var(--gray-600)' 
              }}>
                <div className={styles.spinner} style={{ margin: '0 auto 1rem' }}></div>
                <p>Getting your current location...</p>
              </div>
            )}
            
            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                color: '#dc2626'
              }}>
                ⚠️ {error}
              </div>
            )}
            
            {currentLocation && !loading && (
              <div style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <LocationIcon style={{ width: '1rem', height: '1rem' }} />
                  <strong>Your Current Location</strong>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                  Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                  This precise location will help them find you easily
                </p>
                <a 
                  href={getGoogleMapsUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                >
                  📱 View on Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {shareType === 'custom' && (
          <div className={styles.formGroup}>
            <label htmlFor="customAddress" className={styles.formLabel}>
              Pickup Address *
            </label>
            <textarea
              id="customAddress"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className={`${styles.formInput} ${styles.formTextarea}`}
              rows="3"
              placeholder="Enter the exact pickup address, including building name, floor, or any specific instructions..."
              required
            />
            <small className={styles.fieldHint}>
              Be as specific as possible to help them find the location easily
            </small>
          </div>
        )}

        {/* Privacy Note */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginTop: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>🔒</span>
            <strong style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Privacy & Security</strong>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
            Your location will only be shared with this specific person for this food pickup. 
            The location data is not stored permanently and is only used for coordination purposes.
          </p>
        </div>
      </div>
    </Modal>
  );
};

const EnhancedMessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  onAttach, 
  disabled,
  onQuickAction,
  onShareLocation, 
  foodItem 
}) => {
  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleShareLocation = async (locationData) => {
    if (onShareLocation) {
      await onShareLocation(locationData);
    }
    setShowLocationModal(false);
  };

  return (
    <>
      <div className={styles.messageInputContainer}>
        <div className={styles.quickActionBar}>
          {[
            'Still available?', 
            'Pickup time?', 
            'Ready for pickup!',
            'Thank you! 🙏'
          ].map(action => (
            <button 
              key={action}
              className={styles.quickActionChip}
              onClick={() => onQuickAction(action.toLowerCase().replace(/[^a-z]/g, '-'))}
            >
              {action}
            </button>
          ))}
          <button 
            className={styles.quickActionChip}
            onClick={() => setShowLocationModal(true)}
            style={{ 
              background: 'var(--primary)', 
              color: 'white',
              fontWeight: '600'
            }}
          >
            📍 Share Location
          </button>
        </div>
        
        <div className={styles.inputRow}>
          <button 
            className={styles.attachBtn}
            onClick={onAttach}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={disabled}
            className={styles.messageInput}
            rows={1}
          />
          
          <button 
            className={`${styles.sendBtn} ${value.trim() ? styles.sendBtnActive : ''}`}
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      <LocationSharingModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onShareLocation={handleShareLocation}
        foodItem={foodItem}
      />
    </>
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

  const isLocationMessage = message.content?.type === 'location' || 
                          message.content?.text?.includes('📍') ||
                          message.content?.location;

  const getGoogleMapsUrl = (coordinates) => {
    if (coordinates && coordinates.length === 2) {
      const [lng, lat] = coordinates;
      return `https://www.google.com/maps?q=${lat},${lng}&z=15`;
    }
    return null;
  };

  const getDirectionsUrl = (coordinates) => {
    if (coordinates && coordinates.length === 2) {
      const [lng, lat] = coordinates;
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return null;
  };

  return (
    <div className={`messageRow ${isMe ? 'messageMe' : 'messageThem'}`}>
      {!isMe && showAvatar && (
        <div className="messageAvatar">
          {getUserInitials(otherUserName)}
        </div>
      )}
      
      <div className="messageBubbleContainer">
        <div className={`messageBubble ${isMe ? 'myMessage' : 'theirMessage'}`}>
          {isLocationMessage && (
            <div className="locationHeader">
              <LocationIcon style={{ width: '12px', height: '12px' }} />
              <span>📍 Location Shared</span>
            </div>
          )}
          
          <div className="messageText">
            {message.content?.text}
          </div>

          {/* Enhanced location display */}
          {message.content?.location && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: isMe ? 'rgba(255,255,255,0.1)' : 'var(--gray-50)',
              borderRadius: '0.375rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                📍 {message.content.location.type === 'current' ? 'Live Location' : 'Pickup Address'}
              </div>
              
              {message.content.location.coordinates && (
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                  <a 
                    href={getGoogleMapsUrl(message.content.location.coordinates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: '1',
                      padding: '0.25rem 0.5rem',
                      background: 'var(--primary)',
                      color: 'white',
                      borderRadius: '0.25rem',
                      textDecoration: 'none',
                      fontSize: '0.65rem',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}
                  >
                    🗺️ View Map
                  </a>
                  <a 
                    href={getDirectionsUrl(message.content.location.coordinates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: '1',
                      padding: '0.25rem 0.5rem',
                      background: 'var(--success)',
                      color: 'white',
                      borderRadius: '0.25rem',
                      textDecoration: 'none',
                      fontSize: '0.65rem',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}
                  >
                    🧭 Directions
                  </a>
                </div>
              )}
              
              <div style={{ fontSize: '0.6rem', color: 'var(--gray-600)' }}>
                📍 {message.content.location.address}
              </div>
            </div>
          )}
          
          <div className="messageTime">
            {formatTime(message.createdAt)}
            {isMe && (
              <span className="messageStatus">
                {message.readAt ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { LocationSharingModal, EnhancedMessageInput, EnhancedMessageBubble };
export default LocationSharingModal;
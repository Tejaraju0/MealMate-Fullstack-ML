import React, { useState } from 'react';
import styles from '../../css/MyPosts.module.css';
import dashboardStyles from '../../css/Dashboard.module.css';

const DetailModal = ({
  isOpen,
  onClose,
  post,
  type = 'discover', 
  onReserve = null,
  onMessage = null,
  onStatusUpdate = null,
  onEdit = null,
  onDelete = null,
  onViewMessages = null
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!isOpen || !post) return null;
  const images = post.images && post.images.length > 0 
    ? post.images 
    : post.imageUrl 
    ? [post.imageUrl] 
    : [];
  const isHotDeal = post.isHotDeal || post.hotDealScore > 0;

  const getCategoryEmoji = (category) => {
    const emojiMap = {
      meal: '🍽️',
      snack: '🍪',
      bakery: '🍞',
      fruits: '🍎',
      other: '🥘'
    };
    return emojiMap[category] || '🍽️';
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not specified';
    try {
      return new Date(timeString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timeString;
    }
  };

  const calculateDistance = () => {
    return `${(Math.random() * 2 + 0.1).toFixed(1)} km`;
  };

  const getStatusColor = (status) => {
    const colors = {
      available: '#10b981',
      reserved: '#f59e0b',
      collected: '#6b7280',
      expired: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const renderActions = () => {
    if (type === 'discover') {
      return (
        <div className={styles.modalActionsCompact}>
          <button 
            className={`${dashboardStyles.btn} ${dashboardStyles.btnPrimary} ${styles.compactBtn}`}
            onClick={() => {
              if (post.status === 'available' && onReserve) {
                onReserve(post, isHotDeal);
                onClose();
              } else {
                alert('This food is no longer available for reservation.');
              }
            }}
            disabled={post.status !== 'available'}
            style={isHotDeal ? { background: 'var(--warning)' } : {}}
          >
            {post.status === 'available' 
              ? (isHotDeal ? ' Grab This Deal!' : 'Reserve Now')
              : 'Not Available'
            }
          </button>
          
          {onMessage && (
            <button 
              className={`${dashboardStyles.btn} ${dashboardStyles.btnSecondary} ${styles.compactBtn}`}
              onClick={() => {
                onMessage(post);
                onClose();
              }}
            >
              💬 Message
            </button>
          )}
        </div>
      );
    }
    return (
      <div className={styles.modalActionsCompact}>
        {post.status === 'available' && onStatusUpdate && (
          <button 
            className={`${dashboardStyles.btn} ${dashboardStyles.btnPrimary} ${styles.compactBtn}`}
            onClick={() => {
              onStatusUpdate(post._id, 'collected');
              onClose();
            }}
          >
            ✓ Mark Collected
          </button>
        )}
        
        {onViewMessages && (
          <button 
            className={`${dashboardStyles.btn} ${dashboardStyles.btnSecondary} ${styles.compactBtn}`}
            onClick={() => {
              onViewMessages(post._id);
              onClose();
            }}
          >
            💬 Messages
          </button>
        )}
        
        {onEdit && (
          <button 
            className={`${dashboardStyles.btn} ${dashboardStyles.btnSecondary} ${styles.compactBtn}`}
            onClick={() => {
              onEdit(post._id);
              onClose();
            }}
          >
            ✏️ Edit
          </button>
        )}
        
        {onDelete && (
          <button 
            className={`${dashboardStyles.btn} ${styles.dangerBtn} ${styles.compactBtn}`}
            onClick={() => {
              onDelete(post._id, post.title);
              onClose();
            }}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{post.title}</h2>
          <button 
            className={styles.modalClose}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className={styles.modalContent}>
          <div className={styles.modalImageCompact} style={{ position: 'relative' }}>
            {images.length > 0 ? (
              <>
                <img 
                  src={images[currentImageIndex]} 
                  alt={`${post.title} - Image ${currentImageIndex + 1}`} 
                />
                
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '35px',
                        height: '35px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={handleNextImage}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '35px',
                        height: '35px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                      }}
                    >
                      ›
                    </button>
                    
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      gap: '6px',
                      zIndex: 2
                    }}>
                      {images.map((_, index) => (
                        <div
                          key={index}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: index === currentImageIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(index);
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {isHotDeal && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    color: 'white',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '15px',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                  }}>
                    🔥 HOT DEAL
                  </div>
                )}
              </>
            ) : (
              <div className={styles.modalPlaceholder}>
                {getCategoryEmoji(post.category)}
              </div>
            )}
          </div>
          
          <div className={styles.modalDetailsCompact}>
            {isHotDeal && post.originalPrice && type === 'discover' && (
              <div style={{
                padding: '0.85rem',
                background: 'rgba(251, 146, 60, 0.1)',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: '2px solid rgba(251, 146, 60, 0.3)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textDecoration: 'line-through' }}>
                      Regular: £{post.originalPrice.toFixed(2)}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 'bold', color: '#fb923c' }}>
                      Deal: £{post.price.toFixed(2)}
                    </p>
                  </div>
                  <div style={{
                    background: '#10b981',
                    color: 'white',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.7rem' }}>SAVE</div>
                    <div>£{(post.originalPrice - post.price).toFixed(2)}</div>
                  </div>
                </div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  🏪 {((post.originalPrice - post.price) / post.originalPrice * 100).toFixed(0)}% off - Available at restaurant!
                </p>
              </div>
            )}

            <div className={styles.detailsRow}>
              {type === 'mypost' ? (
                <>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Status</span>
                    <span 
                      className={styles.detailValue}
                      style={{ color: getStatusColor(post.status), fontWeight: '600' }}
                    >
                      {post.status.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Category</span>
                    <span className={styles.detailValue}>
                      {getCategoryEmoji(post.category)} {post.category}
                    </span>
                  </div>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Servings</span>
                    <span className={styles.detailValue}>{post.quantity}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Posted By</span>
                    <span className={styles.detailValue}>
                      {post.postedBy?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Category</span>
                    <span className={styles.detailValue}>
                      {getCategoryEmoji(post.category)} {post.category}
                    </span>
                  </div>
                  <div className={styles.detailGroup}>
                    <span className={styles.detailLabel}>Servings</span>
                    <span className={styles.detailValue}>{post.quantity}</span>
                  </div>
                </>
              )}
            </div>
            
            <div className={styles.detailsRow}>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>{type === 'mypost' ? 'Created' : 'Posted'}</span>
                <span className={styles.detailValue}>{formatDate(post.createdAt)}</span>
              </div>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Available Until</span>
                <span className={styles.detailValue}>{formatTime(post.pickupTime)}</span>
              </div>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>{type === 'mypost' ? 'Views' : 'Distance'}</span>
                <span className={styles.detailValue}>
                  {type === 'mypost' ? (post.views || 0) : calculateDistance()}
                </span>
              </div>
            </div>
            
            <div className={styles.detailGroup}>
              <span className={styles.detailLabel}>Location</span>
              <span className={styles.detailValue}>
                📍 {post.location?.address || (type === 'mypost' ? 'Not specified' : 'Location provided after confirmation')}
              </span>
            </div>
            
            {post.description && (
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Description</span>
                <p className={styles.detailDescription}>{post.description}</p>
              </div>
            )}
            
            {post.ingredients && post.ingredients.length > 0 && (
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Ingredients</span>
                <div className={styles.ingredientsCompact}>
                  {post.ingredients.map((ingredient, index) => (
                    <span key={index} className={styles.ingredientTagCompact}>
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {renderActions()}
      </div>
    </div>
  );
};

export default DetailModal;
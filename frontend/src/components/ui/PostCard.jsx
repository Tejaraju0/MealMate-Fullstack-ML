import React from 'react';
import dashboardStyles from '../../css/Dashboard.module.css';
import myPostsStyles from '../../css/MyPosts.module.css';
import StatusBadge from './StatusBadge';
import { 
  MealIcon, 
  SnackIcon, 
  BakeryIcon, 
  FruitIcon, 
  OtherFoodIcon,
  LocationIcon,
  QuantityIcon,
  ViewsIcon,
  MessagesIcon
} from './Icons';

const PostCard = ({ 
  item, 
  type = 'discover', 
  isHotDeal = false,
  onClick = null,
  onReserve = null,
  onMessage = null,
  onStatusUpdate = null,
  onDelete = null,
  onViewMessages = null,
  isDeleting = false,
  deletingPostId = null
}) => {

  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  if (!item) {
    console.error('PostCard: item is undefined');
    return null;
  }

  const styles = type === 'mypost' ? myPostsStyles : dashboardStyles;
  
  const images = item?.images && Array.isArray(item.images) && item.images.length > 0 
    ? item.images 
    : item?.imageUrl 
    ? [item.imageUrl] 
    : [];


  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };
  
  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };
  
  const calculateDistance = () => {
    return `${(Math.random() * 2 + 0.1).toFixed(1)} km`;
  };

  const getCategoryIcon = (category) => {
    const iconProps = { className: styles.categoryIcon || 'category-icon' };
    switch(category) {
      case 'meal':
        return <MealIcon {...iconProps} />;
      case 'snack':
        return <SnackIcon {...iconProps} />;
      case 'bakery':
        return <BakeryIcon {...iconProps} />;
      case 'fruits':
        return <FruitIcon {...iconProps} />;
      default:
        return <OtherFoodIcon {...iconProps} />;
    }
  };

  const getTimeAgo = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
      return `${Math.floor(diffInHours / 168)}w ago`;
    } catch {
      return 'Unknown';
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(item);
    }
  };

  const handleReserveClick = (e) => {
    e.stopPropagation();
    
    if (item.status === 'available' && onReserve) {
      if (isHotDeal || item.isHotDeal) {
        onReserve(item, true); 
      } else {
        onReserve(item, false);
      }
    }
  };

  const handleMessageClick = (e) => {
    e.stopPropagation();
    if (onMessage) {
      onMessage(item);
    }
  };

  if (type === 'mypost') {
    return (
      <div 
        className={styles.postCard}
        onClick={handleCardClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className={styles.cardImage}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} />
          ) : (
            <div className={styles.imagePlaceholder}>
              {getCategoryIcon(item.category)}
            </div>
          )}
          <StatusBadge status={item.status} />
          {onClick && (
            <div className={styles.viewDetailsHint}>Click to view details</div>
          )}
        </div>
        
        <div className={styles.cardContent}>
          <div className={styles.cardHeader}>
            <h3 className={styles.postTitle}>{item.title}</h3>
            <span className={styles.timeAgo}>{getTimeAgo(item.createdAt)}</span>
          </div>
          
          <div className={styles.postMeta}>
            <span>
              {getCategoryIcon(item.category)}
              {item.category}
            </span>
            <span>
              <QuantityIcon className={styles.metaIcon} />
              {item.quantity} servings
            </span>
            <span>
              <ViewsIcon className={styles.metaIcon} />
              {item.views || 0} views
            </span>
          </div>

          {item.description && (
            <p className={styles.postDescription}>
              {item.description}
            </p>
          )}

          <div className={styles.postLocation}>
            <LocationIcon className={styles.locationIcon} />
            {item.location?.address || 'Location not specified'}
          </div>
          
          <div className={styles.cardActions}>
            <button
              className={`${styles.actionBtn} ${styles.messagesBtn || ''}`}
              onClick={(e) => { e.stopPropagation(); onViewMessages && onViewMessages(item); }}
              disabled={isDeleting}
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              Messages
            </button>
            {item.status === 'available' && (
              <button
                className={`${styles.actionBtn} ${styles.completeBtn || ''}`}
                onClick={(e) => { e.stopPropagation(); onStatusUpdate && onStatusUpdate(item.id, 'collected'); }}
                disabled={isDeleting}
                style={{ background: 'var(--success)', color: 'white' }}
              >
                Complete
              </button>
            )}
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn || ''}`}
              onClick={(e) => { e.stopPropagation(); onDelete && onDelete(item.id, item.title); }}
              disabled={isDeleting}
              style={{ background: 'var(--danger)', color: 'white' }}
            >
              {isDeleting && deletingPostId === item.id ? '...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${dashboardStyles.foodCard}${isHotDeal ? ` ${dashboardStyles.hotDeal}` : ''}`}
      onClick={handleCardClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={dashboardStyles.foodImage} style={isHotDeal ? { background: 'linear-gradient(135deg, var(--warning), #f97316)' } : {}}>
        {images.length > 0 ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img 
              src={images[currentImageIndex]} 
              alt={`${item.title} - Image ${currentImageIndex + 1}`} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className={dashboardStyles.imageNavBtn}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0, 0, 0, 0.5)',
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
                  className={dashboardStyles.imageNavBtn}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0, 0, 0, 0.5)',
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
                        cursor: 'pointer'
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
          </div>
        ) : (
          <div className={dashboardStyles.imagePlaceholder}>
            {getCategoryIcon(item.category)}
          </div>
        )}
        
        <div className={dashboardStyles.distanceBadge}>
          {isHotDeal ? '🔥 HOT DEAL' : calculateDistance()}
        </div>
        
        {item.status !== 'available' && (
          <div className={dashboardStyles.statusOverlay}>
            {item.status === 'reserved' ? 'Reserved' : 'Not Available'}
          </div>
        )}
        
        {onClick && (
          <div className={dashboardStyles.viewDetailsHint}>
            Click to view details
          </div>
        )}
      </div>
      
      <div className={dashboardStyles.foodDetails}>
        <div className={dashboardStyles.cardHeader}>
          <h3 className={dashboardStyles.foodTitle}>{item.title}</h3>
          <span className={dashboardStyles.timeAgo}>{getTimeAgo(item.createdAt)}</span>
        </div>
        
        <p className={dashboardStyles.foodProvider}>
          By {item.postedBy?.name || 'Unknown'}
        </p>
        
        <div className={dashboardStyles.foodMeta}>
          <span>
            {getCategoryIcon(item.category)}
            {item.category}
          </span>
          <span>
            <QuantityIcon className={dashboardStyles.metaIcon} />
            {item.quantity} servings
          </span>
          <span>
            <ViewsIcon className={dashboardStyles.metaIcon} />
            {item.views || 0} views
          </span>
        </div>

        {item.description && (
          <p className={dashboardStyles.postDescription}>
            {item.description.length > 60 
              ? `${item.description.substring(0, 60)}...` 
              : item.description
            }
          </p>
        )}

        <div className={dashboardStyles.postLocation}>
          <LocationIcon className={dashboardStyles.locationIcon} />
          {item.location?.address || 'Location not specified'}
        </div>

        {(isHotDeal || item.isHotDeal) && item.originalPrice && (
          <div className={dashboardStyles.priceComparison} style={{
            padding: '12px',
            background: 'rgba(251, 146, 60, 0.1)',
            borderRadius: '8px',
            marginTop: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                  Original: £{item.originalPrice.toFixed(2)}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: 'var(--warning)' }}>
                  Deal: £{item.price.toFixed(2)}
                </p>
              </div>
              <div style={{
                background: 'var(--success)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                Save £{(item.originalPrice - item.price).toFixed(2)}
              </div>
            </div>
            <p style={{ 
              margin: '8px 0 0 0', 
              fontSize: '13px', 
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
               Grab at the restaurant!
            </p>
          </div>
        )}

        
        <div className={dashboardStyles.foodActions}>
          <button 
            className={`${dashboardStyles.btn} ${dashboardStyles.btnPrimary}`}
            onClick={handleReserveClick}
            disabled={item.status !== 'available'}
            style={isHotDeal ? { background: 'var(--warning)' } : {}}
          >
            {item.status === 'available' 
              ? (isHotDeal ? 'Grab Now!' : 'Reserve')
              : 'Not Available'
            }
          </button>
          {onMessage && (
            <button 
              className={`${dashboardStyles.btn} ${dashboardStyles.btnSecondary}`}
              onClick={handleMessageClick}
            >
              <MessagesIcon className={dashboardStyles.buttonIcon} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
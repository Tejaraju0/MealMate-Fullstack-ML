import React, { useState, useEffect, useCallback } from 'react';
import styles from '../css/Dashboard.module.css';
import reservationStyles from '../css/Reservations.module.css';
import axios from '../api/axios';
import useSocket from '../hooks/useSocket';

import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import FilterBar from '../components/ui/FilterBar';
import Modal from '../components/ui/Modal';
import { MessagesIcon, ReservationsIcon } from '../components/ui/Icons';

const Reservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'sent', 'received'
  
  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Socket integration
  const { socket, isConnected } = useSocket();

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

  // Get auth token
  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  };

  // Get current user ID from token
  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch {
      return null;
    }
  };

  // Fetch reservations
  const fetchReservations = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get('/reservations');
      const fetchedReservations = response.data.reservations || [];
      
      const currentUserId = getCurrentUserId();
      const enrichedReservations = fetchedReservations.map(reservation => ({
        ...reservation,
        isRequester: reservation.requester._id === currentUserId,
        otherUser: reservation.requester._id === currentUserId 
          ? reservation.provider 
          : reservation.requester
      }));

      setReservations(enrichedReservations);
      setError(null);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setError('Failed to load reservations');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/messages/unread-count');
      setUnreadCount(response.data.totalUnread || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, []);

  const updateReservationStatus = async (reservationId, status) => {
    setUpdating(true);
    try {
      const response = await axios.patch(`/reservations/${reservationId}/status`, { 
        status 
      });
      
      if (response.data.reservation) {
        // Show main success message
        showToast('success', 'Status Updated', response.data.message);
        
        if (response.data.paymentAction === 'refunded') {
          showToast('info', 'Refund Processed', 'Refund will appear in your account within 3-5 business days.');
        } else if (response.data.paymentAction === 'released') {
          showToast('success', 'Payment Released', 'Payment has been released to the provider.');
        }
        fetchReservations();
      }

    } catch (error) {
      console.error('Error updating reservation:', error);
      showToast('error', 'Update Failed', error.response?.data?.message || 'Failed to update reservation status');
    } finally {
      setUpdating(false);
    }
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReservationUpdate = ({ reservation }) => {
      const currentUserId = getCurrentUserId();
      setReservations(prev => {
        const updated = prev.map(res => 
          res._id === reservation._id ? {
            ...reservation,
            isRequester: reservation.requester._id === currentUserId,
            otherUser: reservation.requester._id === currentUserId 
              ? reservation.provider 
              : reservation.requester
          } : res
        );
        return updated;
      });
      
      showToast('info', 'Reservation Updated', 'A reservation status has been updated');
    };

    socket.on('reservation_updated', handleReservationUpdate);

    return () => {
      socket.off('reservation_updated', handleReservationUpdate);
    };
  }, [socket, isConnected]);

  // Load data on mount
  useEffect(() => {
    fetchReservations();
    fetchUnreadCount();
  }, [fetchReservations, fetchUnreadCount]);

  // Format time functions
  const formatTimeAgo = (dateString) => {
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

  const formatPickupTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Not specified';
    }
  };

  // Filter reservations
  const getFilteredReservations = () => {
    let filtered = reservations;

    // Tab filter
    if (selectedTab === 'sent') {
      filtered = filtered.filter(res => res.isRequester);
    } else if (selectedTab === 'received') {
      filtered = filtered.filter(res => !res.isRequester);
    }

    // Status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(res => res.status === selectedFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(res =>
        res.foodListing?.title?.toLowerCase().includes(query) ||
        res.otherUser?.name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const getFilterOptions = () => {
    const filtered = selectedTab === 'all' ? reservations :
                    selectedTab === 'sent' ? reservations.filter(res => res.isRequester) :
                    reservations.filter(res => !res.isRequester);

    const statusCounts = filtered.reduce((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {});

    return [
      { key: 'all', label: 'All', count: filtered.length },
      { key: 'pending', label: 'Pending', count: statusCounts.pending || 0 },
      { key: 'accepted', label: 'Accepted', count: statusCounts.accepted || 0 },
      { key: 'completed', label: 'Completed', count: statusCounts.completed || 0 },
      { key: 'rejected', label: 'Declined', count: statusCounts.rejected || 0 },
      { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled || 0 }
    ];
  };

  const getStatusBadge = (reservation) => {
    const statusConfig = {
      'pending': { color: '#f59e0b', icon: '⏳', label: 'Pending' },
      'paid_pending': { color: '#3b82f6', icon: '💳', label: 'Payment Held' },
      'accepted': { color: '#10b981', icon: '✅', label: 'Accepted' },
      'paid_accepted': { color: '#10b981', icon: '✅💳', label: 'Accepted (Paid)' },
      'rejected': { color: '#ef4444', icon: '❌', label: 'Declined' },
      'paid_rejected': { color: '#ef4444', icon: '❌💰', label: 'Declined (Refunded)' },
      'cancelled': { color: '#6b7280', icon: '⚫', label: 'Cancelled' },
      'paid_cancelled': { color: '#6b7280', icon: '⚫💰', label: 'Cancelled (Refunded)' },
      'completed': { color: '#8b5cf6', icon: '🎉', label: 'Completed' }
    };

    const config = statusConfig[reservation.status] || statusConfig['pending'];
    
    return (
      <span
        className={reservationStyles.statusBadge}
        style={{
          background: `${config.color}15`,
          color: config.color,
          border: `1px solid ${config.color}40`
        }}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  const getPaymentBadge = (paymentInfo) => {
    if (!paymentInfo || paymentInfo.method === 'free') {
      return <span className={reservationStyles.paymentBadge}>🆓 Free</span>;
    }

    const methodConfig = {
      'cash_on_pickup': { icon: '💰', label: 'Cash on Pickup', color: '#10b981' },
      'stripe_escrow': { icon: '💳', label: 'Card Payment', color: '#3b82f6' }
    };

    const config = methodConfig[paymentInfo.method] || { icon: '💵', label: 'Payment', color: '#6b7280' };
    
    return (
      <span
        className={reservationStyles.paymentBadge}
        style={{
          background: `${config.color}15`,
          color: config.color,
          border: `1px solid ${config.color}40`
        }}
      >
        <span>{config.icon}</span>
        <span>{config.label}: £{paymentInfo.amount}</span>
        {paymentInfo.status === 'escrowed' && <span className={reservationStyles.heldIndicator}> (Held)</span>}
      </span>
    );
  };

  // Navigation functions
  const handleTabNavigation = (path) => {
    if (path === '/my-posts') {
      window.location.href = '/my-posts';
    } else if (path === '/messages') {
      window.location.href = '/messages';
    } else if (path === '/individual-dashboard') {
      window.location.href = '/individual-dashboard';
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Reservation Card Component
  const ReservationCard = ({ reservation }) => {
    const getStatusIcon = (status) => {
      const icons = {
        pending: '⏳',
        accepted: '✅',
        rejected: '❌',
        completed: '🎉',
        cancelled: '⚫'
      };
      return icons[status] || '⏳';
    };

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

    return (
      <div className={`${styles.foodCard} ${reservationStyles.reservationCard}`}>
        {/* Header */}
        <div className={reservationStyles.cardHeader}>
          <div className={styles.foodImage} style={{ height: '80px' }}>
            {reservation.foodListing?.imageUrl ? (
              <img 
                src={reservation.foodListing.imageUrl} 
                alt={reservation.foodListing.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getCategoryEmoji(reservation.foodListing?.category)
            )}
            <div className={styles.distanceBadge}>
              {getStatusIcon(reservation.status)} {reservation.status}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={styles.foodDetails}>
          <h3 className={styles.foodTitle}>{reservation.foodListing?.title || 'Unknown Food'}</h3>
          
          <p className={styles.foodProvider}>
            {reservation.isRequester 
              ? `Requested from ${reservation.otherUser?.name || 'Unknown'}` 
              : `Request from ${reservation.otherUser?.name || 'Unknown'}`
            }
          </p>

          <div style={{ margin: '0.5rem 0' }}>
            {getPaymentBadge(reservation.paymentInfo)}
          </div>

          {reservation.paymentHeld && (
            <div className={reservationStyles.escrowInfo}>
              💳 Payment securely held - {reservation.isProvider ? 'Will be released when pickup is completed' : 'Will be released to provider after pickup'}
            </div>
          )}
                      
          <div className={styles.foodMeta}>
            <span>🕐 {formatTimeAgo(reservation.createdAt)}</span>
            {reservation.pickupTime && (
              <span>📍 {formatPickupTime(reservation.pickupTime)}</span>
            )}
          </div>

          {reservation.message && (
            <div className={reservationStyles.reservationMessage}>
              "{reservation.message}"
            </div>
          )}

          <div className={styles.foodActions}>
            {/* Provider Actions - Can Accept/Reject */}
            {reservation.canAccept && (
              <button
                onClick={() => updateReservationStatus(reservation._id, 'accepted')}
                disabled={updating}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: '#10b981' }}
              >
                Accept{reservation.paymentHeld && ' (Release after pickup)'}
              </button>
            )}
            
            {reservation.canReject && (
              <button
                onClick={() => {
                  if (reservation.paymentHeld) {
                    if (window.confirm('This will automatically refund the payment. Are you sure you want to decline?')) {
                      updateReservationStatus(reservation._id, 'rejected');
                    }
                  } else {
                    updateReservationStatus(reservation._id, 'rejected');
                  }
                }}
                disabled={updating}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Decline{reservation.paymentHeld && ' (Auto-refund)'}
              </button>
            )}

            {/* Requester Actions - Can Cancel */}
            {reservation.canCancel && (
              <button
                onClick={() => {
                  if (reservation.paymentHeld) {
                    if (window.confirm('This will refund your payment. Are you sure you want to cancel?')) {
                      updateReservationStatus(reservation._id, 'cancelled');
                    }
                  } else {
                    updateReservationStatus(reservation._id, 'cancelled');
                  }
                }}
                disabled={updating}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Cancel Request{reservation.paymentHeld && ' (Get refund)'}
              </button>
            )}

            {/* Both Can Complete */}
            {reservation.canComplete && (
              <button
                onClick={() => {
                  const confirmMessage = reservation.needsPaymentRelease
                    ? 'Mark as completed? This will release the payment to the provider.'
                    : 'Mark this reservation as completed?';
                  
                  if (window.confirm(confirmMessage)) {
                    updateReservationStatus(reservation._id, 'completed');
                  }
                }}
                disabled={updating}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: '#8b5cf6' }}
              >
                ✓ Mark Collected{reservation.needsPaymentRelease && ' (Release payment)'}
              </button>
            )}

            {/* View Messages/Details */}
            <button
              onClick={() => {
                if (reservation.conversationId) {
                  window.location.href = `/messages?conversation=${reservation.conversationId}`;
                } else {
                  setSelectedReservation(reservation);
                  setShowDetailModal(true);
                }
              }}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              💬 {reservation.conversationId ? 'View Messages' : 'View Details'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading reservations..." />;
  }

  const filteredReservations = getFilteredReservations();

  return (
    <div>
      {/* Header */}
      <Header 
        title="Reservations"
        showBackButton={!isMobile}
        onBackClick={() => window.location.href = '/individual-dashboard'}
        showMobileMenuButton={isTablet}
        onMobileMenuClick={toggleSidebar}
        unreadCount={unreadCount}
        pendingReservations={reservations.filter(r => r.status === 'pending').length} 
        isMobile={isMobile}
      />

      {/* Sidebar Overlay */}
      <div 
        className={`${styles.sidebarOverlay} ${sidebarOpen && isTablet ? styles.show : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

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

      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>
        {/* Desktop Sidebar */}
        {!isMobile && !isTablet && (
          <Sidebar 
            isMobile={false}
            isOpen={false}
            stats={{
              totalReservations: reservations.length,
              pendingReservations: reservations.filter(r => r.status === 'pending').length,
              completedReservations: reservations.filter(r => r.status === 'completed').length,
              successRate: reservations.length > 0 ? Math.round(
                (reservations.filter(r => r.status === 'accepted' || r.status === 'completed').length / reservations.length) * 100
              ) : 0
            }}
            statsTitle="Reservation Stats"
            currentPage="reservations"
            unreadCount={unreadCount}
            pendingReservations={reservations.filter(r => r.status === 'pending').length}
          />
        )}

        {/* Tablet Sidebar */}
        {isTablet && (
          <Sidebar 
            isMobile={true}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            stats={{
              totalReservations: reservations.length,
              pendingReservations: reservations.filter(r => r.status === 'pending').length,
              completedReservations: reservations.filter(r => r.status === 'completed').length,
              successRate: reservations.length > 0 ? Math.round(
                (reservations.filter(r => r.status === 'accepted' || r.status === 'completed').length / reservations.length) * 100
              ) : 0
            }}
            statsTitle="Reservation Stats"
            currentPage="reservations"
            unreadCount={unreadCount}
            pendingReservations={reservations.filter(r => r.status === 'pending').length}
          />
        )}

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Tabs */}
          <div className={styles.tabNav}>
            {[
              { key: 'all', label: 'All', icon: '📋' },
              { key: 'sent', label: 'Sent', icon: '📤' },
              { key: 'received', label: 'Received', icon: '📥' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`${styles.tabBtn} ${selectedTab === tab.key ? styles.active : ''}`}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabText}>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {/* Filter Bar */}
            <FilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filters={getFilterOptions()}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              searchPlaceholder="Search reservations..."
            />

            {/* Error State */}
            {error && (
              <div style={{ 
                background: '#fee2e2', 
                border: '1px solid #fecaca', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                marginBottom: '1rem',
                color: '#dc2626'
              }}>
                ❌ {error}
              </div>
            )}

            {/* Reservations Grid */}
            <div className={styles.foodGrid}>
              {filteredReservations.length === 0 ? (
                <div className={styles.noItems}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
                  <h3>
                    {searchTerm || selectedFilter !== 'all' 
                      ? 'No matching reservations' 
                      : 'No reservations yet'
                    }
                  </h3>
                  <p style={{ marginBottom: '1rem' }}>
                    {searchTerm || selectedFilter !== 'all' 
                      ? 'Try adjusting your filters or search terms'
                      : 'Start by browsing available food and making reservation requests'
                    }
                  </p>
                  <button
                    onClick={() => window.location.href = '/individual-dashboard'}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    Browse Food
                  </button>
                </div>
              ) : (
                filteredReservations.map(reservation => (
                  <ReservationCard key={reservation._id} reservation={reservation} />
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          currentPage="reservations"
          unreadCount={unreadCount}
          pendingReservations={reservations.filter(r => r.status === 'pending').length}
          onTabNavigation={handleTabNavigation}
        />
      )}

      {/* Reservation Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Reservation Details"
        size="medium"
        actions={
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setShowDetailModal(false)}
          >
            Close
          </button>
        }
      >
        {selectedReservation && (
          <div>
            <div className={styles.foodSummary}>
              <div className={styles.foodSummaryImage}>
                {selectedReservation.foodListing?.imageUrl ? (
                  <img 
                    src={selectedReservation.foodListing.imageUrl} 
                    alt={selectedReservation.foodListing.title}
                  />
                ) : (
                  '🍽️'
                )}
              </div>
              <div className={styles.foodSummaryDetails}>
                <h4>{selectedReservation.foodListing?.title}</h4>
                <p>
                  {selectedReservation.isRequester 
                    ? `Provider: ${selectedReservation.otherUser?.name}` 
                    : `Requester: ${selectedReservation.otherUser?.name}`
                  }
                </p>
                <p>Status: {selectedReservation.status}</p>
                <p>Created: {formatTimeAgo(selectedReservation.createdAt)}</p>
              </div>
            </div>
            
            {selectedReservation.message && (
              <div style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: '0.5rem',
                border: '1px solid var(--gray-200)',
                marginTop: '1rem'
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Message:
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                  "{selectedReservation.message}"
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reservations;
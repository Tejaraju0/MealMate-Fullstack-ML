import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import styles from '../../css/Dashboard.module.css';

const ReservationModal = ({ 
  isOpen, 
  onClose, 
  foodItem, 
  onSubmit,
  isSubmitting 
}) => {
  const [step, setStep] = useState(1); 
  const [reservationData, setReservationData] = useState({
    message: '',
    urgencyLevel: 'normal',
    contactMethod: 'app'
  });

  useEffect(() => {
    if (isOpen && foodItem) {
      setReservationData({
        message: `Hi! I'm interested in your ${foodItem.title || 'food item'}. When would be a good time to pick it up?`,
        urgencyLevel: 'normal',
        contactMethod: 'app'
      });
      setStep(1);
    }
  }, [isOpen, foodItem]);

  const handleSubmit = async () => {
    if (!foodItem) return;
    
    try {
      await onSubmit(reservationData);
      setStep(3); 
    } catch (error) {
      console.error('Reservation failed:', error);
      
    }
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  if (!isOpen || !foodItem) return null;

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

  const renderStep1 = () => {
    if (!foodItem) return null;
    
    return (
      <div>
        {/* Food Summary */}
        <div className={styles.foodSummary}>
          <div className={styles.foodSummaryImage}>
            {foodItem.imageUrl ? (
              <img src={foodItem.imageUrl} alt={foodItem.title} />
            ) : (
              getCategoryEmoji(foodItem.category || 'other')
            )}
          </div>
          <div className={styles.foodSummaryDetails}>
            <h4>{foodItem.title || 'Unknown Food'}</h4>
            <p>By {foodItem.postedBy?.name || 'Unknown Provider'}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{ 
                  width: '0.5rem', 
                  height: '0.5rem', 
                  flexShrink: 0 
                }}
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="m22 21-3-3"/>
                <circle cx="17" cy="17" r="3"/>
              </svg>
              {foodItem.quantity || 1} servings
            </p>
            <p style={{ color: '#10b981', fontWeight: '600' }}>
              {foodItem.isFree ? 'FREE' : `$${foodItem.price || 0}`}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Quick Actions</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {[
              'Can pick up now',
              'Available this evening?', 
              'Still available?',
              'Flexible with timing'
            ].map(action => (
              <button
                key={action}
                type="button"
                onClick={() => setReservationData(prev => ({ ...prev, message: action }))}
                style={{
                  padding: '0.5rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '0.375rem',
                  background: 'var(--black)',
                  color: 'var(--gray-700)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'var(--gray-100)'}
                onMouseOut={(e) => e.target.style.background = 'var(--black)'}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message */}
        <div className={styles.formGroup}>
          <label htmlFor="reservationMessage" className={styles.formLabel}>Message to Provider *</label>
          <textarea
            id="reservationMessage"
            value={reservationData.message}
            onChange={(e) => setReservationData(prev => ({ ...prev, message: e.target.value }))}
            className={`${styles.formInput} ${styles.formTextarea}`}
            rows="3"
            placeholder="Let them know when you can pick up..."
            required
          />
        </div>

        {/* Urgency Level */}
        <div className={styles.formGroup}>
          <label htmlFor="urgencyLevel" className={styles.formLabel}>Pickup Preference</label>
          <select
            id="urgencyLevel"
            value={reservationData.urgencyLevel}
            onChange={(e) => setReservationData(prev => ({ ...prev, urgencyLevel: e.target.value }))}
            className={styles.formInput}
          >
            <option value="asap">🚀 ASAP (within 1 hour)</option>
            <option value="today">📅 Today</option>
            <option value="normal">⏰ Within 24 hours</option>
            <option value="flexible">🤝 I'm flexible</option>
          </select>
        </div>

        {/* Contact Method */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Preferred Contact Method</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { value: 'app', label: '📱 App', icon: '📱' },
              { value: 'phone', label: '📞 Phone', icon: '📞' },
              { value: 'whatsapp', label: '📱 WhatsApp', icon: '📱' }
            ].map(method => (
              <button
                key={method.value}
                type="button"
                onClick={() => setReservationData(prev => ({ ...prev, contactMethod: method.value }))}
                style={{
                  flex: '1',
                  padding: '0.5rem',
                  border: reservationData.contactMethod === method.value ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                  borderRadius: '0.375rem',
                  background: reservationData.contactMethod === method.value ? 'rgba(59, 130, 246, 0.1)' : 'var(--black)',
                  color: 'var(--gray-700)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    if (!foodItem) return null;
    
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ 
            width: '4rem', 
            height: '4rem', 
            background: 'rgba(59, 130, 246, 0.1)', 
            borderRadius: '50%', 
            margin: '0 auto 1rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '1.5rem' 
          }}>
            📋
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Confirm Your Reservation
          </h3>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
            Your request will be sent to {foodItem.postedBy?.name || 'the provider'}
          </p>
        </div>

        {/* Summary */}
        <div style={{ 
          padding: '1rem', 
          background: 'var(--gray-50)', 
          borderRadius: '0.5rem',
          border: '1px solid var(--gray-200)',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Food Item:</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{foodItem.title || 'Unknown Food'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Urgency:</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '500', textTransform: 'capitalize' }}>
              {reservationData.urgencyLevel}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>Contact:</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
              {reservationData.contactMethod === 'app' && 'App Messages'}
              {reservationData.contactMethod === 'phone' && 'Phone Call'}
              {reservationData.contactMethod === 'whatsapp' && 'WhatsApp'}
            </span>
          </div>
        </div>

        {/* Message Preview */}
        <div style={{
          padding: '0.75rem',
          borderLeft: '4px solid var(--primary)',
          background: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '0 0.375rem 0.375rem 0'
        }}>
          <p style={{ fontSize: '0.875rem', margin: '0' }}>
            <strong>Your Message:</strong> "{reservationData.message}"
          </p>
        </div>
      </div>
    );
  };

  // Step 3: Success
  const renderStep3 = () => {
    if (!foodItem) return null;
    
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ 
          width: '5rem', 
          height: '5rem', 
          background: 'rgba(16, 185, 129, 0.1)', 
          borderRadius: '50%', 
          margin: '0 auto 1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: '2rem' 
        }}>
          ✅
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Request Sent Successfully!
        </h3>
        <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
          {foodItem.postedBy?.name || 'The provider'} will be notified and can respond through messages.
        </p>
        
        {/* Success Details */}
        <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span>📱</span>
            <span>You'll get notified when they respond</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span>💬</span>
            <span>Continue chatting in Messages</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span>📍</span>
            <span>Pickup location shared after acceptance</span>
          </div>
        </div>
      </div>
    );
  };

  // Modal Actions for each step
  const getModalActions = () => {
    if (step === 1) {
      return (
        <>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setStep(2)}
            disabled={!reservationData.message.trim() || isSubmitting}
          >
            Continue
          </button>
        </>
      );
    }
    
    if (step === 2) {
      return (
        <>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setStep(1)}
            disabled={isSubmitting}
          >
            Back
          </button>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Request'}
          </button>
        </>
      );
    }
    
    // Step 3: Success
    return (
      <>
        <button 
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => window.location.href = '/messages'}
          style={{ flex: '1' }}
        >
          Go to Messages
        </button>
        <button 
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleClose}
          style={{ flex: '1' }}
        >
          Continue Browsing
        </button>
      </>
    );
  };

  const getModalTitle = () => {
    switch(step) {
      case 1: return 'Reserve Food';
      case 2: return 'Confirm Reservation';
      case 3: return 'Reservation Sent!';
      default: return 'Reserve Food';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getModalTitle()}
      size="medium"
      actions={getModalActions()}
    >
      {foodItem && step === 1 && renderStep1()}
      {foodItem && step === 2 && renderStep2()}
      {foodItem && step === 3 && renderStep3()}
      {!foodItem && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-600)' }}>
          <p>Loading food details...</p>
        </div>
      )}
    </Modal>
  );
};

export default ReservationModal;
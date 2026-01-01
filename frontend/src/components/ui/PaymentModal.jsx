import React, { useState } from 'react';
import Modal from './Modal';
import styles from '../../css/Dashboard.module.css';
import axios from '../../api/axios';
import { toast } from 'react-toastify';

import { 
  MealIcon, 
  SnackIcon, 
  BakeryIcon, 
  FruitIcon, 
  OtherFoodIcon 
} from './Icons';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  foodItem, 
  onPayment,
  isProcessing = false
}) => {
  const [processing, setProcessing] = useState(false);
  const token = localStorage.getItem("token");

  const getCategoryIcon = (category) => {
    const iconProps = { style: { width: '1.5rem', height: '1.5rem' } };
    switch(category) {
      case 'meal': return <MealIcon {...iconProps} />;
      case 'snack': return <SnackIcon {...iconProps} />;
      case 'bakery': return <BakeryIcon {...iconProps} />;
      case 'fruits': return <FruitIcon {...iconProps} />;
      default: return <OtherFoodIcon {...iconProps} />;
    }
  };

  const handleCashPayment = () => {
    onPayment({
      success: true,
      method: 'cash_on_pickup',
      amount: foodItem.price,
      timestamp: new Date().toISOString()
    });
  };

  const handleStripePayment = async () => {
    setProcessing(true);

    const token = localStorage.getItem("token");

    try {
      const response = await axios.post(
        "/payments/create-checkout-session",
        { foodId: foodItem._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        window.location.href = response.data.sessionUrl;
      }

    } catch (error) {
      setProcessing(false);
      
      const message =
        error.response?.data?.message || "Payment failed, please try again.";

      toast.error(message, { position: "top-center" });
    }
  };


  if (!foodItem) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Payment Options - £${foodItem.price}`}
      size="large"
      actions={
        <button 
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onClose}
        >
          Cancel
        </button>
      }
    >
      <div>
        <div style={{
          display: 'flex', 
          gap: '1rem', 
          padding: '1rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '0.5rem', 
          marginBottom: '1.5rem'
        }}>
          <div style={{ width: '60px', height: '60px', flexShrink: 0 }}>
            {foodItem.imageUrl ? (
              <img 
                src={foodItem.imageUrl} 
                alt={foodItem.title} 
                style={{ width: '100%', height: '100%', borderRadius: '0.5rem', objectFit: 'cover' }}
              />
            ) : (
              getCategoryIcon(foodItem.category)
            )}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{foodItem.title}</h4>
            <p style={{ margin: '0.25rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
              By {foodItem.postedBy?.name}
            </p>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
              £{foodItem.price}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <button
            onClick={handleCashPayment}
            style={{
              padding: '1.25rem',
              border: '2px solid #10b981',
              borderRadius: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>💵</div>
            <div>
              <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
                Cash on Pickup
              </h5>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Pay £{foodItem.price} when you collect the food
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#059669', fontWeight: '500' }}>
                ✓ Most secure • ✓ No fees • ✓ Meet before paying
              </p>
            </div>
          </button>

          <button
            onClick={handleStripePayment}
            disabled={processing}
            style={{
              padding: '1.25rem',
              border: '2px solid #3b82f6',
              borderRadius: '0.75rem',
              background: 'rgba(59, 130, 246, 0.1)',
              cursor: processing ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              opacity: processing ? 0.6 : 1
            }}
          >
            <div style={{ fontSize: '2rem' }}>💳</div>
            <div>
              <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
                {processing ? 'Redirecting to Stripe...' : 'Pay Online with Card'}
              </h5>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Secure payment via Stripe (like Amazon, eBay)
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#2563eb', fontWeight: '500' }}>
                ✓ Industry Standard • ✓ Mobile Optimized • ✓ Trusted by millions
              </p>
            </div>
          </button>
        </div>

        <div style={{ 
          textAlign: 'center', 
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '0.5rem'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.8rem', 
            color: '#1e40af',
            fontWeight: '500'
          }}>
             Recommendation: Use "Cash on Pickup" for maximum security and to verify food quality before paying
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentModal;
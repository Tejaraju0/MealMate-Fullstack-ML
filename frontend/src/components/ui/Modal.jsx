import React, { useEffect } from 'react';
import styles from '../../css/Dashboard.module.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  actions = null,
  size = 'medium' 
}) => {
  
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getModalClass = () => {
    switch (size) {
      case 'small':
        return styles.deleteModal;
      case 'large':
        return styles.modalLarge;
      case 'medium':
        return styles.modalMedium;
      default:
        return styles.reservationModal; 
    }
  };

  const overlayClass = `${styles.sidebarOverlay} ${styles.show}`;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div 
        className={getModalClass()}
        onClick={(e) => e.stopPropagation()}
      >

        {title && (
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{title}</h3>
            <button 
              className={styles.closeEditor} 
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        

        <div className={size === 'large' ? styles.modalContentLarge : styles.modalContent}>
          {children}
        </div>
        

        {actions && (
          <div className={styles.modalActions}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
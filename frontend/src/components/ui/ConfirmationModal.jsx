// components/ui/ConfirmationModal.jsx
import React from 'react';
import styles from '../../css/MyPosts.module.css';

const ConfirmationModal = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title, 
  message, 
  type = 'danger',
  confirmText = null,
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null;

  const getConfirmText = () => {
    if (confirmText) return confirmText;
    return type === 'danger' ? 'Delete' : 
           type === 'warning' ? 'Confirm' : 'OK';
  };

  const getIcon = () => {
    return type === 'danger' ? '⚠️' : 
           type === 'warning' ? '❓' : 'ℹ️';
  };

  const getConfirmButtonClass = () => {
    return type === 'danger' ? styles.dangerBtn : 
           type === 'warning' ? styles.warningBtn : styles.btnPrimary;
  };

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confirmHeader}>
          <div className={styles.confirmIcon}>
            {getIcon()}
          </div>
          <h3 className={styles.confirmTitle}>{title}</h3>
        </div>
        
        <div className={styles.confirmContent}>
          <p className={styles.confirmMessage}>{message}</p>
        </div>
        
        <div className={styles.confirmActions}>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.btn} ${getConfirmButtonClass()}`}
            onClick={onConfirm}
          >
            {getConfirmText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
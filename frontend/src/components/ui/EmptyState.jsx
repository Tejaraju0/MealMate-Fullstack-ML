// components/ui/EmptyState.jsx
import React from 'react';
import styles from '../../css/MyPosts.module.css';

const EmptyState = ({
  icon = "📝",
  title,
  description,
  actionText = null,
  onAction = null,
  className = ""
}) => {
  return (
    <div className={`${styles.emptyState} ${className}`}>
      <div className={styles.emptyIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && onAction && (
        <button 
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onAction}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
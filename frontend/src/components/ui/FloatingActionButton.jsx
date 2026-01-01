// components/ui/FloatingActionButton.jsx
import React from 'react';
import styles from '../../css/MyPosts.module.css';

const FloatingActionButton = ({
  onClick,
  isMobile = false,
  icon = (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  style = {}
}) => {
  const defaultStyle = {
    position: 'fixed',
    bottom: isMobile ? '90px' : '20px',
    right: '20px',
    zIndex: 99,
    ...style
  };

  return (
    <button 
      className={styles.mobileFloatingBtn}
      onClick={onClick}
      style={defaultStyle}
    >
      {icon}
    </button>
  );
};

export default FloatingActionButton;
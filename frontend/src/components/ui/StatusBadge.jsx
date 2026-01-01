import React from 'react';
import styles from '../../css/Dashboard.module.css';

const StatusBadge = ({ status }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'available':
        return styles.statusAvailable;
      case 'reserved':
        return styles.statusReserved;
      case 'completed':
      case 'collected':
        return styles.statusCompleted;
      case 'expired':
        return styles.statusExpired;
      default:
        return styles.statusAvailable;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'reserved':
        return 'Reserved';
      case 'completed':
        return 'Completed';
      case 'collected':
        return 'Collected';
      case 'expired':
        return 'Expired';
      default:
        return 'Available';
    }
  };

  if (!status || status === 'available') {
    return null; 
  }

  return (
    <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
      {getStatusText(status)}
    </span>
  );
};

export default StatusBadge;
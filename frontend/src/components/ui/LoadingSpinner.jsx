import React from 'react';
import styles from '../../css/Dashboard.module.css';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner}></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
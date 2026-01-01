import React from 'react';
import styles from '../../css/Dashboard.module.css';
import { NotificationIcon, MessagesIcon, ReservationsIcon } from '../ui/Icons';

const Header = ({ 
  title = "MealMate",
  showBackButton = false,
  onBackClick,
  showMobileMenuButton = false,
  onMobileMenuClick,
  unreadCount = 0,
  pendingReservations = 0,
  isMobile = false
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        {/* Logo/Title Section */}
        <div className={styles.logoContainer}>
          {showBackButton && (
            <button 
              onClick={onBackClick}
              className={styles.backButton}
              aria-label="Go back"
            >
              ←
            </button>
          )}
          {/* Mobile Menu Button */}
          {showMobileMenuButton && (
            <button 
              className={`${styles.mobileMenuBtn} ${styles.show}`}
              onClick={onMobileMenuClick}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <h1 className={styles.logo}>{title}</h1>
        </div>

        {/* Actions Section */}
        <div className={styles.headerActions}>


          {/* Notification Buttons */}
          {isMobile ? (
            <>
              <button 
                className={styles.mobileNotificationBtn} 
                aria-label="Reservations"
                onClick={() => window.location.href = '/reservations'}
              >
                <ReservationsIcon className={styles.notificationIcon} />
                {pendingReservations > 0 && (
                  <span className={styles.mobileNotificationBadge}>
                    {pendingReservations > 99 ? '99+' : pendingReservations}
                  </span>
                )}
              </button>
              <button 
                className={styles.mobileNotificationBtn} 
                aria-label="Messages"
                onClick={() => window.location.href = '/messages'}
              >
                <MessagesIcon className={styles.notificationIcon} />
                {unreadCount > 0 && (
                  <span className={styles.mobileNotificationBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              <button 
                className={styles.notificationBtn}
                onClick={() => window.location.href = '/reservations'}
                aria-label="Reservations"
              >
                <ReservationsIcon className={styles.notificationIcon} />
                {pendingReservations > 0 && (
                  <span className={styles.notificationBadge}>
                    {pendingReservations > 99 ? '99+' : pendingReservations}
                  </span>
                )}
              </button>
              <button 
                className={styles.notificationBtn}
                onClick={() => window.location.href = '/messages'}
                aria-label="Messages"
              >
                <MessagesIcon className={styles.notificationIcon} />
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </>
          )}
          {/* User Profile */}
          <div 
            className={styles.userProfile}
            onClick={() => window.location.href = '/profile'}
            style={{ cursor: 'pointer' }}
            title="My Profile"
          >
            <div className={styles.avatar}>
              {localStorage.getItem('userName')?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isMobile && (
              <span className={styles.userName}>
                {localStorage.getItem('userName') || 'User'}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
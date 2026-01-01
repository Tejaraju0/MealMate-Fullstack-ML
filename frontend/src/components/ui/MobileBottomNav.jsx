import React, { useEffect, useState } from 'react';
import styles from '../../css/MyPosts.module.css';
import { HomeIcon, PostsIcon, MessagesIcon, ReservationsIcon } from './Icons';

const MobileBottomNav = ({
  currentPage = 'dashboard',
  unreadCount = 0,
  pendingReservations = 0,
  onTabNavigation
}) => {
  const [userRole, setUserRole] = useState('individual');

  useEffect(() => {
    const role = localStorage.getItem('userRole') || 'individual';
    setUserRole(role);
  }, []);

  const tabs = userRole === 'organization' ? [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/restaurant-dashboard',
      icon: <HomeIcon className={styles.tabIcon} />
    },
    {
      id: 'waste',
      label: 'Analytics',
      path: '/waste-prediction',
      icon: <span>📊</span>
    },
    {
      id: 'messages',
      label: 'Messages',
      path: '/messages',
      icon: <MessagesIcon className={styles.tabIcon} />,
      badge: unreadCount
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: (
        <div className={styles.profileIconWrapper}>
          <div className={styles.profileIcon}>
            {localStorage.getItem('userName')?.charAt(0).toUpperCase() || 'R'}
          </div>
        </div>
      )
    }
  ] : [
    {
      id: 'dashboard',
      label: 'Home',
      path: '/individual-dashboard',
      icon: <HomeIcon className={styles.tabIcon} />
    },
    {
      id: 'reservations',
      label: 'Reservations',
      path: '/reservations',
      icon: <ReservationsIcon className={styles.tabIcon} />,
      badge: pendingReservations
    },
    {
      id: 'myposts',
      label: 'My Posts',
      path: '/my-posts',
      icon: <PostsIcon className={styles.tabIcon} />
    },
    {
      id: 'messages',
      label: 'Messages',
      path: '/messages',
      icon: <MessagesIcon className={styles.tabIcon} />,
      badge: unreadCount
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: (
        <div className={styles.profileIconWrapper}>
          <div className={styles.profileIcon}>
            {localStorage.getItem('userName')?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className={styles.mobileBottomNav}>
      {tabs.map(tab => (
        <button 
          key={tab.id}
          className={`${styles.tabButton} ${currentPage === tab.id ? styles.active : ''}`}
          onClick={() => onTabNavigation(tab.path)}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge > 0 && (
            <span className={styles.navBadge}>{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default MobileBottomNav;
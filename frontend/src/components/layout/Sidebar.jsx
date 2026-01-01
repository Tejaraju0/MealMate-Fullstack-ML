import React from 'react';
import styles from '../../css/Dashboard.module.css';
import { HomeIcon, PostsIcon, MessagesIcon, ReservationsIcon } from '../ui/Icons';

const Sidebar = ({ 
  isMobile = false, 
  isOpen = false, 
  onClose, 
  stats = {}, 
  statsTitle = "Dashboard Statistics",
  currentPage = "dashboard",
  unreadCount = 0,
  pendingReservations = 0
}) => {
  
  const sidebarClass = isMobile ? 
    `${styles.sidebar} ${styles.mobile} ${isOpen ? styles.open : ''}` : 
    styles.sidebar;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <HomeIcon className={styles.navIcon} />,
      href: '/individual-dashboard'
    },
    {
      id: 'myposts',
      label: 'My Posts',
      icon: <PostsIcon className={styles.navIcon} />,
      href: '/my-posts'
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: <MessagesIcon className={styles.navIcon} />,
      href: '/messages',
      badge: unreadCount
    },
    {
      id: 'reservations',
      label: 'Reservations',
      icon: <ReservationsIcon className={styles.navIcon} />,
      href: '/reservations',
      badge: pendingReservations
    }
  ];

  return (
    <aside className={sidebarClass}>
      {/* Mobile Header */}
      {isMobile && (
        <div className={styles.mobileHeader}>
          <h2 className={styles.mobileTitle}>Menu</h2>
          <button 
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className={styles.navSection}>
        <ul className={styles.navMenu}>
          {navItems.map(item => (
            <li key={item.id} className={styles.navItem}>
              <a 
                href={item.href}
                className={`${styles.navLink} ${currentPage === item.id ? styles.active : ''}`}
                onClick={(e) => {
                  if (item.href.startsWith('#')) {
                    e.preventDefault();
                    console.log(`${item.label} clicked`);
                  }
                  if (isMobile && onClose) {
                    onClose();
                  }
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>

     
    </aside>
  );
};

export default Sidebar;
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../../css/Dashboard.module.css';

const RestaurantSidebar = ({ 
  isMobile = false, 
  isOpen = false, 
  onClose, 
  currentPage = "dashboard"
}) => {
  const navigate = useNavigate();
  const location = useLocation(); 

  const getActivePageFromPath = () => {
    const path = location.pathname;
    if (path.includes('waste-prediction')) return 'waste-prediction';
    if (path.includes('messages')) return 'messages';
    if (path.includes('profile')) return 'profile';
    return 'dashboard';
  };

  const activePage = getActivePageFromPath();

  const sidebarClass = isMobile ? 
    `${styles.sidebar} ${styles.mobile} ${isOpen ? styles.open : ''}` : 
    styles.sidebar;

  const navItems = [
    {
      id: 'dashboard', 
      label: 'Dashboard',
      icon: '🏠',
      path: '/restaurant-dashboard'
    },
    {
      id: 'waste-prediction',  
      label: 'Waste Analytics',
      icon: '📊',
      path: '/waste-prediction'
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: '💬',
      path: '/messages'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      path: '/profile'
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside className={sidebarClass}>
      {isMobile && (
        <div className={styles.mobileHeader}>
          <h2 className={styles.mobileTitle}>Restaurant Menu</h2>
          <button 
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
      )}

      <div className={styles.userProfile}>
        <div className={styles.avatar}>🍽️</div>
        <div className={styles.userInfo}>
          <h3 className={styles.userName}>
            {localStorage.getItem('userName') || 'Restaurant'}
          </h3>
          <p className={styles.userRole}>Restaurant</p>
        </div>
      </div>

      <nav className={styles.navSection}>
        <ul className={styles.navMenu}>
          {navItems.map(item => (
            <li key={item.id} className={styles.navItem}>
              <a
                  href={item.path}
                  className={`${styles.navLink} ${activePage === item.id ? styles.active : ''}`}
                >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default RestaurantSidebar;
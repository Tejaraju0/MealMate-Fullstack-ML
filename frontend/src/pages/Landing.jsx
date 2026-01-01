import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../css/Landing.module.css';

const Landing = () => {
  const navigate = useNavigate();
  const [navbarScrolled, setNavbarScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScroll = () => {
    if (window.scrollY > 100) {
      setNavbarScrolled(true);
    } else {
      setNavbarScrolled(false);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const animateCard = (card) => {
    if (!card) return;
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      card.style.transform = 'translateY(-10px) scale(1)';
    }, 100);
  };

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(targetId);
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const showGetStarted = (e) => {
    e.preventDefault();
    navigate('/auth');
  };

  return (
    <div className={`${styles.landingPage} ${mobileMenuOpen ? styles.mobileSidebarOpen : ''}`}>
      <nav className={`${styles.navbar} ${navbarScrolled ? styles.scrolled : ''}`} id="navbar">
        <div className={styles.navContainer}>
          <div className={styles.logo}>MealMate</div>
          
          <div className={styles.desktopNav}>
            <ul className={styles.navLinks}>
              <li><a href="#home" onClick={(e) => handleSmoothScroll(e, '#home')}>Home</a></li>
              <li><a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')}>Features</a></li>
              <li><a href="#about" onClick={(e) => handleSmoothScroll(e, '#about')}>About</a></li>
              <li><a href="#contact" onClick={(e) => handleSmoothScroll(e, '#contact')}>Contact</a></li>
            </ul>
            <a href="/auth" className={styles.getStartedBtn} onClick={showGetStarted}>
              Get Started
            </a>
          </div>
          
          <button className={styles.mobileMenuBtn} onClick={toggleMobileMenu}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <>
          <div className={styles.sidebarOverlay} onClick={toggleMobileMenu}></div>
          <div className={styles.mobileSidebar}>
            <div className={styles.sidebarContent}>
              <ul className={styles.mobileNavLinks}>
                <li><a href="#home" onClick={(e) => { handleSmoothScroll(e, '#home'); toggleMobileMenu(); }}>Home</a></li>
                <li><a href="#features" onClick={(e) => { handleSmoothScroll(e, '#features'); toggleMobileMenu(); }}>Features</a></li>
                <li><a href="#about" onClick={(e) => { handleSmoothScroll(e, '#about'); toggleMobileMenu(); }}>About</a></li>
                <li><a href="#contact" onClick={(e) => { handleSmoothScroll(e, '#contact'); toggleMobileMenu(); }}>Contact</a></li>
              </ul>
              <a href="/auth" className={styles.mobileGetStartedBtn} onClick={(e) => { showGetStarted(e); toggleMobileMenu(); }}>
                Get Started
              </a>
            </div>
          </div>
        </>
      )}
      <section className={styles.hero} id="home">
        <div className={styles.heroContent}>
          <h1>Let's feed people, not landfills.</h1>
          <p className={styles.heroSubtitle}>
            Don't let good food go to waste. Let's share it.
          </p>
          <div className={styles.ctaButtons}>
            <a href="/register" className={styles.ctaPrimary} onClick={showGetStarted}>
              Start Sharing
            </a>
            <a href="#features" className={styles.ctaSecondary} onClick={(e) => handleSmoothScroll(e, '#features')}>
              Explore Features
            </a>
          </div>
        </div>
      </section>

      <section className={styles.features} id="features">
        <h2>How It Works</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard} onClick={() => animateCard(document.querySelectorAll(`.${styles.featureCard}`)[0])}>
            <span className={styles.featureIcon}>🔍</span>
            <h3 className={styles.featureTitle}>Discover</h3>
            <p className={styles.featureDesc}>Find available surplus food from restaurants, cafes, and individuals in your area. Real-time updates keep you informed.</p>
          </div>
          <div className={styles.featureCard} onClick={() => animateCard(document.querySelectorAll(`.${styles.featureCard}`)[1])}>
            <span className={styles.featureIcon}>🤝</span>
            <h3 className={styles.featureTitle}>Connect</h3>
            <p className={styles.featureDesc}>Message food providers directly to coordinate pickup times and locations. Build community connections.</p>
          </div>
        </div>
      </section>

      <section id="about" className={styles.about} >
        <h2>About MealMate</h2>
        <p>MealMate connects surplus food providers with local communities...</p>
      </section>

      {/* Contact section */}
      <section id="contact" className={styles.contact}>
        <h2>Contact</h2>
        <p>For support, email <a href="mailto:hello@mealmate.example">hello@mealmate.example</a>.</p>
      </section>
    </div>
  );
};

export default Landing;
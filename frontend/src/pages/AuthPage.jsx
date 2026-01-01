import React, { useState } from 'react';
import axios from '../api/axios';
import styles from '../css/AuthPage.module.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiEye, FiEyeOff } from 'react-icons/fi';

const AuthPage = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [currentTab, setCurrentTab] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleTabSwitch = (tab) => {
    setCurrentTab(tab);
  };

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  };

  const handleSignupChange = (e) => {
    setSignupForm({ ...signupForm, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/auth/login', { 
        email: loginForm.email,
        password: loginForm.password
      });
      
      const { token, user } = res.data;
      
      // Store token and user info
      localStorage.setItem('token', token);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userRole', user.role);
      
      // Show success toast
      toast.success('Login successful! Redirecting...', {
        position: "top-right",
        autoClose: 1500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
      });
      
      setTimeout(() => {
        if (user.role === 'organization') {
          window.location.href = '/restaurant-dashboard';
        } else {
          window.location.href = '/individual-dashboard';
        }
      }, 1500);
      
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    
    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error('Passwords do not match!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      return;
    }

    if (signupForm.password.length < 6) {
      toast.error('Password must be at least 6 characters long!', {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    const backendRole = selectedRole === 'restaurant' ? 'organization' : 'individual';

    const payload = {
      name: selectedRole === 'restaurant' ? signupForm.businessName : signupForm.fullName,
      email: signupForm.email,
      password: signupForm.password,
      role: backendRole 
    };

    try {
      await axios.post('/auth/register', payload);
      toast.success('Account created successfully! Please login.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      
      setCurrentTab('login');
      setLoginForm({ email: signupForm.email, password: '' });
      
      setSignupForm({
        fullName: '',
        businessName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  };

  const goBack = () => {
    window.history.back();
  };

  const getSubmitButtonText = () => {
    if (selectedRole) {
      const roleText = selectedRole === 'individual' ? 'Individual' : 'Restaurant';
      return currentTab === 'login' ? `Login as ${roleText}` : `Sign Up as ${roleText}`;
    }
    return 'Select Account Type';
  };

  return (
    <div className={styles.authPageWrapper}>
      <ToastContainer />
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>MealMate</div>
          <div className={styles.tagline}>Reduce Food Waste, Share Meals</div>
        </div>
        
        <div className={styles.content}>
          <div className={styles.roleSelection}>
            <h3>Choose Your Account Type</h3>
            <div className={styles.roleButtons}>
              <div 
                className={`${styles.roleBtn} ${selectedRole === 'individual' ? styles.active : ''}`}
                onClick={() => handleRoleSelect('individual')}
              >
                <span className={styles.icon}></span>
                <div className={styles.title}>Individual</div>
                <div className={styles.desc}>Find & collect food</div>
              </div>
              <div 
                className={`${styles.roleBtn} ${selectedRole === 'restaurant' ? styles.active : ''}`}
                onClick={() => handleRoleSelect('restaurant')}
              >
                <span className={styles.icon}></span>
                <div className={styles.title}>Organisation</div>
                <div className={styles.desc}>Share surplus food</div>
              </div>
            </div>
          </div>

          <div className={`${styles.formSection} ${selectedRole ? styles.active : ''}`}>
            <div className={styles.authTabs}>
              <div 
                className={`${styles.authTab} ${currentTab === 'login' ? styles.active : ''}`}
                onClick={() => handleTabSwitch('login')}
              >
                Login
              </div>
              <div 
                className={`${styles.authTab} ${currentTab === 'signup' ? styles.active : ''}`}
                onClick={() => handleTabSwitch('signup')}
              >
                Sign Up
              </div>
            </div>

            {currentTab === 'login' ? (
              <form onSubmit={handleLoginSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    autoComplete='username'
                    placeholder="Enter your email"
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="password">Password</label>
                  <div className={styles.passwordInput}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      id="password" 
                      name="password" 
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      autoComplete='current-password'
                      placeholder="Enter your password"
                      required 
                    />
                    <span 
                      className={styles.passwordToggle}
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? <FiEye /> : <FiEyeOff />}
                    </span>
                  </div>
                  <p 
                    className={styles.forgotPassword}
                    onClick={() => window.location.href = '/forgot-password'}
                  >
                    Forgot Password?
                  </p>

                </div>
                <button 
                  type="submit" 
                  className={styles.submitBtn} 
                  disabled={!selectedRole}
                >
                  {getSubmitButtonText()}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignupSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor={selectedRole === 'restaurant' ? 'businessName' : 'fullName'}>
                    {selectedRole === 'restaurant' ? 'Business Name' : 'Full Name'}
                  </label>
                  <input 
                    type="text" 
                    id={selectedRole === 'restaurant' ? 'businessName' : 'fullName'} 
                    name={selectedRole === 'restaurant' ? 'businessName' : 'fullName'} 
                    value={selectedRole === 'restaurant' ? signupForm.businessName : signupForm.fullName}
                    onChange={handleSignupChange}
                    placeholder={selectedRole === 'restaurant' ? 'Enter business name' : 'Enter your full name'}
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="signupEmail">Email Address</label>
                  <input 
                    type="email" 
                    id="signupEmail" 
                    name="email" 
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    placeholder="Enter your email"
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="signupPassword">Password</label>
                  <div className={styles.passwordInput}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      id="signupPassword" 
                      name="password" 
                      value={signupForm.password}
                      onChange={handleSignupChange}
                      autoComplete='new-password'
                      placeholder="Create a password (min 6 characters)"
                      required 
                    />
                    <span 
                      className={styles.passwordToggle}
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? <FiEye /> : <FiEyeOff />}
                    </span>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className={styles.passwordInput}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      value={signupForm.confirmPassword}
                      onChange={handleSignupChange}
                      placeholder="Confirm your password"
                      required 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  className={styles.submitBtn} 
                  disabled={!selectedRole}
                >
                  {getSubmitButtonText()}
                </button>
              </form>
            )}
          </div>

          <div className={styles.backLink}>
            <a href="/" onClick={goBack}>← Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
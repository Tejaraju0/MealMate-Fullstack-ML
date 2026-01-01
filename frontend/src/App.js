import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import MyPosts from './pages/MyPosts';
import Messages from './pages/Messages';
import Reservations from './pages/Reservations';
import UserProfile from './pages/UserProfile';
import RestaurantDashboard from './pages/RestaurantDashboard';
import WastePrediction from './pages/WastePrediction';
import ProtectedRoute from './components/ui/ProtectedRoute';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EnhancedDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState(
    location.state?.activeTab || 'discover'
  );

  return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
};

const MyPostsWrapper = () => {
  const navigate = useNavigate();

  const handleCreatePostClick = () => {
    navigate('/individual-dashboard', { state: { activeTab: 'post' } });
  };

  return <MyPosts onCreatePostClick={handleCreatePostClick} />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        
        {/* Individual User Routes */}
        <Route 
          path="/individual-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['individual']}>
              <EnhancedDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-posts" 
          element={
            <ProtectedRoute allowedRoles={['individual']}>
              <MyPostsWrapper />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reservations" 
          element={
            <ProtectedRoute allowedRoles={['individual']}>
              <Reservations />
            </ProtectedRoute>
          } 
        />
        
        {/* Restaurant Routes */}
        <Route 
          path="/restaurant-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['organization']}>
              <RestaurantDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/waste-prediction" 
          element={
            <ProtectedRoute allowedRoles={['organization']}>
              <WastePrediction />
            </ProtectedRoute>
          } 
        />
        
        {/* Shared Routes (both roles) */}
        <Route 
          path="/messages" 
          element={
            <ProtectedRoute allowedRoles={['individual', 'organization']}>
              <Messages />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute allowedRoles={['individual', 'organization']}>
              <UserProfile />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <ToastContainer position="top-center" autoClose={2000} />
    </Router>
  );
}

export default App;
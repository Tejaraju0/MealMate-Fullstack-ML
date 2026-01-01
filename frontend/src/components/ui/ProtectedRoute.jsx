import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import LoadingSpinner from '../ui/LoadingSpinner';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/auth');
        return;
      }

      try {
        const response = await axios.get('/auth/profile');
        const userRole = response.data.user.role;

        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
          
          if (userRole === 'organization') {
            navigate('/restaurant-dashboard');
          } else {
            navigate('/individual-dashboard');
          }
          return;
        }

        setAuthorized(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.clear();
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, allowedRoles]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return authorized ? children : null;
};

export default ProtectedRoute;
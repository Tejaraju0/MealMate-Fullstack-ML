import React, { useState, useEffect, useCallback } from 'react';
import dashboardStyles from '../css/Dashboard.module.css';
import myPostsStyles from '../css/MyPosts.module.css';
import axios from '../api/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import components
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import FilterBar from '../components/ui/FilterBar';
import PostCard from '../components/ui/PostCard';
import EmptyState from '../components/ui/EmptyState';
import MobileBottomNav from '../components/ui/MobileBottomNav';
import FloatingActionButton from '../components/ui/FloatingActionButton';
import DetailModal from '../components/ui/DetailModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const MyPosts = ({ onCreatePostClick }) => {
  const [myPosts, setMyPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', type: 'danger' });
  
  const [postStats, setPostStats] = useState({
    total: 0,
    available: 0,
    reserved: 0,
    collected: 0,
    expired: 0
  });

  // Mobile and sidebar states
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Combine styles objects
  const styles = { ...dashboardStyles, ...myPostsStyles };

  // Check screen size for responsive design
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 750);
      setIsTablet(width > 750 && width <= 1024);
      
      if (width > 1024) {
        setSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Get auth token
  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  };

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/messages/unread-count');
      setUnreadCount(response.data.totalUnread || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  // Fetch user's posts
  const fetchMyPosts = useCallback(async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to view your posts');
        return;
      }

      const response = await axios.get('/foodRoutes/my-listings');
      const posts = response.data.foodListings || [];
      
      setMyPosts(posts);
      setFilteredPosts(posts);
      
      // Calculate stats
      const stats = {
        total: posts.length,
        available: posts.filter(p => p.status === 'available').length,
        reserved: posts.filter(p => p.status === 'reserved').length,
        collected: posts.filter(p => p.status === 'collected').length,
        expired: posts.filter(p => p.status === 'expired').length
      };
      setPostStats(stats);
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load your posts');
      setMyPosts([]);
      setFilteredPosts([]);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  }, []);

  // Delete post function
  const deletePost = async (postId, postTitle) => {
    try {
      setIsDeleting(true);
      setDeletingPostId(postId);
      
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to delete posts');
        return;
      }

      await axios.delete(`/foodRoutes/${postId}`);
      toast.success(`"${postTitle}" deleted successfully`);
      await fetchMyPosts(false); 
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(error.response?.data?.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
      setDeletingPostId(null);
    }
  };

  // Change post status function
  const changePostStatus = async (postId, newStatus) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to update posts');
        return;
      }

      await axios.patch(`/foodRoutes/${postId}/status`, { status: newStatus });
      
      const statusMessages = {
        collected: 'Post marked as collected',
        available: 'Post marked as available',
        expired: 'Post marked as expired'
      };

      toast.success(statusMessages[newStatus] || `Status updated to ${newStatus}`);
      await fetchMyPosts(false); 
      
    } catch (error) {
      console.error('Error updating post status:', error);
      toast.error(error.response?.data?.message || 'Failed to update post status');
    }
  };

  // Filter and search posts
  useEffect(() => {
    let filtered = myPosts;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(post => post.status === selectedStatus);
    }

    if (searchTerm) {
      filtered = filtered.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPosts(filtered);
  }, [myPosts, selectedStatus, searchTerm]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchMyPosts(true), 
        fetchUnreadCount()
      ]);
    };
    loadData();
  }, [fetchMyPosts, fetchUnreadCount]);

  // Handle delete post action
  const handleDeletePost = (postId, postTitle) => {
    showConfirmation(
      'Delete Post',
      `Are you sure you want to delete "${postTitle}"? This action cannot be undone.`,
      () => deletePost(postId, postTitle),
      'danger'
    );
  };

  // Handle status update action
  const handleStatusUpdate = (postId, newStatus) => {
    const statusMessages = {
      collected: 'Mark this post as collected?',
      available: 'Mark this post as available again?',
      expired: 'Mark this post as expired?'
    };

    showConfirmation(
      'Update Status',
      statusMessages[newStatus] || `Change status to ${newStatus}?`,
      () => changePostStatus(postId, newStatus),
      'warning'
    );
  };

  // Custom confirmation function
  const showConfirmation = (title, message, onConfirm, type = 'danger') => {
    setConfirmData({ title, message, type });
    setConfirmAction(() => onConfirm);
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  // Navigation functions
  const handleViewMessages = (postId) => {
    window.location.href = `/messages?post=${postId}`;
  };


  // Show post details
  const handleShowDetails = (post) => {
    setSelectedPost(post);
    setShowDetailModal(true);
  };
  const handleCreatePost = () => {
      window.location.href = '/individual-dashboard?tab=post';
      onCreatePostClick && onCreatePostClick();
  };

  const handleTabNavigation = (path) => {
    if (path === '#post') {
      handleCreatePost();
    } else {
      window.location.href = path;
    }
  };

  // Prepare filter options
  const filterOptions = [
    { key: 'all', label: 'All', count: postStats.total },
    { key: 'available', label: 'Available', count: postStats.available },
    { key: 'reserved', label: 'Reserved', count: postStats.reserved },
    { key: 'collected', label: 'Collected', count: postStats.collected },
    { key: 'expired', label: 'Expired', count: postStats.expired }
  ];

  if (loading) {
    return <LoadingSpinner message="Loading your posts..." />;
  }

  return (
    <div className={styles.pageWrapper}>
      <ToastContainer />
      
      {/* Header for Desktop and Tablet */}
      {!isMobile && (
        <Header 
          title="My Posts"
          showBackButton={true}
          onBackClick={() => window.location.href = '/individual-dashboard'}
          showMobileMenuButton={isTablet}
          onMobileMenuClick={() => setSidebarOpen(!sidebarOpen)}
          unreadCount={unreadCount}
        >
          <button 
            className={`${styles.btn} ${styles.btnPrimary} ${styles.createBtn}`}
            onClick={handleCreatePost}
          >
            + New Post
          </button>
        </Header>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <div className={styles.mobileHeader}>
          <button 
            className={styles.mobileBackBtn}
            onClick={() => window.location.href = '/individual-dashboard'}
          >
            ←
          </button>
          <h1 className={styles.mobileTitle}>My Posts</h1>
          <div className={styles.headerSpacer}></div>
        </div>
      )}

      {/* Sidebar Overlay for Tablet */}
      {isTablet && (
        <div 
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.show : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={isMobile ? styles.mobileMainContainer : styles.mainContainer}>
        {/* Sidebar for Desktop and Tablet */}
        {!isMobile && (
          <Sidebar 
            isMobile={isTablet}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            stats={{
              mealsShared: postStats.collected,
              foodReceived: 0,
              co2Saved: Math.round(postStats.collected * 0.5),
              pointsEarned: postStats.collected * 10
            }}
            statsTitle="Post Statistics"
            currentPage="myposts"
            unreadCount={unreadCount}
          />
        )}

        <main className={styles.mainContent}>
          {/* Filter Bar */}
          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filters={filterOptions}
            selectedFilter={selectedStatus}
            onFilterChange={setSelectedStatus}
            searchPlaceholder="Search your posts..."
          />

          {/* Posts Grid */}
          <div className={styles.postsGrid}>
            {filteredPosts.length === 0 ? (
              <EmptyState
                title={myPosts.length === 0 ? "No posts yet" : "No posts match your filters"}   
                description={
                  myPosts.length === 0 
                    ? "Start sharing food with your community by creating your first post." 
                    : "Try adjusting your search or filter criteria."
                }
                actionText={myPosts.length === 0 ? "Create First Post" : null}
                onAction={myPosts.length === 0 ? handleCreatePost : null}
              />
            ) : (
              filteredPosts.map((post, index) => (
                <PostCard
                  key={post._id}
                  item={post}
                  type="mypost"
                  onStatusUpdate={handleStatusUpdate}
                  onViewMessages={handleViewMessages}
                  onDelete={handleDeletePost}
                  isDeleting={isDeleting}
                  deletingPostId={deletingPostId}
                  onClick={handleShowDetails}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          currentPage="myposts"
          unreadCount={unreadCount}
          onTabNavigation={handleTabNavigation}
        />
      )}

      {/* Floating Action Button */}
      {isMobile && (
        <FloatingActionButton
          onClick={handleCreatePost}
          isMobile={true}
        />
      )}

      {/* Detail Modal */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        post={selectedPost}
        type="mypost"
        onStatusUpdate={handleStatusUpdate}
        onDelete={handleDeletePost}
        onViewMessages={handleViewMessages}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmData.title}
        message={confirmData.message}
        type={confirmData.type}
      />
    </div>
  );
};

export default MyPosts;
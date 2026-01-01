import React from 'react';
import styles from '../../css/Dashboard.module.css';

const PostActions = ({
  post,
  onStatusUpdate,
  onViewMessages,
  onEdit,
  onDelete,
  isDeleting,
  deletingPostId,
  type
}) => {
  if (type !== 'mypost') {
    return null; 
  }

  const handleStatusUpdate = (newStatus) => {
    if (onStatusUpdate) {
      onStatusUpdate(post._id, newStatus);
    }
  };

  const handleViewMessages = () => {
    if (onViewMessages) {
      onViewMessages(post._id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(post);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(post._id);
    }
  };

  const isCurrentlyDeleting = isDeleting && deletingPostId === post._id;

  return (
    <div className={styles.postActions}>
      <div className={styles.primaryActions}>
        {post.status === 'available' && (
          <>
            <button 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => handleStatusUpdate('reserved')}
              title="Mark as reserved"
            >
              📋 Reserved
            </button>
            <button 
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => handleStatusUpdate('completed')}
              title="Mark as completed"
            >
              ✅ Completed
            </button>
          </>
        )}
        
        {post.status === 'reserved' && (
          <>
            <button 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => handleStatusUpdate('available')}
              title="Mark as available"
            >
              🔄 Available
            </button>
            <button 
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => handleStatusUpdate('completed')}
              title="Mark as completed"
            >
              ✅ Completed
            </button>
          </>
        )}

        {/* Messages Button */}
        <button 
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleViewMessages}
          title="View messages"
        >
          💬 Messages
        </button>
      </div>

      <div className={styles.secondaryActions}>
        {/* Edit Button */}
        <button 
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleEdit}
          title="Edit post"
          disabled={post.status === 'completed'}
        >
          ✏️
        </button>

        {/* Delete Button */}
        <button 
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={handleDelete}
          disabled={isCurrentlyDeleting}
          title="Delete post"
        >
          {isCurrentlyDeleting ? '⏳' : '🗑️'}
        </button>
      </div>
    </div>
  );
};

export default PostActions;
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 10; 
  const reconnectDelay = 2000; 

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: reconnectDelay,
      reconnectionDelayMax: 10000,
      maxHttpBufferSize: 1e6,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    newSocket.on('connect', () => {
      console.log('🔗 Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionAttempts(0);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    newSocket.on('connect_error', (error) => {
      console.log('nnection error (retrying silently):', error.message);
      setIsConnected(false);
      handleReconnection();
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected (reason: ' + reason + ')');
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        handleReconnection();
      } else {
        handleReconnection();
      }
    });

    newSocket.on('user_status_change', ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (isOnline) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    });
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      setConnectionAttempts(0);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}/${maxReconnectAttempts}`);
      setConnectionAttempts(attemptNumber);
    });

    newSocket.on('reconnect_failed', () => {
      console.log(' All reconnection attempts failed');
      setConnectionAttempts(maxReconnectAttempts);
    });

    setSocket(newSocket);
    return newSocket;
  }, [socket]);

  // Handle reconnection logic
  const handleReconnection = useCallback(() => {
    if (connectionAttempts >= maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached, stopping retries');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const jitter = Math.random() * 1000;
    const delay = Math.min(reconnectDelay * Math.pow(1.5, connectionAttempts) + jitter, 30000);
    
    console.log(` Scheduling reconnection in ${Math.round(delay)}ms (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setConnectionAttempts(prev => prev + 1);
      initializeSocket();
    }, delay);
  }, [connectionAttempts, initializeSocket]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      initializeSocket();
    }

    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (e.newValue) {
          initializeSocket();
        } else {
          if (socket) {
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        console.log('🔌 Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const joinConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      console.log('joining conversation:', conversationId);
      socket.emit('join_conversation', conversationId);
    }
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId) => {
    if (socket && isConnected) {
      console.log('Leaving conversation:', conversationId);
      socket.emit('leave_conversation', conversationId);
    }
  }, [socket, isConnected]);

  const sendMessage = useCallback((conversationId, content) => {
    if (socket && isConnected) {
      console.log('Sending message to conversation:', conversationId);
      socket.emit('send_message', { conversationId, content });
    } else {
      console.log('Cannot send message: Socket not connected');
      throw new Error('Not connected to server');
    }
  }, [socket, isConnected]);

  const startTyping = useCallback((conversationId) => {
    if (socket && isConnected) {
      socket.emit('typing_start', { conversationId });
    }
  }, [socket, isConnected]);

  const stopTyping = useCallback((conversationId) => {
    if (socket && isConnected) {
      socket.emit('typing_stop', { conversationId });
    }
  }, [socket, isConnected]);

  const markMessageAsRead = useCallback((messageId, conversationId) => {
    if (socket && isConnected) {
      socket.emit('message_read', { messageId, conversationId });
    }
  }, [socket, isConnected]);

  const markMessageAsDelivered = useCallback((messageId, conversationId) => {
    if (socket && isConnected) {
      socket.emit('message_delivered', { messageId, conversationId });
    }
  }, [socket, isConnected]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const forceReconnect = useCallback(() => {
    console.log('Force reconnecting...');
    setConnectionAttempts(0);
    if (socket) {
      socket.disconnect();
    }
    initializeSocket();
  }, [socket, initializeSocket]);

  const getConnectionInfo = useCallback(() => {
    return {
      isConnected,
      connectionAttempts,
      socketId: socket?.id,
      onlineUsersCount: onlineUsers.size
    };
  }, [isConnected, connectionAttempts, socket, onlineUsers]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network back online, attempting to reconnect...');
      if (!isConnected && localStorage.getItem('token')) {
        setConnectionAttempts(0);
        initializeSocket();
      }
    };

    const handleOffline = () => {
      console.log('Network went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, initializeSocket]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const healthCheck = setInterval(() => {
      if (socket && socket.connected) {
        } else if (localStorage.getItem('token')) {

        console.log('🏥 Health check failed, reconnecting...');
        initializeSocket();
      }
    }, 30000); 

    return () => clearInterval(healthCheck);
  }, [socket, isConnected, initializeSocket]);

  return {
    // Connection status
    socket,
    isConnected,
    onlineUsers,
    connectionAttempts,
    
    // Actions
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageAsRead,
    markMessageAsDelivered,
    
    // Utilities
    isUserOnline,
    forceReconnect,
    getConnectionInfo
  };
};

export default useSocket;
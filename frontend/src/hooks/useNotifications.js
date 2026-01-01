import { useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

const useNotifications = (userId, isAuthenticated = false) => {
  const socketRef = useRef(null);
  const isInitializing = useRef(false);

  const initializeSocket = useCallback(() => {
    if (!isAuthenticated || !userId || socketRef.current || isInitializing.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    console.log(' Initializing notifications for user:', userId);
    isInitializing.current = true;

    try {
      const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
      
      socketRef.current = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxHttpBufferSize: 1e6,
        pingTimeout: 60000,
        pingInterval: 25000,
        forceNew: true
      });

      const socket = socketRef.current;

      // Silent connection handling
      socket.on('connect', () => {
        console.log('Notifications connected');
        isInitializing.current = false;
      });

      socket.on('disconnect', (reason) => {
        console.log(' Notifications disconnected:', reason);
        isInitializing.current = false;
      });

      socket.on('reconnect', () => {
        console.log('Notifications reconnected');
        isInitializing.current = false;
      });

      socket.on('connect_error', (error) => {
        console.log(' Notification connection error:', error.message);
        isInitializing.current = false;
      });

      socket.on('newMessage', (data) => {
        console.log('📨 New message notification:', data);
        
        if (data.message && data.message.sender && data.message.sender._id !== userId) {
          const senderName = data.message.sender.name || 'Someone';
          const messagePreview = data.message.content?.text || 'New message';
          
          if (!window.location.pathname.includes('/messages')) {
            showDesktopNotification(senderName, messagePreview);
            playNotificationSound();
          }

          if (document.hidden) {
            updatePageTitle(`New message from ${senderName}`);
          }
        }
      });

      socket.on('newConversation', (data) => {
        console.log('New conversation notification:', data);
        
        const senderName = data.message?.sender?.name || 'Someone';
        
        if (!window.location.pathname.includes('/messages')) {
          showDesktopNotification(
            'New Conversation', 
            `${senderName} started a conversation with you`
          );
          playSuccessSound();
        }
      });
      socket.on('foodReserved', (data) => {
        console.log('Food reserved notification:', data);
        
        showDesktopNotification(
          'Food Reserved!',
          `${data.requesterName} reserved your "${data.foodTitle}"`
        );
        playSuccessSound();
      });

      socket.on('foodStatusUpdate', (data) => {
        console.log('Food status update:', data);
        
        const statusMessages = {
          collected: 'Your food was collected successfully!',
          expired: 'Your food listing has expired',
          available: 'Your food is available again'
        };
        
        const message = statusMessages[data.newStatus];
        if (message) {
          showDesktopNotification('Food Update', message);
          if (data.newStatus === 'collected') {
            playSuccessSound();
          }
        }
      });

      return socket;
    } catch (error) {
      console.error('Notification initialization error:', error);
      isInitializing.current = false;
    }
  }, [userId, isAuthenticated]);

  // Clean notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log(' Audio notification not available');
    }
  }, []);

  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.log('Audio notification not available');
    }
  }, []);

  // Disconnect function
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting notifications...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    isInitializing.current = false;
  }, []);

  const showDesktopNotification = useCallback((title, body, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'mealmate-notification',
          requireInteraction: false,
          silent: false,
          ...options
        });

        notification.onclick = () => {
          window.focus();
          if (title.includes('message') || title.includes('conversation')) {
            window.location.href = '/messages';
          }
          notification.close();
        };

        setTimeout(() => {
          notification.close();
        }, 6000);

        return notification;
      } catch (error) {
        console.log('Desktop notification failed:', error.message);
      }
    }
    return null;
  }, []);

  const updatePageTitle = useCallback((message) => {
    const originalTitle = document.title;
    document.title = `💬 ${message}`;
    
    const handleFocus = () => {
      document.title = originalTitle;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    setTimeout(() => {
      if (document.title !== originalTitle) {
        document.title = originalTitle;
      }
    }, 30000);
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      const initTimeout = setTimeout(() => {
        initializeSocket();
      }, 100);

      return () => {
        clearTimeout(initTimeout);
        disconnectSocket();
      };
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, userId, initializeSocket, disconnectSocket]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.log(' Back online');
      if (!socketRef.current || !socketRef.current.connected) {
        setTimeout(() => {
          initializeSocket();
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log('Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initializeSocket]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
    playNotificationSound,
    playSuccessSound,
    showDesktopNotification,
    disconnect: disconnectSocket,
    reconnect: initializeSocket
  };
};

export default useNotifications;
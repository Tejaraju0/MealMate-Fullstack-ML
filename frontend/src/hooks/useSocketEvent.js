import { useEffect, useCallback } from 'react';

export const useSocketEvents = (socket, eventHandlers) => {
  const handleEvent = useCallback((eventName, handler) => {
    if (socket && handler && typeof handler === 'function') {
      socket.on(eventName, handler);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // Register all event handlers
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      handleEvent(eventName, handler);
    });

    // Cleanup function
    return () => {
      Object.keys(eventHandlers).forEach(eventName => {
        socket.off(eventName);
      });
    };
  }, [socket, eventHandlers, handleEvent]);
};

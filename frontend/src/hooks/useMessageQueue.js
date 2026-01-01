import { useState, useEffect, useCallback } from 'react';

export const useMessageQueue = (socket, isConnected) => {
  const [messageQueue, setMessageQueue] = useState([]);

  const queueMessage = useCallback((conversationId, content) => {
    const queuedMessage = {
      id: Date.now() + Math.random(),
      conversationId,
      content,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: 3
    };
    
    setMessageQueue(prev => [...prev, queuedMessage]);
  }, []);

  useEffect(() => {
    if (isConnected && socket && messageQueue.length > 0) {
      console.log('📤 Processing message queue:', messageQueue.length, 'messages');
      
      messageQueue.forEach(queuedMessage => {
        if (queuedMessage.attempts < queuedMessage.maxAttempts) {
          try {
            socket.emit('send_message', {
              conversationId: queuedMessage.conversationId,
              content: queuedMessage.content
            });
            
            setMessageQueue(prev => prev.filter(msg => msg.id !== queuedMessage.id));
            
          } catch (error) {
            console.error(' Failed to send queued message:', error);
            
            setMessageQueue(prev => 
              prev.map(msg => 
                msg.id === queuedMessage.id 
                  ? { ...msg, attempts: msg.attempts + 1 }
                  : msg
              )
            );
          }
        } else {
          console.error('Message failed after max attempts:', queuedMessage);
          setMessageQueue(prev => prev.filter(msg => msg.id !== queuedMessage.id));
        }
      });
    }
  }, [isConnected, socket, messageQueue]);

  return {
    messageQueue,
    queueMessage,
    clearQueue: () => setMessageQueue([])
  };
};
import { useEffect, useRef } from 'react';
import { useDraft } from '../context/DraftContext';

export function useTurnNotification() {
  const { isMyTurn, currentPick } = useDraft();
  const previousTurnRef = useRef(false);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Detect when it becomes user's turn (transition from false to true)
    if (isMyTurn && !previousTurnRef.current) {
      // Play sound
      playNotificationSound();

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🏒 Your Turn to Draft!', {
          body: `Pick #${currentPick?.pick} - Round ${currentPick?.round}`,
          icon: '/hockey-icon.png', // You can add a hockey icon to public folder
          badge: '/hockey-icon.png',
          tag: 'draft-turn', // Prevents duplicate notifications
          requireInteraction: true, // Stays visible until user interacts
        });
      }

      // Show in-page alert as backup
      if (Notification.permission !== 'granted') {
        // Only show alert if notifications are denied/not supported
        console.log('🏒 YOUR TURN! Notifications are disabled. Enable them in your browser settings.');
      }
    }

    // Update previous turn state
    previousTurnRef.current = isMyTurn;
  }, [isMyTurn, currentPick]);
}

function playNotificationSound() {
  try {
    // Create audio context for cross-browser compatibility
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for simple beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound (hockey horn-like)
    oscillator.frequency.value = 440; // A4 note
    oscillator.type = 'sine';
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    // Play
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Second beep for attention
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 554; // C#5 note
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0, audioContext.currentTime);
      gain2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 200);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

/**
 * Apply pending roster swaps every Saturday at 9 AM ET
 * This should be called as part of the daily scoring cron job
 */

import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function applyRosterSwaps() {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Only run on Saturdays
    if (dayOfWeek !== 6) {
      console.log(`⏰ Roster swaps only apply on Saturdays. Today is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
      return { success: true, swapsApplied: 0, message: 'Not Saturday' };
    }
    
    console.log('📅 Saturday detected - applying pending roster swaps...');
    
    // Get all drafted players
    const playersRef = collection(db, 'draftedPlayers');
    const snapshot = await getDocs(playersRef);
    
    let swapsApplied = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const player = docSnapshot.data();
      
      // Check if player has a pending swap
      if (player.pendingSlot) {
        console.log(`Applying swap: ${player.name} → ${player.pendingSlot}`);
        
        await updateDoc(doc(db, 'draftedPlayers', docSnapshot.id), {
          rosterSlot: player.pendingSlot,
          pendingSlot: null,
          lastSwapDate: now.toISOString()
        });
        
        swapsApplied++;
      }
    }
    
    console.log(`✅ Applied ${swapsApplied} roster swaps`);
    
    return {
      success: true,
      swapsApplied,
      message: `Applied ${swapsApplied} roster swaps`
    };
    
  } catch (error) {
    console.error('❌ Error applying roster swaps:', error);
    return {
      success: false,
      swapsApplied: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export for browser console testing
(window as any).applyRosterSwaps = applyRosterSwaps;

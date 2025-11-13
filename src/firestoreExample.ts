// Example file showing how to use Firestore
// Import the db instance from your firebase config
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

// Example: Add a document to a collection
export const addPlayer = async (playerData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'players'), playerData);
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding document: ', error);
    throw error;
  }
};

// Example: Get all documents from a collection
export const getAllPlayers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'players'));
    const players = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return players;
  } catch (error) {
    console.error('Error getting documents: ', error);
    throw error;
  }
};

// Example: Get a single document by ID
export const getPlayer = async (playerId: string) => {
  try {
    const docRef = doc(db, 'players', playerId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.log('No such document!');
      return null;
    }
  } catch (error) {
    console.error('Error getting document: ', error);
    throw error;
  }
};

// Example: Update a document
export const updatePlayer = async (playerId: string, updates: any) => {
  try {
    const docRef = doc(db, 'players', playerId);
    await updateDoc(docRef, updates);
    console.log('Document updated successfully');
  } catch (error) {
    console.error('Error updating document: ', error);
    throw error;
  }
};

// Example: Delete a document
export const deletePlayer = async (playerId: string) => {
  try {
    await deleteDoc(doc(db, 'players', playerId));
    console.log('Document deleted successfully');
  } catch (error) {
    console.error('Error deleting document: ', error);
    throw error;
  }
};

// Example: Query with conditions
export const getPlayersByPosition = async (position: string) => {
  try {
    const q = query(
      collection(db, 'players'),
      where('position', '==', position),
      orderBy('points', 'desc'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(q);
    const players = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return players;
  } catch (error) {
    console.error('Error querying documents: ', error);
    throw error;
  }
};
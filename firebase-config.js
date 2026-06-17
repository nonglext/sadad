/**
 * Firebase Configuration & Initialization (Modular SDK v9+)
 * Used for: username uniqueness validation, user profiles, groups
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    query, 
    where, 
    getDocs,
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase configuration - REPLACE WITH YOUR OWN CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAGmCvBnaStgjRHjDMzVx0RejK9IzgocfI",
  authDomain: "discord-remake-c746b.firebaseapp.com",
  projectId: "discord-remake-c746b",
  storageBucket: "discord-remake-c746b.firebasestorage.app",
  messagingSenderId: "236776282998",
  appId: "1:236776282998:web:ef99db61922e53d04bf857",
  measurementId: "G-L2QBBT0R7Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ====================================================================
// FIRESTORE DATA STRUCTURE
// ====================================================================

/**
 * users collection:
 * {
 *   userId: string (unique ID, matches backend user.id),
 *   username: string (unique, lowercase for lookup),
 *   displayName: string,
 *   avatarUrl: string | null,
 *   bannerUrl: string | null,
 *   badges: string[] (badge IDs from BADGE_REGISTRY),
 *   status: 'online' | 'offline' | 'idle' | 'dnd',
 *   theme: { primary: string, accent: string },
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */

/**
 * groups collection:
 * {
 *   groupId: string (unique ID),
 *   ownerId: string (userId of creator),
 *   name: string,
 *   members: string[] (array of userIds),
 *   avatarUrl: string | null,
 *   createdAt: timestamp
 * }
 */

// ====================================================================
// USERNAME UNIQUENESS VALIDATION
// ====================================================================

/**
 * Check if username already exists in Firestore
 * @param {string} username - Username to check (case-insensitive)
 * @returns {Promise<boolean>} - true if username exists, false otherwise
 */
async function isUsernameTaken(username) {
    try {
        const normalizedUsername = username.toLowerCase().trim();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', normalizedUsername));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('[Firebase] Error checking username:', error);
        // Fallback: assume not taken on error (backend will still validate)
        return false;
    }
}

/**
 * Create user document in Firestore
 * @param {Object} userData - User data object
 * @returns {Promise<void>}
 */
async function createUserDocument(userData) {
    try {
        const { userId, username, displayName, avatarUrl, bannerUrl, badges, status, theme } = userData;
        
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            userId,
            username: username.toLowerCase().trim(),
            displayName: displayName || username,
            avatarUrl: avatarUrl || null,
            bannerUrl: bannerUrl || null,
            badges: badges || ['nitro'], // Default: Nitro badge for all users
            status: status || 'offline',
            theme: theme || { primary: '#5865f2', accent: '#3ba55d' },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log(`[Firebase] User document created: ${userId}`);
    } catch (error) {
        console.error('[Firebase] Error creating user document:', error);
        throw error;
    }
}

/**
 * Update user document in Firestore
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
async function updateUserDocument(userId, updates) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        console.log(`[Firebase] User document updated: ${userId}`);
    } catch (error) {
        console.error('[Firebase] Error updating user document:', error);
        throw error;
    }
}

/**
 * Get user document from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User data or null
 */
async function getUserDocument(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('[Firebase] Error getting user document:', error);
        return null;
    }
}

// ====================================================================
// GROUP MANAGEMENT
// ====================================================================

/**
 * Create group document in Firestore
 * @param {Object} groupData - Group data
 * @returns {Promise<string>} - Group ID
 */
async function createGroupDocument(groupData) {
    try {
        const { ownerId, name, members, avatarUrl } = groupData;
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const groupRef = doc(db, 'groups', groupId);
        await setDoc(groupRef, {
            groupId,
            ownerId,
            name,
            members: members || [ownerId],
            avatarUrl: avatarUrl || null,
            createdAt: serverTimestamp()
        });
        
        console.log(`[Firebase] Group document created: ${groupId}`);
        return groupId;
    } catch (error) {
        console.error('[Firebase] Error creating group document:', error);
        throw error;
    }
}

/**
 * Get group document from Firestore
 * @param {string} groupId - Group ID
 * @returns {Promise<Object|null>} - Group data or null
 */
async function getGroupDocument(groupId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const docSnap = await getDoc(groupRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('[Firebase] Error getting group document:', error);
        return null;
    }
}

/**
 * Add member to group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to add
 * @returns {Promise<void>}
 */
async function addGroupMember(groupId, userId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (!groupSnap.exists()) {
            throw new Error('Group not found');
        }
        
        const groupData = groupSnap.data();
        const members = groupData.members || [];
        
        if (!members.includes(userId)) {
            members.push(userId);
            await updateDoc(groupRef, {
                members,
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('[Firebase] Error adding group member:', error);
        throw error;
    }
}

// ====================================================================
// EXPORTS
// ====================================================================

export {
    db,
    isUsernameTaken,
    createUserDocument,
    updateUserDocument,
    getUserDocument,
    createGroupDocument,
    getGroupDocument,
    addGroupMember
};
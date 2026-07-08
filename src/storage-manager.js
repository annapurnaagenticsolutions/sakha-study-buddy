/**
 * Storage Manager for Sakha Static Agent
 * Handles LocalStorage with quota tracking, cleanup policies, and schema management
 * 
 * Key Features:
 * - Quota monitoring (10MB LocalStorage limit)
 * - Automatic cleanup of old data
 * - Schema versioning and migration
 * - Type-safe storage operations
 */

const STORAGE_KEYS = {
  PROGRESS: 'sakha_progress_v1',
  ENGAGEMENT: 'sakha_engagement_v1',
  GAMIFICATION: 'sakha_gamification_v1',
  SOCIAL: 'sakha_social_v1',
  INTERESTS: 'sakha_interests',
  SESSION_STATE: 'sakha_session_state',
  ARCHIVED_SESSIONS: 'sakha_archived_sessions',
  CURIOSITY_RATINGS: 'sakha_curiosity_ratings',
  VOICE_TIP_SHOWN: 'sakha_voice_tip_shown',
  INTERESTS_SELECTED: 'sakha_interests_selected',
  OFFLINE_ENABLED: 'sakha_offline_enabled',
  PREFERRED_INPUT_MODE: 'preferred_input_mode'
};

const MAX_STORAGE_MB = 10; // LocalStorage limit
const WARNING_THRESHOLD_MB = 8; // Start cleanup at 80%
const MAX_ARCHIVED_SESSIONS = 10;
const MAX_ACTIVITY_FEED_ITEMS = 20;
const SESSION_EXPIRY_HOURS = 24;
const ARCHIVED_SESSION_EXPIRY_DAYS = 30;

class StorageManager {
  constructor() {
    this.keys = STORAGE_KEYS;
    this.initializeSchemas();
  }

  /**
   * Initialize default schemas if not present
   */
  initializeSchemas() {
    // Engagement schema
    if (!this.get(STORAGE_KEYS.ENGAGEMENT)) {
      this.set(STORAGE_KEYS.ENGAGEMENT, {
        lastStudiedDate: null,
        streakCount: 0,
        streakActive: false,
        constellationCache: {}
      });
    }

    // Gamification schema
    if (!this.get(STORAGE_KEYS.GAMIFICATION)) {
      this.set(STORAGE_KEYS.GAMIFICATION, {
        badges: [],
        xp: 0,
        level: 1,
        currentChallenge: null,
        challengeHistory: []
      });
    }

    // Social schema
    if (!this.get(STORAGE_KEYS.SOCIAL)) {
      this.set(STORAGE_KEYS.SOCIAL, {
        activityFeed: [],
        lastFeedRefresh: null,
        peerSessions: [],
        shareCount: 0
      });
    }

    // Interests
    if (!this.get(STORAGE_KEYS.INTERESTS)) {
      this.set(STORAGE_KEYS.INTERESTS, []);
    }

    // Curiosity ratings
    if (!this.get(STORAGE_KEYS.CURIOSITY_RATINGS)) {
      this.set(STORAGE_KEYS.CURIOSITY_RATINGS, {});
    }

    // Archived sessions
    if (!this.get(STORAGE_KEYS.ARCHIVED_SESSIONS)) {
      this.set(STORAGE_KEYS.ARCHIVED_SESSIONS, []);
    }
  }

  /**
   * Get value from LocalStorage
   * @param {string} key - Storage key
   * @returns {any} Parsed value or null
   */
  get(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in LocalStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      // Check quota before writing
      const estimatedSize = this.estimateSize(value);
      if (this.getCurrentUsageMB() + estimatedSize > MAX_STORAGE_MB) {
        console.warn('Storage quota approaching limit, running cleanup...');
        this.cleanup();
      }

      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded, forcing cleanup...');
        this.cleanup(true); // Force aggressive cleanup
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (retryError) {
          console.error('Failed to save after cleanup:', retryError);
          return false;
        }
      }
      console.error(`Error writing ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove value from LocalStorage
   * @param {string} key - Storage key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
    }
  }

  /**
   * Calculate current LocalStorage usage in MB
   * @returns {number} Usage in MB
   */
  getCurrentUsageMB() {
    let total = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          if (value) {
            total += value.length + key.length;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating storage usage:', error);
    }
    // Convert to MB (UTF-16 = 2 bytes per character)
    return (total * 2) / (1024 * 1024);
  }

  /**
   * Estimate size of a value in MB
   * @param {any} value - Value to estimate
   * @returns {number} Size in MB
   */
  estimateSize(value) {
    const str = JSON.stringify(value);
    return (str.length * 2) / (1024 * 1024);
  }

  /**
   * Get storage quota information
   * @returns {Object} Quota information
   */
  getQuotaInfo() {
    const usedMB = this.getCurrentUsageMB();
    const percentUsed = (usedMB / MAX_STORAGE_MB) * 100;
    const needsCleanup = usedMB > WARNING_THRESHOLD_MB;

    return {
      usedMB: usedMB.toFixed(2),
      maxMB: MAX_STORAGE_MB,
      percentUsed: percentUsed.toFixed(1),
      needsCleanup,
      status: needsCleanup ? 'warning' : 'ok'
    };
  }

  /**
   * Clean up old data to free space
   * @param {boolean} aggressive - If true, use aggressive cleanup
   */
  cleanup(aggressive = false) {
    console.log('Running storage cleanup...');
    const beforeSize = this.getCurrentUsageMB();

    // 1. Clean expired sessions
    this.cleanExpiredSessions();

    // 2. Trim archived sessions to max limit
    this.trimArchivedSessions(aggressive ? 5 : MAX_ARCHIVED_SESSIONS);

    // 3. Trim activity feed
    this.trimActivityFeed(aggressive ? 10 : MAX_ACTIVITY_FEED_ITEMS);

    // 4. Clean old peer sessions
    this.cleanOldPeerSessions();

    // 5. If aggressive, trim challenge history
    if (aggressive) {
      this.trimChallengeHistory(5);
    }

    const afterSize = this.getCurrentUsageMB();
    const freedMB = beforeSize - afterSize;
    console.log(`Cleanup freed ${freedMB.toFixed(2)} MB`);

    return {
      beforeMB: beforeSize.toFixed(2),
      afterMB: afterSize.toFixed(2),
      freedMB: freedMB.toFixed(2)
    };
  }

  /**
   * Clean expired session states
   */
  cleanExpiredSessions() {
    const session = this.get(STORAGE_KEYS.SESSION_STATE);
    if (session && session.expiresAt) {
      if (Date.now() > session.expiresAt) {
        console.log('Removing expired session');
        this.remove(STORAGE_KEYS.SESSION_STATE);
      }
    }
  }

  /**
   * Trim archived sessions to max limit
   * @param {number} maxSessions - Maximum sessions to keep
   */
  trimArchivedSessions(maxSessions = MAX_ARCHIVED_SESSIONS) {
    const archived = this.get(STORAGE_KEYS.ARCHIVED_SESSIONS) || [];
    
    // Remove sessions older than 30 days
    const cutoffTime = Date.now() - (ARCHIVED_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    let filtered = archived.filter(s => s.lastActive > cutoffTime);

    // Keep only most recent maxSessions
    if (filtered.length > maxSessions) {
      filtered.sort((a, b) => b.lastActive - a.lastActive);
      filtered = filtered.slice(0, maxSessions);
    }

    this.set(STORAGE_KEYS.ARCHIVED_SESSIONS, filtered);
  }

  /**
   * Trim activity feed to max items
   * @param {number} maxItems - Maximum items to keep
   */
  trimActivityFeed(maxItems = MAX_ACTIVITY_FEED_ITEMS) {
    const social = this.get(STORAGE_KEYS.SOCIAL);
    if (social && social.activityFeed) {
      if (social.activityFeed.length > maxItems) {
        social.activityFeed.sort((a, b) => b.timestamp - a.timestamp);
        social.activityFeed = social.activityFeed.slice(0, maxItems);
        this.set(STORAGE_KEYS.SOCIAL, social);
      }
    }
  }

  /**
   * Clean old peer sessions
   */
  cleanOldPeerSessions() {
    const social = this.get(STORAGE_KEYS.SOCIAL);
    if (social && social.peerSessions) {
      const now = Date.now();
      social.peerSessions = social.peerSessions.filter(s => s.expiresAt > now);
      this.set(STORAGE_KEYS.SOCIAL, social);
    }
  }

  /**
   * Trim challenge history
   * @param {number} maxHistory - Maximum history items to keep
   */
  trimChallengeHistory(maxHistory = 10) {
    const gamification = this.get(STORAGE_KEYS.GAMIFICATION);
    if (gamification && gamification.challengeHistory) {
      if (gamification.challengeHistory.length > maxHistory) {
        gamification.challengeHistory = gamification.challengeHistory.slice(-maxHistory);
        this.set(STORAGE_KEYS.GAMIFICATION, gamification);
      }
    }
  }

  /**
   * Migrate existing progress data to new schema
   * @returns {boolean} Migration success
   */
  migrateProgressData() {
    console.log('Checking for data migration...');
    
    const oldProgress = this.get(STORAGE_KEYS.PROGRESS);
    if (!oldProgress) {
      console.log('No existing progress data to migrate');
      return true;
    }

    try {
      // Check if already migrated
      const engagement = this.get(STORAGE_KEYS.ENGAGEMENT);
      if (engagement && engagement.constellationCache && Object.keys(engagement.constellationCache).length > 0) {
        console.log('Data already migrated');
        return true;
      }

      console.log('Migrating progress data to new schema...');

      // Build constellation cache from tracked concepts
      const constellationCache = {};
      
      if (oldProgress.tracked && Array.isArray(oldProgress.tracked)) {
        oldProgress.tracked.forEach(entry => {
          const subject = entry.subject || 'General';
          if (!constellationCache[subject]) {
            constellationCache[subject] = [];
          }

          // Calculate stars from mastery
          let stars = 1;
          if (entry.mastery >= 0.7) stars = 3;
          else if (entry.mastery >= 0.5) stars = 2;

          constellationCache[subject].push({
            topicId: entry.id,
            title: entry.title,
            stars: stars,
            mastery: entry.mastery,
            completedAt: entry.lastStudied || new Date().toISOString()
          });
        });
      }

      // Update engagement schema
      const lastEntry = oldProgress.tracked && oldProgress.tracked.length > 0 
        ? oldProgress.tracked[oldProgress.tracked.length - 1] 
        : null;

      const updatedEngagement = {
        lastStudiedDate: lastEntry ? lastEntry.lastStudied : null,
        streakCount: 1, // Start fresh or calculate from dates
        streakActive: false,
        constellationCache: constellationCache
      };

      this.set(STORAGE_KEYS.ENGAGEMENT, updatedEngagement);
      console.log('Migration completed successfully');
      return true;

    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  /**
   * Archive current session
   * @param {Object} session - Session to archive
   */
  archiveSession(session) {
    const archived = this.get(STORAGE_KEYS.ARCHIVED_SESSIONS) || [];
    archived.push({
      ...session,
      archivedAt: Date.now()
    });
    
    // Trim to max limit
    if (archived.length > MAX_ARCHIVED_SESSIONS) {
      archived.sort((a, b) => b.lastActive - a.lastActive);
      archived.splice(MAX_ARCHIVED_SESSIONS);
    }
    
    this.set(STORAGE_KEYS.ARCHIVED_SESSIONS, archived);
    this.remove(STORAGE_KEYS.SESSION_STATE);
  }

  /**
   * Get diagnostic information
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    const quota = this.getQuotaInfo();
    const keys = {};
    
    for (let key in STORAGE_KEYS) {
      const storageKey = STORAGE_KEYS[key];
      const data = this.get(storageKey);
      keys[key] = {
        exists: data !== null,
        size: data ? this.estimateSize(data).toFixed(3) + ' MB' : '0 MB',
        type: data ? typeof data : 'null'
      };
    }

    return {
      quota,
      keys,
      totalKeys: Object.keys(localStorage).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all Sakha data (use with caution)
   * @param {boolean} keepInterests - If true, preserve interest tags
   */
  clearAll(keepInterests = true) {
    const interests = keepInterests ? this.get(STORAGE_KEYS.INTERESTS) : null;
    
    for (let key in STORAGE_KEYS) {
      this.remove(STORAGE_KEYS[key]);
    }

    if (keepInterests && interests) {
      this.set(STORAGE_KEYS.INTERESTS, interests);
    }

    // Reinitialize schemas
    this.initializeSchemas();
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager, storageManager, STORAGE_KEYS };
}

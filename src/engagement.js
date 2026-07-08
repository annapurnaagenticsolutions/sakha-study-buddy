/**
 * Engagement Manager for Sakha Static Agent
 * Handles constellation, recommendations, streak logic, and visual concept map
 * 
 * Key Features:
 * - Star calculation based on mastery levels
 * - Streak tracking with date comparison
 * - Progress constellation grouping by subject
 * - Phase progress for visual concept map
 * - Pure functions (no side effects, deterministic)
 */

/**
 * Calculate star rating based on mastery level
 * @param {number} mastery - Mastery level (0.0 to 1.0)
 * @returns {number} Star count (1, 2, or 3)
 * 
 * Property: mastery < 0.5 → 1 star, 0.5 ≤ mastery ≤ 0.7 → 2 stars, mastery > 0.7 → 3 stars
 */
function calculateStars(mastery) {
  // Validate input
  if (typeof mastery !== 'number' || isNaN(mastery)) {
    throw new Error('Mastery must be a valid number');
  }
  
  // Clamp mastery to valid range [0, 1]
  const clampedMastery = Math.max(0, Math.min(1, mastery));
  
  if (clampedMastery < 0.5) {
    return 1;
  } else if (clampedMastery <= 0.7) {
    return 2;
  } else {
    return 3;
  }
}

/**
 * Calculate current streak based on last studied date
 * @param {string|null} lastStudiedDate - ISO date string of last study session
 * @param {Date} currentDate - Current date (defaults to now, injectable for testing)
 * @returns {Object} { streakCount: number, streakActive: boolean }
 * 
 * Logic: Increments if gap ≤ 1 day, resets if gap > 1 day
 * Handles timezone changes and midnight boundaries
 */
function calculateStreak(lastStudiedDate, currentDate = new Date()) {
  // No previous study date - start new streak
  if (!lastStudiedDate) {
    return { streakCount: 0, streakActive: false };
  }

  try {
    const lastDate = new Date(lastStudiedDate);
    const current = new Date(currentDate);

    // Normalize to start of day (midnight) in local timezone
    const normalizeToMidnight = (date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };

    const lastMidnight = normalizeToMidnight(lastDate);
    const currentMidnight = normalizeToMidnight(current);

    // Calculate day difference
    const daysDiff = Math.floor((currentMidnight - lastMidnight) / (1000 * 60 * 60 * 24));

    // Same day - streak continues (no increment)
    if (daysDiff === 0) {
      return { streakCount: 0, streakActive: true, message: 'same-day' };
    }

    // Next day (≤1 day gap) - streak continues and increments
    if (daysDiff === 1) {
      return { streakCount: 1, streakActive: true, message: 'increment' };
    }

    // Gap > 1 day - streak broken, reset
    return { streakCount: 0, streakActive: false, message: 'reset' };

  } catch (error) {
    console.error('Error calculating streak:', error);
    return { streakCount: 0, streakActive: false };
  }
}

/**
 * Get progress constellation grouped by subject
 * @param {Object} progressState - Progress data from LocalStorage
 * @returns {Object} Constellation data grouped by subject
 * 
 * Format: { Physics: [{topicId, title, stars, date, mastery}], Math: [...] }
 * Property: All topics appear exactly once, grouped by subject
 */
function getProgressConstellation(progressState) {
  if (!progressState || typeof progressState !== 'object') {
    return {};
  }

  const constellation = {};

  // Handle both old format (tracked array) and new format (constellationCache)
  if (progressState.constellationCache) {
    // New format - already grouped
    return { ...progressState.constellationCache };
  }

  // Old format - build from tracked array
  if (progressState.tracked && Array.isArray(progressState.tracked)) {
    progressState.tracked.forEach(entry => {
      if (!entry.id) return; // Skip invalid entries

      const subject = entry.subject || 'General';
      
      if (!constellation[subject]) {
        constellation[subject] = [];
      }

      constellation[subject].push({
        topicId: entry.id,
        title: entry.title || 'Untitled',
        stars: calculateStars(entry.mastery || 0),
        mastery: entry.mastery || 0,
        date: entry.lastStudied || entry.completedAt || new Date().toISOString()
      });
    });
  }

  return constellation;
}

/**
 * Get phase progress for visual concept map
 * @param {string} currentPhase - Current learning phase
 * @returns {Object} Phase progress data
 * 
 * Format: { completed: ['hook', 'predict'], current: 'discuss', remaining: ['practice', 'teach_back'] }
 * Property: Phases always in order: Hook → Predict → Discuss → Practice → Teach Back
 */
function getPhaseProgress(currentPhase) {
  const PHASES = ['hook', 'predict', 'discuss', 'practice', 'teach_back'];
  const PHASE_TIMES = {
    hook: 2,
    predict: 3,
    discuss: 5,
    practice: 8,
    teach_back: 5
  };

  // Validate current phase
  if (!currentPhase || !PHASES.includes(currentPhase.toLowerCase())) {
    return {
      completed: [],
      current: PHASES[0],
      remaining: PHASES.slice(1),
      phases: PHASES,
      timeEstimates: PHASE_TIMES,
      totalTime: 23
    };
  }

  const normalizedPhase = currentPhase.toLowerCase();
  const currentIndex = PHASES.indexOf(normalizedPhase);

  return {
    completed: PHASES.slice(0, currentIndex),
    current: normalizedPhase,
    remaining: PHASES.slice(currentIndex + 1),
    phases: PHASES,
    timeEstimates: PHASE_TIMES,
    totalTime: Object.values(PHASE_TIMES).reduce((sum, time) => sum + time, 0)
  };
}

/**
 * Generate topic recommendations based on progress and interests
 * @param {Object} progressState - User's progress data
 * @param {Array<string>} interestTags - User's interest tags
 * @param {Array<Object>} conceptIndex - Full concept index
 * @param {number} count - Number of recommendations to generate (default: 4)
 * @returns {Array<Object>} Recommended topics with scores and reasons
 * 
 * Priority: same subject (next level) > related subjects > interest match
 * Property: No duplicate topics in recommendations
 */
function generateRecommendations(progressState, interestTags = [], conceptIndex = [], count = 4) {
  if (!Array.isArray(conceptIndex) || conceptIndex.length === 0) {
    return [];
  }

  // Get completed topic IDs
  const completedIds = new Set();
  if (progressState) {
    if (progressState.tracked && Array.isArray(progressState.tracked)) {
      progressState.tracked.forEach(entry => completedIds.add(entry.id));
    }
    if (progressState.constellationCache) {
      Object.values(progressState.constellationCache).forEach(subjectTopics => {
        if (Array.isArray(subjectTopics)) {
          subjectTopics.forEach(topic => completedIds.add(topic.topicId));
        }
      });
    }
  }

  // Get last completed topic
  let lastTopic = null;
  if (progressState && progressState.tracked && progressState.tracked.length > 0) {
    lastTopic = progressState.tracked[progressState.tracked.length - 1];
  }

  // Score each topic
  const scoredTopics = conceptIndex
    .filter(topic => !completedIds.has(topic.id)) // Filter out completed
    .map(topic => {
      let score = 0;
      const reasons = [];

      // Priority 1: Same subject as last topic (highest score)
      if (lastTopic && topic.subject === lastTopic.subject) {
        score += 100;
        reasons.push('Continue ' + topic.subject);
      }

      // Priority 2: Related subjects (medium score)
      if (lastTopic && topic.related_concepts && Array.isArray(topic.related_concepts)) {
        if (topic.related_concepts.includes(lastTopic.id)) {
          score += 50;
          reasons.push('Related to previous topic');
        }
      }

      // Priority 3: Interest match (lower score, but still relevant)
      if (topic.interest_tags && Array.isArray(topic.interest_tags) && Array.isArray(interestTags)) {
        const matchingTags = topic.interest_tags.filter(tag => interestTags.includes(tag));
        if (matchingTags.length > 0) {
          score += matchingTags.length * 10;
          reasons.push('Matches your interests: ' + matchingTags.join(', '));
        }
      }

      // Bonus: Higher curiosity score
      if (topic.curiosity_score) {
        score += topic.curiosity_score;
      }

      return {
        ...topic,
        recommendationScore: score,
        recommendationReasons: reasons
      };
    });

  // Sort by score and take top N
  scoredTopics.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // If no scored topics (new user), return popular fallback
  const recommendations = scoredTopics.slice(0, count);
  
  if (recommendations.length === 0 || recommendations.every(t => t.recommendationScore === 0)) {
    // Fallback: Return topics with highest curiosity scores
    const popular = conceptIndex
      .filter(topic => !completedIds.has(topic.id))
      .sort((a, b) => (b.curiosity_score || 3) - (a.curiosity_score || 3))
      .slice(0, count)
      .map(topic => ({
        ...topic,
        recommendationScore: topic.curiosity_score || 3,
        recommendationReasons: ['Popular right now']
      }));
    
    return popular;
  }

  return recommendations;
}

/**
 * EngagementManager class - Main interface for engagement features
 */
class EngagementManager {
  constructor(storageKey = 'sakha_engagement_v1') {
    this.storageKey = storageKey;
    this.state = this.loadState();
  }

  /**
   * Load state from LocalStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading engagement state:', error);
    }

    // Default state
    return {
      lastStudiedDate: null,
      streakCount: 0,
      streakActive: false,
      constellationCache: {}
    };
  }

  /**
   * Save state to LocalStorage
   */
  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      return true;
    } catch (error) {
      console.error('Error saving engagement state:', error);
      return false;
    }
  }

  /**
   * Update streak and last studied date
   * @param {Date} studyDate - Date of study session (defaults to now)
   */
  updateStreak(studyDate = new Date()) {
    const streakResult = calculateStreak(this.state.lastStudiedDate, studyDate);
    
    // Update streak count
    if (streakResult.message === 'increment') {
      this.state.streakCount += 1;
      this.state.streakActive = true;
    } else if (streakResult.message === 'reset') {
      this.state.streakCount = 1; // Start new streak
      this.state.streakActive = true;
    } else if (streakResult.message === 'same-day') {
      // Same day - no change to count, but active
      this.state.streakActive = true;
    }

    // Update last studied date
    this.state.lastStudiedDate = studyDate.toISOString();
    this.saveState();

    return {
      streakCount: this.state.streakCount,
      streakActive: this.state.streakActive
    };
  }

  /**
   * Get current streak
   */
  getStreak() {
    const streakResult = calculateStreak(this.state.lastStudiedDate);
    return {
      streakCount: this.state.streakCount,
      streakActive: streakResult.streakActive
    };
  }

  /**
   * Add completed topic to constellation
   * @param {Object} topic - Topic data
   */
  addToConstellation(topic) {
    const { id, title, subject = 'General', mastery = 0 } = topic;
    
    if (!this.state.constellationCache[subject]) {
      this.state.constellationCache[subject] = [];
    }

    // Check if topic already exists
    const existingIndex = this.state.constellationCache[subject]
      .findIndex(t => t.topicId === id);

    const topicData = {
      topicId: id,
      title: title,
      stars: calculateStars(mastery),
      mastery: mastery,
      date: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update existing
      this.state.constellationCache[subject][existingIndex] = topicData;
    } else {
      // Add new
      this.state.constellationCache[subject].push(topicData);
    }

    this.saveState();
  }

  /**
   * Get progress constellation
   */
  getConstellation() {
    return getProgressConstellation(this.state);
  }

  /**
   * Get phase progress for concept map
   */
  getPhaseProgress(currentPhase) {
    return getPhaseProgress(currentPhase);
  }

  /**
   * Generate recommendations
   */
  getRecommendations(progressState, interestTags, conceptIndex, count = 4) {
    return generateRecommendations(progressState, interestTags, conceptIndex, count);
  }
}

// Export functions and class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EngagementManager,
    calculateStars,
    calculateStreak,
    getProgressConstellation,
    getPhaseProgress,
    generateRecommendations
  };
}

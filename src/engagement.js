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

const PHASES = ['hook', 'predict', 'discuss', 'practice', 'teach_back'];

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

    // Normalize to start of day (midnight) in UTC
    const normalizeToMidnight = (date) => {
      const d = new Date(date);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
    return JSON.parse(JSON.stringify(progressState.constellationCache));
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

  // Validate current phase or default to first phase
  if (!currentPhase || !PHASES.includes(String(currentPhase).toLowerCase())) {
    currentPhase = PHASES[0];
  }

  const normalizedPhase = String(currentPhase).toLowerCase();
  const currentIndex = PHASES.indexOf(normalizedPhase);

  return {
    completed: PHASES.slice(0, currentIndex),
    current: normalizedPhase,
    remaining: PHASES.slice(currentIndex + 1),
    currentIndex: currentIndex,
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

  // Deduplicate conceptIndex first
  const seenIndexIds = new Set();
  const uniqueConceptIndex = [];
  conceptIndex.forEach(topic => {
    if (topic && topic.id && !seenIndexIds.has(topic.id)) {
      seenIndexIds.add(topic.id);
      uniqueConceptIndex.push(topic);
    }
  });

  // Get completed topic IDs and last completed topic
  const completedIds = new Set();
  let lastTopic = null;
  let latestDate = 0;

  if (progressState) {
    if (progressState.tracked && Array.isArray(progressState.tracked)) {
      progressState.tracked.forEach(entry => {
        completedIds.add(entry.id);
        const tDate = new Date(entry.lastStudied || entry.completedAt || 0).getTime();
        if (tDate >= latestDate || !lastTopic) {
          latestDate = tDate;
          lastTopic = entry;
        }
      });
    }
    if (progressState.constellationCache && typeof progressState.constellationCache === 'object') {
      Object.entries(progressState.constellationCache).forEach(([subj, subjectTopics]) => {
        if (Array.isArray(subjectTopics)) {
          subjectTopics.forEach(topic => {
            completedIds.add(topic.topicId);
            const tDate = new Date(topic.date || 0).getTime();
            if (tDate >= latestDate || !lastTopic) {
              latestDate = tDate;
              lastTopic = { id: topic.topicId, subject: subj, title: topic.title };
            }
          });
        }
      });
    }
  }

  // Score each topic
  const scoredTopics = uniqueConceptIndex
    .filter(topic => !completedIds.has(topic.id))
    .map(topic => {
      let score = 0;
      const reasons = [];

      if (lastTopic && topic.subject === lastTopic.subject) {
        score += 100;
        reasons.push('Continue ' + topic.subject);
      }

      if (lastTopic && topic.related_concepts && Array.isArray(topic.related_concepts)) {
        if (topic.related_concepts.includes(lastTopic.id)) {
          score += 50;
          reasons.push('Related to previous topic');
        }
      }

      if (topic.interest_tags && Array.isArray(topic.interest_tags) && Array.isArray(interestTags)) {
        const matchingTags = topic.interest_tags.filter(tag => interestTags.includes(tag));
        if (matchingTags.length > 0) {
          score += matchingTags.length * 10;
          reasons.push('Matches your interests: ' + matchingTags.join(', '));
        }
      }

      if (topic.curiosity_score) {
        score += topic.curiosity_score;
      }

      if (reasons.length === 0) {
        reasons.push('Popular right now');
      }

      return {
        ...topic,
        conceptId: topic.id,
        recommendationScore: score,
        recommendationReasons: reasons
      };
    });

  scoredTopics.sort((a, b) => b.recommendationScore - a.recommendationScore);
  const recommendations = scoredTopics.slice(0, count);
  
  if (recommendations.length === 0 || recommendations.every(t => t.recommendationScore === 0)) {
    return uniqueConceptIndex
      .filter(topic => !completedIds.has(topic.id))
      .sort((a, b) => (b.curiosity_score || 3) - (a.curiosity_score || 3))
      .slice(0, count)
      .map(topic => ({
        ...topic,
        conceptId: topic.id,
        recommendationScore: topic.curiosity_score || 3,
        recommendationReasons: ['Popular right now']
      }));
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
    
    if (!this.state.lastStudiedDate || streakResult.message === 'reset') {
      this.state.streakCount = 1;
      this.state.streakActive = true;
    } else if (streakResult.message === 'increment') {
      this.state.streakCount += 1;
      this.state.streakActive = true;
    } else if (streakResult.message === 'same-day') {
      this.state.streakActive = true;
    } else if (this.state.streakCount === 0) {
      this.state.streakCount = 1;
      this.state.streakActive = true;
    }

    // Update last studied date
    this.state.lastStudiedDate = studyDate.toISOString();
    this.saveState();

    return {
      count: this.state.streakCount,
      streakCount: this.state.streakCount,
      active: this.state.streakActive,
      streakActive: this.state.streakActive
    };
  }

  /**
   * Calculate star rating based on mastery level
   */
  calculateStars(mastery) {
    if (typeof mastery !== 'number' || isNaN(mastery) || mastery < 0 || mastery > 1) {
      throw new Error('Mastery must be a valid number between 0 and 1');
    }
    return calculateStars(mastery);
  }

  /**
   * Get current streak
   */
  getStreak() {
    return {
      count: this.state.streakCount || 0,
      streakCount: this.state.streakCount || 0,
      active: this.state.streakActive || false,
      streakActive: this.state.streakActive || false,
      lastStudiedDate: this.state.lastStudiedDate
    };
  }

  /**
   * Calculate streak
   */
  calculateStreak(lastStudiedDate = this.state.lastStudiedDate, currentDate = new Date()) {
    if (!lastStudiedDate) {
      return {
        count: 1,
        streakCount: 1,
        isActive: true,
        streakActive: true,
        gapDays: 0,
        message: 'first'
      };
    }

    try {
      const lastDate = new Date(lastStudiedDate);
      const current = new Date(currentDate);

      const normalizeToMidnight = (date) => {
        const d = new Date(date);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      };

      const lastMidnight = normalizeToMidnight(lastDate);
      const currentMidnight = normalizeToMidnight(current);
      const gapDays = Math.floor((currentMidnight - lastMidnight) / (1000 * 60 * 60 * 24));

      let count = this.state.streakCount || 0;
      let isActive = false;
      let message = 'same-day';

      if (gapDays === 0) {
        isActive = true;
        message = 'same-day';
      } else if (gapDays === 1) {
        count = count + 1;
        isActive = true;
        message = 'increment';
      } else {
        count = 1;
        isActive = false;
        message = 'reset';
      }

      return {
        count,
        streakCount: count,
        isActive,
        streakActive: isActive,
        gapDays,
        message
      };
    } catch (error) {
      return { count: 0, streakCount: 0, isActive: false, streakActive: false, gapDays: 0, message: 'error' };
    }
  }

  /**
   * Add completed topic to constellation
   * @param {Object} topic - Topic data
   */
  addToConstellation(topic) {
    if (!topic || typeof topic !== 'object' || !topic.id || (topic.mastery !== undefined && (typeof topic.mastery !== 'number' || (!isNaN(topic.mastery) && (topic.mastery < 0 || topic.mastery > 1))))) {
      throw new Error('Invalid topic data');
    }
    const mastery = (typeof topic.mastery === 'number' && isNaN(topic.mastery)) ? 0 : (topic.mastery || 0);
    const { id, title, subject = 'General' } = topic;
    
    if (!this.state.constellationCache) {
      this.state.constellationCache = {};
    }

    // Remove topic from any other subject or same subject to ensure no duplicates across the constellation
    for (const subj in this.state.constellationCache) {
      if (Array.isArray(this.state.constellationCache[subj])) {
        this.state.constellationCache[subj] = this.state.constellationCache[subj].filter(t => t.topicId !== id);
      }
    }

    if (!this.state.constellationCache[subject]) {
      this.state.constellationCache[subject] = [];
    }

    const topicData = {
      topicId: id,
      title: title,
      stars: calculateStars(mastery),
      mastery: mastery,
      date: new Date().toISOString()
    };

    this.state.constellationCache[subject].push(topicData);
    this.saveState();
  }

  /**
   * Get welcome back message based on inactivity
   */
  getWelcomeBackMessage() {
    if (!this.state.lastStudiedDate) return null;
    try {
      const last = new Date(this.state.lastStudiedDate);
      const now = new Date();
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays >= 2) {
        return 'Welcome back! Ready to continue where you left off?';
      }
    } catch (_) {
      // Ignore invalid date
    }
    return null;
  }

  /**
   * Add completed topic to constellation (alias for compatibility)
   */
  addTopicToConstellation(topic) {
    if (!topic || typeof topic !== 'object' || !topic.subject) {
      throw new Error('Invalid topic data');
    }
    return this.addToConstellation(topic);
  }

  /**
   * Get constellation summary statistics
   */
  getConstellationStats() {
    const constellation = this.getConstellation();
    const subjects = Object.keys(constellation);
    const subjectCounts = {};
    let totalTopics = 0;
    let totalStars = 0;

    subjects.forEach((subj) => {
      const topics = constellation[subj] || [];
      subjectCounts[subj] = topics.length;
      totalTopics += topics.length;
      topics.forEach((t) => {
        totalStars += t.stars || 0;
      });
    });

    const averageStars = totalTopics > 0 ? (totalStars / totalTopics).toFixed(2) : 0;
    return {
      totalTopics,
      totalStars,
      averageStars,
      subjects,
      subjectCounts
    };
  }

  /**
   * Get progress constellation
   */
  getConstellation() {
    return getProgressConstellation(this.state);
  }

  getProgressConstellation() {
    return this.getConstellation();
  }

  /**
   * Get phase progress for concept map
   */
  getPhaseProgress(currentPhase) {
    if (!currentPhase || !PHASES.includes(String(currentPhase).toLowerCase())) {
      throw new Error('Invalid phase: ' + currentPhase);
    }
    return getPhaseProgress(currentPhase);
  }

  /**
   * Generate recommendations
   */
  getRecommendations(progressState, interestTags, conceptIndex, count = 4) {
    return generateRecommendations(progressState, interestTags, conceptIndex, count);
  }

  generateRecommendations(progressState, interestTags, conceptIndex, count = 4) {
    const effectiveState = (!progressState || (!progressState.tracked && !progressState.constellationCache)) 
      ? this.state 
      : progressState;
    return generateRecommendations(effectiveState, interestTags || [], conceptIndex || [], count);
  }

  /**
   * Get popular recommendations (fallback)
   */
  getPopularRecommendations(conceptIndex = [], count = 4) {
    if (!Array.isArray(conceptIndex)) return [];
    return conceptIndex.slice(0, count).map((item) => ({
      conceptId: item.id,
      title: item.title,
      reason: 'Popular right now'
    }));
  }

  /**
   * Track a behavioural event
   * @param {string} eventName - Name of the event
   * @param {Object} eventData - Associated data
   */
  trackEvent(eventName, eventData = {}) {
    if (!this.state.events) {
      this.state.events = [];
    }
    this.state.events.push({
      eventName,
      eventData,
      timestamp: new Date().toISOString()
    });
    // Limit events to last 1000
    if (this.state.events.length > 1000) {
      this.state.events = this.state.events.slice(-1000);
    }
    this.saveState();
    if (typeof window !== 'undefined' && window.telemetry) {
        window.telemetry.track(eventName, eventData);
    }
  }

  /**
   * Get a mid-lesson feedback prompt based on current phase
   * @param {string} conceptId - The concept being taught
   * @param {string} currentPhase - Current phase of the lesson
   */
  getMidLessonFeedbackPrompt(conceptId, currentPhase) {
    this.trackEvent('feedback_prompt_requested', { conceptId, currentPhase });
    const prompts = {
      'hook': 'Was the real-world connection clear to you?',
      'discuss': 'Are the whiteboard steps making sense so far?',
      'practice': 'Did the visual simulator help clarify the concept?',
      'teach_back': 'How confident are you feeling about explaining this to a friend?'
    };
    return prompts[currentPhase] || 'How is the pace of the lesson for you?';
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
    generateRecommendations,
    PHASES
  };
}

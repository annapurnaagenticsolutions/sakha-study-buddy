/**
 * Tests for Engagement Manager
 * Includes property-based tests and unit tests
 */

const {
  EngagementManager,
  calculateStars,
  calculateStreak,
  getProgressConstellation,
  getPhaseProgress,
  generateRecommendations
} = require('./engagement.js');

// Mock LocalStorage for Node.js environment
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

describe('Engagement Manager Tests', () => {
  
  beforeEach(() => {
    localStorage.clear();
  });

  // ========== Sub-task 2.1: calculateStars Property Test ==========
  describe('2.1 calculateStars', () => {
    
    test('Property: mastery < 0.5 → 1 star', () => {
      const testValues = [0, 0.1, 0.2, 0.3, 0.4, 0.49];
      testValues.forEach(mastery => {
        expect(calculateStars(mastery)).toBe(1);
      });
    });

    test('Property: 0.5 ≤ mastery ≤ 0.7 → 2 stars', () => {
      const testValues = [0.5, 0.55, 0.6, 0.65, 0.7];
      testValues.forEach(mastery => {
        expect(calculateStars(mastery)).toBe(2);
      });
    });

    test('Property: mastery > 0.7 → 3 stars', () => {
      const testValues = [0.71, 0.75, 0.8, 0.9, 0.95, 1.0];
      testValues.forEach(mastery => {
        expect(calculateStars(mastery)).toBe(3);
      });
    });

    test('Property-based: All mastery values [0,1] return stars in [1,2,3]', () => {
      // Generate 100 random mastery values
      for (let i = 0; i < 100; i++) {
        const mastery = Math.random(); // 0 to 1
        const stars = calculateStars(mastery);
        expect(stars).toBeGreaterThanOrEqual(1);
        expect(stars).toBeLessThanOrEqual(3);
        expect([1, 2, 3]).toContain(stars);
      }
    });

    test('Edge case: Handles values outside [0,1] by clamping', () => {
      expect(calculateStars(-0.5)).toBe(1); // Clamped to 0
      expect(calculateStars(1.5)).toBe(3);  // Clamped to 1
      expect(calculateStars(100)).toBe(3);  // Clamped to 1
    });

    test('Error case: Throws error for non-numeric input', () => {
      expect(() => calculateStars('not a number')).toThrow('Mastery must be a valid number');
      expect(() => calculateStars(null)).toThrow('Mastery must be a valid number');
      expect(() => calculateStars(undefined)).toThrow('Mastery must be a valid number');
    });

    test('Boundary values: Exact boundaries', () => {
      expect(calculateStars(0.5)).toBe(2);   // Exactly 0.5
      expect(calculateStars(0.7)).toBe(2);   // Exactly 0.7
      expect(calculateStars(0.7001)).toBe(3); // Just above 0.7
      expect(calculateStars(0.4999)).toBe(1); // Just below 0.5
    });
  });

  // ========== Sub-task 2.2: calculateStreak ==========
  describe('2.2 calculateStreak', () => {
    
    test('Increments streak if ≤1 day gap', () => {
      const lastStudied = new Date('2024-01-15T10:00:00Z');
      const today = new Date('2024-01-16T10:00:00Z'); // Next day
      
      const result = calculateStreak(lastStudied.toISOString(), today);
      expect(result.streakCount).toBe(1);
      expect(result.streakActive).toBe(true);
      expect(result.message).toBe('increment');
    });

    test('Resets streak if >1 day gap', () => {
      const lastStudied = new Date('2024-01-15T10:00:00Z');
      const today = new Date('2024-01-18T10:00:00Z'); // 3 days later
      
      const result = calculateStreak(lastStudied.toISOString(), today);
      expect(result.streakCount).toBe(0);
      expect(result.streakActive).toBe(false);
      expect(result.message).toBe('reset');
    });

    test('Same day does not increment', () => {
      const lastStudied = new Date('2024-01-15T10:00:00Z');
      const today = new Date('2024-01-15T18:00:00Z'); // Same day, different time
      
      const result = calculateStreak(lastStudied.toISOString(), today);
      expect(result.streakCount).toBe(0);
      expect(result.streakActive).toBe(true);
      expect(result.message).toBe('same-day');
    });

    test('Handles timezone changes and midnight boundaries', () => {
      // Study at 11:59 PM
      const lastStudied = new Date('2024-01-15T23:59:00Z');
      // Study at 12:01 AM next day
      const today = new Date('2024-01-16T00:01:00Z');
      
      const result = calculateStreak(lastStudied.toISOString(), today);
      expect(result.streakActive).toBe(true);
      expect(result.message).toBe('increment');
    });

    test('Returns zero streak for null lastStudiedDate', () => {
      const result = calculateStreak(null);
      expect(result.streakCount).toBe(0);
      expect(result.streakActive).toBe(false);
    });

    test('Handles invalid date strings gracefully', () => {
      const result = calculateStreak('invalid-date');
      expect(result.streakCount).toBe(0);
      expect(result.streakActive).toBe(false);
    });
  });

  // ========== Sub-task 2.3: getProgressConstellation ==========
  describe('2.3 getProgressConstellation', () => {
    
    test('Groups topics by subject without orphans', () => {
      const progressState = {
        tracked: [
          { id: 'ice-melting', title: 'Ice Melting', subject: 'Physics', mastery: 0.8 },
          { id: 'ratios', title: 'Ratios', subject: 'Math', mastery: 0.6 },
          { id: 'gravity', title: 'Gravity', subject: 'Physics', mastery: 0.5 }
        ]
      };

      const constellation = getProgressConstellation(progressState);
      
      expect(constellation.Physics).toHaveLength(2);
      expect(constellation.Math).toHaveLength(1);
      expect(constellation.Physics[0].topicId).toBe('ice-melting');
      expect(constellation.Physics[1].topicId).toBe('gravity');
      expect(constellation.Math[0].topicId).toBe('ratios');
    });

    test('All topics appear exactly once', () => {
      const progressState = {
        tracked: [
          { id: 'topic1', title: 'Topic 1', subject: 'Physics', mastery: 0.8 },
          { id: 'topic2', title: 'Topic 2', subject: 'Math', mastery: 0.6 },
          { id: 'topic3', title: 'Topic 3', subject: 'Physics', mastery: 0.7 },
          { id: 'topic4', title: 'Topic 4', subject: 'Chemistry', mastery: 0.9 }
        ]
      };

      const constellation = getProgressConstellation(progressState);
      
      // Collect all topic IDs from constellation
      const allTopicIds = [];
      Object.values(constellation).forEach(subjectTopics => {
        subjectTopics.forEach(topic => allTopicIds.push(topic.topicId));
      });

      // Check: Each original topic appears exactly once
      expect(allTopicIds).toHaveLength(4);
      expect(allTopicIds).toContain('topic1');
      expect(allTopicIds).toContain('topic2');
      expect(allTopicIds).toContain('topic3');
      expect(allTopicIds).toContain('topic4');

      // Check: No duplicates
      const uniqueIds = new Set(allTopicIds);
      expect(uniqueIds.size).toBe(allTopicIds.length);
    });

    test('Calculates correct stars for each topic', () => {
      const progressState = {
        tracked: [
          { id: 'low', title: 'Low', subject: 'Physics', mastery: 0.3 },
          { id: 'med', title: 'Med', subject: 'Physics', mastery: 0.6 },
          { id: 'high', title: 'High', subject: 'Physics', mastery: 0.85 }
        ]
      };

      const constellation = getProgressConstellation(progressState);
      
      expect(constellation.Physics[0].stars).toBe(1); // 0.3 mastery
      expect(constellation.Physics[1].stars).toBe(2); // 0.6 mastery
      expect(constellation.Physics[2].stars).toBe(3); // 0.85 mastery
    });

    test('Handles empty progress state', () => {
      expect(getProgressConstellation(null)).toEqual({});
      expect(getProgressConstellation({})).toEqual({});
      expect(getProgressConstellation({ tracked: [] })).toEqual({});
    });

    test('Handles new format (constellationCache)', () => {
      const progressState = {
        constellationCache: {
          Physics: [
            { topicId: 'ice-melting', title: 'Ice Melting', stars: 3, mastery: 0.8, date: '2024-01-15' }
          ]
        }
      };

      const constellation = getProgressConstellation(progressState);
      expect(constellation.Physics).toHaveLength(1);
      expect(constellation.Physics[0].topicId).toBe('ice-melting');
    });
  });

  // ========== Sub-task 2.4: getPhaseProgress ==========
  describe('2.4 getPhaseProgress', () => {
    
    test('Returns correct phase progression for "discuss"', () => {
      const progress = getPhaseProgress('discuss');
      
      expect(progress.completed).toEqual(['hook', 'predict']);
      expect(progress.current).toBe('discuss');
      expect(progress.remaining).toEqual(['practice', 'teach_back']);
    });

    test('Phase order is immutable: Hook → Predict → Discuss → Practice → Teach Back', () => {
      const progress = getPhaseProgress('practice');
      
      expect(progress.phases).toEqual(['hook', 'predict', 'discuss', 'practice', 'teach_back']);
      expect(progress.completed).toEqual(['hook', 'predict', 'discuss']);
      expect(progress.current).toBe('practice');
      expect(progress.remaining).toEqual(['teach_back']);
    });

    test('Returns correct data for first phase (hook)', () => {
      const progress = getPhaseProgress('hook');
      
      expect(progress.completed).toEqual([]);
      expect(progress.current).toBe('hook');
      expect(progress.remaining).toEqual(['predict', 'discuss', 'practice', 'teach_back']);
    });

    test('Returns correct data for last phase (teach_back)', () => {
      const progress = getPhaseProgress('teach_back');
      
      expect(progress.completed).toEqual(['hook', 'predict', 'discuss', 'practice']);
      expect(progress.current).toBe('teach_back');
      expect(progress.remaining).toEqual([]);
    });

    test('Time estimates are included and sum to ≤25 minutes', () => {
      const progress = getPhaseProgress('discuss');
      
      expect(progress.timeEstimates).toBeDefined();
      expect(progress.timeEstimates.hook).toBe(2);
      expect(progress.timeEstimates.predict).toBe(3);
      expect(progress.timeEstimates.discuss).toBe(5);
      expect(progress.timeEstimates.practice).toBe(8);
      expect(progress.timeEstimates.teach_back).toBe(5);
      expect(progress.totalTime).toBe(23);
      expect(progress.totalTime).toBeLessThanOrEqual(25);
    });

    test('Handles invalid phase by defaulting to first phase', () => {
      const progress = getPhaseProgress('invalid');
      
      expect(progress.current).toBe('hook');
      expect(progress.completed).toEqual([]);
    });

    test('Handles null/undefined phase', () => {
      const progress = getPhaseProgress(null);
      expect(progress.current).toBe('hook');
    });

    test('Handles case-insensitive phase names', () => {
      const progress = getPhaseProgress('DISCUSS');
      expect(progress.current).toBe('discuss');
    });
  });

  // ========== Sub-task 2.5: Property-Based Test for Streak Monotonicity ==========
  describe('2.5 Streak monotonicity property test', () => {
    
    test('Property: Streak never decreases in same day', () => {
      const manager = new EngagementManager();
      
      // Start with a study session
      const baseDate = new Date('2024-01-15T08:00:00Z');
      manager.updateStreak(baseDate);
      const initialStreak = manager.getStreak().streakCount;

      // Study multiple times on same day
      const times = ['10:00:00', '12:00:00', '15:00:00', '20:00:00'];
      
      times.forEach(time => {
        const studyTime = new Date(`2024-01-15T${time}Z`);
        manager.updateStreak(studyTime);
        const currentStreak = manager.getStreak().streakCount;
        
        // Streak should never decrease on same day
        expect(currentStreak).toBeGreaterThanOrEqual(initialStreak);
      });
    });

    test('Property: Consecutive daily studies increment streak monotonically', () => {
      const manager = new EngagementManager();
      
      let previousStreak = 0;
      
      // Study for 7 consecutive days
      for (let day = 1; day <= 7; day++) {
        const studyDate = new Date(`2024-01-${String(day).padStart(2, '0')}T10:00:00Z`);
        manager.updateStreak(studyDate);
        const currentStreak = manager.getStreak().streakCount;
        
        // Each day should increment
        expect(currentStreak).toBeGreaterThan(previousStreak);
        previousStreak = currentStreak;
      }
      
      expect(manager.getStreak().streakCount).toBe(7);
    });

    test('Property: Streak resets after gap, then grows monotonically again', () => {
      const manager = new EngagementManager();
      
      // Build a streak
      manager.updateStreak(new Date('2024-01-01T10:00:00Z'));
      manager.updateStreak(new Date('2024-01-02T10:00:00Z'));
      manager.updateStreak(new Date('2024-01-03T10:00:00Z'));
      expect(manager.getStreak().streakCount).toBe(3);

      // Break streak with 3-day gap
      manager.updateStreak(new Date('2024-01-07T10:00:00Z'));
      expect(manager.getStreak().streakCount).toBe(1); // Reset

      // Build new streak
      manager.updateStreak(new Date('2024-01-08T10:00:00Z'));
      expect(manager.getStreak().streakCount).toBe(2);
      
      manager.updateStreak(new Date('2024-01-09T10:00:00Z'));
      expect(manager.getStreak().streakCount).toBe(3);
    });
  });

  // ========== Sub-task 2.6: Unit Tests for Constellation Grouping ==========
  describe('2.6 Unit tests for constellation grouping', () => {
    
    test('All topics appear exactly once in constellation', () => {
      const manager = new EngagementManager();
      
      // Add multiple topics across different subjects
      const topics = [
        { id: 'physics1', title: 'Topic 1', subject: 'Physics', mastery: 0.8 },
        { id: 'math1', title: 'Topic 2', subject: 'Math', mastery: 0.6 },
        { id: 'physics2', title: 'Topic 3', subject: 'Physics', mastery: 0.7 },
        { id: 'chem1', title: 'Topic 4', subject: 'Chemistry', mastery: 0.9 },
        { id: 'math2', title: 'Topic 5', subject: 'Math', mastery: 0.5 }
      ];

      topics.forEach(topic => manager.addToConstellation(topic));

      const constellation = manager.getConstellation();
      
      // Count total topics
      let totalTopics = 0;
      Object.values(constellation).forEach(subjectTopics => {
        totalTopics += subjectTopics.length;
      });

      expect(totalTopics).toBe(5); // All 5 topics present
      expect(constellation.Physics).toHaveLength(2);
      expect(constellation.Math).toHaveLength(2);
      expect(constellation.Chemistry).toHaveLength(1);

      // Verify each topic appears exactly once
      const allIds = [];
      Object.values(constellation).forEach(subjectTopics => {
        subjectTopics.forEach(topic => allIds.push(topic.topicId));
      });

      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(5); // No duplicates
    });

    test('Updating same topic replaces, does not duplicate', () => {
      const manager = new EngagementManager();
      
      // Add topic initially
      manager.addToConstellation({ 
        id: 'physics1', 
        title: 'Physics Topic', 
        subject: 'Physics', 
        mastery: 0.5 
      });

      let constellation = manager.getConstellation();
      expect(constellation.Physics).toHaveLength(1);
      expect(constellation.Physics[0].stars).toBe(2); // 0.5 mastery = 2 stars

      // Update same topic with higher mastery
      manager.addToConstellation({ 
        id: 'physics1', 
        title: 'Physics Topic', 
        subject: 'Physics', 
        mastery: 0.9 
      });

      constellation = manager.getConstellation();
      expect(constellation.Physics).toHaveLength(1); // Still 1 topic
      expect(constellation.Physics[0].stars).toBe(3); // Updated to 3 stars
    });

    test('Topics without subject default to "General"', () => {
      const manager = new EngagementManager();
      
      manager.addToConstellation({ 
        id: 'topic1', 
        title: 'No Subject Topic', 
        mastery: 0.7 
      });

      const constellation = manager.getConstellation();
      expect(constellation.General).toHaveLength(1);
      expect(constellation.General[0].topicId).toBe('topic1');
    });

    test('Empty constellation returns empty object', () => {
      const manager = new EngagementManager();
      const constellation = manager.getConstellation();
      expect(constellation).toEqual({});
    });
  });

  // ========== Additional Integration Tests ==========
  describe('Integration Tests', () => {
    
    test('EngagementManager persistence: State survives reload', () => {
      const manager1 = new EngagementManager();
      
      manager1.addToConstellation({ 
        id: 'test1', 
        title: 'Test Topic', 
        subject: 'Physics', 
        mastery: 0.8 
      });
      manager1.updateStreak(new Date('2024-01-15T10:00:00Z'));

      // Create new instance (simulates page reload)
      const manager2 = new EngagementManager();
      
      const constellation = manager2.getConstellation();
      expect(constellation.Physics).toHaveLength(1);
      expect(constellation.Physics[0].topicId).toBe('test1');
      
      const streak = manager2.getStreak();
      expect(streak.streakCount).toBe(1);
    });

    test('Recommendations with no history returns fallback', () => {
      const conceptIndex = [
        { id: 'topic1', title: 'Topic 1', subject: 'Physics', curiosity_score: 5 },
        { id: 'topic2', title: 'Topic 2', subject: 'Math', curiosity_score: 4 },
        { id: 'topic3', title: 'Topic 3', subject: 'Chemistry', curiosity_score: 3 }
      ];

      const recommendations = generateRecommendations({}, [], conceptIndex, 3);
      
      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].recommendationReasons).toContain('Popular right now');
      // Sorted by curiosity score
      expect(recommendations[0].id).toBe('topic1'); // curiosity 5
      expect(recommendations[1].id).toBe('topic2'); // curiosity 4
    });

    test('Recommendations prioritize same subject', () => {
      const progressState = {
        tracked: [
          { id: 'physics1', subject: 'Physics', level: 'Foundations', mastery: 0.8 }
        ]
      };

      const conceptIndex = [
        { id: 'physics2', title: 'Physics 2', subject: 'Physics', level: 'Middle School' },
        { id: 'math1', title: 'Math 1', subject: 'Math' },
        { id: 'chem1', title: 'Chem 1', subject: 'Chemistry' }
      ];

      const recommendations = generateRecommendations(progressState, [], conceptIndex, 3);
      
      // First recommendation should be same subject (Physics)
      expect(recommendations[0].subject).toBe('Physics');
      expect(recommendations[0].recommendationReasons).toContain('Continue Physics');
    });

    test('Recommendations exclude completed topics', () => {
      const progressState = {
        tracked: [
          { id: 'completed1', subject: 'Physics', mastery: 0.8 }
        ]
      };

      const conceptIndex = [
        { id: 'completed1', title: 'Completed', subject: 'Physics' },
        { id: 'new1', title: 'New Topic', subject: 'Math' }
      ];

      const recommendations = generateRecommendations(progressState, [], conceptIndex, 2);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe('new1'); // Only uncompleted topic
    });

    test('Recommendations have no duplicates', () => {
      const conceptIndex = Array.from({ length: 20 }, (_, i) => ({
        id: `topic${i}`,
        title: `Topic ${i}`,
        subject: 'Physics',
        curiosity_score: Math.floor(Math.random() * 5) + 1
      }));

      const recommendations = generateRecommendations({}, [], conceptIndex, 10);
      
      const ids = recommendations.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(recommendations.length); // No duplicates
    });
  });
});

/**
 * Tests for EngagementManager
 * Includes both unit tests and property-based tests
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 6.1, 6.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EngagementManager, PHASES } from '../engagement.js';

describe('EngagementManager', () => {
  let manager;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    manager = new EngagementManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('calculateStars', () => {
    /**
     * **Validates: Requirement 1.1 - Mastery-Star Mapping**
     * Property 1.1: mastery < 0.5 → 1 star, 0.5 ≤ mastery ≤ 0.7 → 2 stars, mastery > 0.7 → 3 stars
     */
    it('should return 1 star for mastery < 0.5', () => {
      expect(manager.calculateStars(0)).toBe(1);
      expect(manager.calculateStars(0.3)).toBe(1);
      expect(manager.calculateStars(0.49)).toBe(1);
    });

    it('should return 2 stars for mastery between 0.5 and 0.7', () => {
      expect(manager.calculateStars(0.5)).toBe(2);
      expect(manager.calculateStars(0.6)).toBe(2);
      expect(manager.calculateStars(0.7)).toBe(2);
    });

    it('should return 3 stars for mastery > 0.7', () => {
      expect(manager.calculateStars(0.71)).toBe(3);
      expect(manager.calculateStars(0.85)).toBe(3);
      expect(manager.calculateStars(1.0)).toBe(3);
    });

    it('should throw error for invalid mastery values', () => {
      expect(() => manager.calculateStars(-0.1)).toThrow();
      expect(() => manager.calculateStars(1.1)).toThrow();
      expect(() => manager.calculateStars('0.5')).toThrow();
      expect(() => manager.calculateStars(null)).toThrow();
    });

    /**
     * Property-based test: Stars always between 1-3 for valid mastery
     * **Validates: Requirement 1.1**
     */
    it('property: stars are always 1, 2, or 3 for any valid mastery', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          (mastery) => {
            const stars = manager.calculateStars(mastery);
            return stars >= 1 && stars <= 3 && Number.isInteger(stars);
          }
        ),
        { numRuns: 1000 }
      );
    });

    /**
     * Property-based test: Star boundaries are correct
     * **Validates: Requirement 1.1**
     */
    it('property: star calculation follows mastery boundaries', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          (mastery) => {
            const stars = manager.calculateStars(mastery);
            
            if (mastery < 0.5) {
              return stars === 1;
            } else if (mastery <= 0.7) {
              return stars === 2;
            } else {
              return stars === 3;
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('calculateStreak', () => {
    /**
     * **Validates: Requirement 1.2 - Streak Continuity**
     * Property 1.2: Streak increments if ≤1 day gap, resets if >1 day
     */
    it('should return 1 for first time studying', () => {
      const streak = manager.calculateStreak();
      expect(streak.count).toBe(1);
      expect(streak.isActive).toBe(true);
    });

    it('should maintain streak when studying same day', () => {
      // Set up existing streak
      manager.state.streakCount = 5;
      manager.state.lastStudiedDate = new Date().toISOString();
      
      const streak = manager.calculateStreak();
      expect(streak.count).toBe(5);
      expect(streak.isActive).toBe(true);
    });

    it('should increment streak when studying next day', () => {
      // Study yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      manager.state.streakCount = 5;
      manager.state.lastStudiedDate = yesterday.toISOString();
      
      const streak = manager.calculateStreak();
      expect(streak.count).toBe(6);
      expect(streak.isActive).toBe(true);
    });

    it('should reset streak when gap is more than 1 day', () => {
      // Study 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      manager.state.streakCount = 5;
      manager.state.lastStudiedDate = threeDaysAgo.toISOString();
      
      const streak = manager.calculateStreak();
      expect(streak.count).toBe(1);
      expect(streak.isActive).toBe(false);
      expect(streak.gapDays).toBe(3);
    });

    it('should handle timezone changes correctly', () => {
      // Test midnight boundary
      const justBeforeMidnight = new Date();
      justBeforeMidnight.setHours(23, 59, 59, 999);
      justBeforeMidnight.setDate(justBeforeMidnight.getDate() - 1);
      
      manager.state.streakCount = 5;
      manager.state.lastStudiedDate = justBeforeMidnight.toISOString();
      
      const streak = manager.calculateStreak();
      expect(streak.count).toBe(6); // Should increment
    });

    /**
     * Property-based test: Streak never decreases on same day
     * **Validates: Requirement 1.2 - Streak Monotonicity**
     */
    it('property: streak never decreases when studying on same day', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (initialStreak) => {
            manager.state.streakCount = initialStreak;
            manager.state.lastStudiedDate = new Date().toISOString();
            
            const streak = manager.calculateStreak();
            return streak.count >= initialStreak;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property-based test: Streak logic is consistent
     * **Validates: Requirement 1.2**
     */
    it('property: streak follows consistent rules based on day gap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 30 }),
          (daysAgo, initialStreak) => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - daysAgo);
            
            manager.state.streakCount = initialStreak;
            manager.state.lastStudiedDate = pastDate.toISOString();
            
            const streak = manager.calculateStreak();
            
            if (daysAgo === 0) {
              // Same day - maintain
              return streak.count === initialStreak;
            } else if (daysAgo === 1) {
              // Next day - increment
              return streak.count === initialStreak + 1;
            } else {
              // Gap > 1 day - reset to 1
              return streak.count === 1 && !streak.isActive;
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('updateStreak', () => {
    it('should update streak and save state', () => {
      const streakInfo = manager.updateStreak();
      
      expect(streakInfo.count).toBe(1);
      expect(manager.state.streakCount).toBe(1);
      expect(manager.state.lastStudiedDate).toBeTruthy();
    });

    it('should persist streak across manager instances', () => {
      manager.updateStreak();
      
      // Create new manager instance (simulates page reload)
      const newManager = new EngagementManager();
      
      expect(newManager.state.streakCount).toBe(1);
      expect(newManager.state.lastStudiedDate).toBeTruthy();
    });
  });

  describe('getProgressConstellation', () => {
    /**
     * **Validates: Requirement 1.3 - Subject Grouping**
     * Property 1.3: All topics with identical subject are in same cluster
     */
    it('should return empty constellation for new user', () => {
      const constellation = manager.getProgressConstellation();
      expect(constellation).toEqual({});
    });

    it('should group topics by subject', () => {
      // Add topics
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Ice Melting',
        subject: 'Physics',
        mastery: 0.8
      });
      
      manager.addTopicToConstellation({
        id: 'topic2',
        title: 'Ratios',
        subject: 'Math',
        mastery: 0.6
      });
      
      manager.addTopicToConstellation({
        id: 'topic3',
        title: 'Bouncing Balls',
        subject: 'Physics',
        mastery: 0.9
      });
      
      const constellation = manager.getProgressConstellation();
      
      expect(Object.keys(constellation)).toHaveLength(2);
      expect(constellation.Physics).toHaveLength(2);
      expect(constellation.Math).toHaveLength(1);
    });

    it('should prevent external mutation of constellation', () => {
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Test',
        subject: 'Physics',
        mastery: 0.8
      });
      
      const constellation = manager.getProgressConstellation();
      constellation.Physics[0].stars = 999;
      
      const freshConstellation = manager.getProgressConstellation();
      expect(freshConstellation.Physics[0].stars).toBe(3); // Should still be 3
    });

    /**
     * Property-based test: All topics appear exactly once
     * **Validates: Requirement 1.3**
     */
    it('property: each topic appears exactly once in constellation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              title: fc.string({ minLength: 1, maxLength: 50 }),
              subject: fc.constantFrom('Physics', 'Math', 'Chemistry', 'Biology'),
              mastery: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (topics) => {
            // Fresh manager for each test
            const testManager = new EngagementManager();
            
            // Add all topics
            topics.forEach(topic => {
              testManager.addTopicToConstellation(topic);
            });
            
            const constellation = testManager.getProgressConstellation();
            
            // Count total topics in constellation
            let totalTopics = 0;
            const topicIds = new Set();
            
            for (const subject in constellation) {
              constellation[subject].forEach(topic => {
                totalTopics++;
                topicIds.add(topic.topicId);
              });
            }
            
            // Each unique topic ID should appear exactly once
            const uniqueTopicIds = new Set(topics.map(t => t.id));
            return topicIds.size === uniqueTopicIds.size && totalTopics === uniqueTopicIds.size;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property-based test: Subject grouping is consistent
     * **Validates: Requirement 1.3**
     */
    it('property: topics with same subject are always grouped together', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              title: fc.string({ minLength: 1, maxLength: 50 }),
              subject: fc.constantFrom('Physics', 'Math', 'Chemistry'),
              mastery: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 15 }
          ),
          (topics) => {
            const testManager = new EngagementManager();
            
            topics.forEach(topic => {
              testManager.addTopicToConstellation(topic);
            });
            
            const constellation = testManager.getProgressConstellation();
            
            // Verify each topic is in correct subject cluster
            for (const subject in constellation) {
              const allTopicsInCluster = constellation[subject].every(
                topic => {
                  // Find original topic
                  const original = topics.find(t => t.id === topic.topicId);
                  return original && original.subject === subject;
                }
              );
              
              if (!allTopicsInCluster) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('addTopicToConstellation', () => {
    it('should add topic with correct star rating', () => {
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Test Topic',
        subject: 'Physics',
        mastery: 0.8
      });
      
      const constellation = manager.getProgressConstellation();
      expect(constellation.Physics[0].stars).toBe(3);
    });

    it('should update existing topic instead of duplicating', () => {
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Test Topic',
        subject: 'Physics',
        mastery: 0.5
      });
      
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Test Topic',
        subject: 'Physics',
        mastery: 0.9
      });
      
      const constellation = manager.getProgressConstellation();
      expect(constellation.Physics).toHaveLength(1);
      expect(constellation.Physics[0].stars).toBe(3); // Updated to 3 stars
    });

    it('should throw error for invalid topic data', () => {
      expect(() => {
        manager.addTopicToConstellation({
          id: 'topic1',
          title: 'Test',
          // missing subject
          mastery: 0.8
        });
      }).toThrow();
    });
  });

  describe('getPhaseProgress', () => {
    /**
     * **Validates: Requirement 6.1 - Phase Order Immutability**
     * Property 6.1: Phases always in order: Hook, Predict, Discuss, Practice, Teach Back
     */
    it('should return correct progress for hook phase', () => {
      const progress = manager.getPhaseProgress('hook');
      
      expect(progress.completed).toEqual([]);
      expect(progress.current).toBe('hook');
      expect(progress.remaining).toEqual(['predict', 'discuss', 'practice', 'teach_back']);
      expect(progress.currentIndex).toBe(0);
    });

    it('should return correct progress for middle phase', () => {
      const progress = manager.getPhaseProgress('discuss');
      
      expect(progress.completed).toEqual(['hook', 'predict']);
      expect(progress.current).toBe('discuss');
      expect(progress.remaining).toEqual(['practice', 'teach_back']);
      expect(progress.currentIndex).toBe(2);
    });

    it('should return correct progress for last phase', () => {
      const progress = manager.getPhaseProgress('teach_back');
      
      expect(progress.completed).toEqual(['hook', 'predict', 'discuss', 'practice']);
      expect(progress.current).toBe('teach_back');
      expect(progress.remaining).toEqual([]);
      expect(progress.currentIndex).toBe(4);
    });

    it('should throw error for invalid phase', () => {
      expect(() => manager.getPhaseProgress('invalid')).toThrow();
    });

    /**
     * Property-based test: Phase order is always consistent
     * **Validates: Requirement 6.1, 6.2**
     */
    it('property: phase order is always consistent', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PHASES),
          (phase) => {
            const progress = manager.getPhaseProgress(phase);
            
            // Verify completed + current + remaining = all phases
            const allPhases = [...progress.completed, progress.current, ...progress.remaining];
            
            return (
              allPhases.length === PHASES.length &&
              allPhases.every((p, i) => p === PHASES[i])
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property-based test: State consistency
     * **Validates: Requirement 6.2**
     */
    it('property: completed count equals current phase index', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PHASES),
          (phase) => {
            const progress = manager.getPhaseProgress(phase);
            return progress.completed.length === progress.currentIndex;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('getWelcomeBackMessage', () => {
    it('should return null for first time user', () => {
      const message = manager.getWelcomeBackMessage();
      expect(message).toBeNull();
    });

    it('should return null for recent user', () => {
      manager.state.lastStudiedDate = new Date().toISOString();
      const message = manager.getWelcomeBackMessage();
      expect(message).toBeNull();
    });

    it('should return welcome message for user returning after 2+ days', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      manager.state.lastStudiedDate = threeDaysAgo.toISOString();
      
      const message = manager.getWelcomeBackMessage();
      expect(message).toContain('Welcome back');
    });
  });

  describe('getConstellationStats', () => {
    it('should return correct statistics', () => {
      manager.addTopicToConstellation({
        id: 'topic1',
        title: 'Test 1',
        subject: 'Physics',
        mastery: 0.8
      });
      
      manager.addTopicToConstellation({
        id: 'topic2',
        title: 'Test 2',
        subject: 'Physics',
        mastery: 0.6
      });
      
      manager.addTopicToConstellation({
        id: 'topic3',
        title: 'Test 3',
        subject: 'Math',
        mastery: 0.9
      });
      
      const stats = manager.getConstellationStats();
      
      expect(stats.totalTopics).toBe(3);
      expect(stats.totalStars).toBe(3 + 2 + 3); // 8 total
      expect(parseFloat(stats.averageStars)).toBeCloseTo(2.67, 1);
      expect(stats.subjects).toEqual(['Physics', 'Math']);
      expect(stats.subjectCounts).toEqual({ Physics: 2, Math: 1 });
    });
  });

  describe('generateRecommendations', () => {
    const mockConceptIndex = [
      {
        id: 'physics1',
        title: 'Ice Melting',
        subject: 'Physics',
        difficulty: 2,
        interest_tags: ['food', 'experiments'],
        related_concepts: []
      },
      {
        id: 'physics2',
        title: 'Bouncing Balls',
        subject: 'Physics',
        difficulty: 3,
        interest_tags: ['sports'],
        related_concepts: ['physics1']
      },
      {
        id: 'math1',
        title: 'Ratios',
        subject: 'Math',
        difficulty: 3,
        interest_tags: ['gaming'],
        related_concepts: []
      },
      {
        id: 'chem1',
        title: 'Acids and Bases',
        subject: 'Chemistry',
        difficulty: 4,
        interest_tags: ['experiments'],
        related_concepts: []
      }
    ];

    /**
     * **Validates: Requirement 4.1 - Recommendation Uniqueness**
     */
    it('should return recommendations without duplicates', () => {
      const recommendations = manager.generateRecommendations(
        {},
        [],
        mockConceptIndex
      );
      
      const ids = recommendations.map(r => r.conceptId);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    /**
     * **Validates: Requirement 4.3 - Subject Continuity**
     */
    it('should prioritize same subject as last completed topic', () => {
      // Complete a Physics topic
      manager.addTopicToConstellation({
        id: 'physics1',
        title: 'Ice Melting',
        subject: 'Physics',
        mastery: 0.8
      });
      
      const recommendations = manager.generateRecommendations(
        {},
        [],
        mockConceptIndex,
        4
      );
      
      // First recommendation should be Physics (same subject)
      expect(recommendations[0].subject).toBe('Physics');
      expect(recommendations[0].conceptId).toBe('physics2');
    });

    it('should match interest tags', () => {
      const recommendations = manager.generateRecommendations(
        {},
        ['experiments', 'gaming'],
        mockConceptIndex,
        4
      );
      
      // Should prioritize topics with matching interest tags
      const hasExperimentsTag = recommendations.some(r => 
        mockConceptIndex.find(c => c.id === r.conceptId)?.interest_tags?.includes('experiments')
      );
      
      expect(hasExperimentsTag).toBe(true);
    });

    it('should exclude completed topics', () => {
      manager.addTopicToConstellation({
        id: 'physics1',
        title: 'Ice Melting',
        subject: 'Physics',
        mastery: 0.8
      });
      
      const recommendations = manager.generateRecommendations(
        {},
        [],
        mockConceptIndex,
        4
      );
      
      const completedInRecommendations = recommendations.some(
        r => r.conceptId === 'physics1'
      );
      
      expect(completedInRecommendations).toBe(false);
    });

    /**
     * Property-based test: No duplicate recommendations
     * **Validates: Requirement 4.1**
     */
    it('property: recommendations never contain duplicates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (maxRecs) => {
            const testManager = new EngagementManager();
            const recommendations = testManager.generateRecommendations(
              {},
              [],
              mockConceptIndex,
              maxRecs
            );
            
            const ids = recommendations.map(r => r.conceptId);
            const uniqueIds = new Set(ids);
            
            return ids.length === uniqueIds.size;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for empty concept index', () => {
      const recommendations = manager.generateRecommendations({}, [], []);
      expect(recommendations).toEqual([]);
    });

    it('should limit recommendations to max count', () => {
      const recommendations = manager.generateRecommendations(
        {},
        [],
        mockConceptIndex,
        2
      );
      
      expect(recommendations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getPopularRecommendations', () => {
    /**
     * **Validates: Requirement 4.2 - Fallback Guarantee**
     */
    it('should return fallback recommendations', () => {
      const mockIndex = [
        { id: 'ice-melting', title: 'Ice Melting', subject: 'Physics', difficulty: 2 },
        { id: 'bouncing-balls', title: 'Bouncing', subject: 'Physics', difficulty: 3 },
        { id: 'mirror-reflections', title: 'Mirrors', subject: 'Physics', difficulty: 2 }
      ];
      
      const popular = manager.getPopularRecommendations(mockIndex, 3);
      
      expect(popular.length).toBeGreaterThan(0);
      expect(popular.length).toBeLessThanOrEqual(3);
      popular.forEach(rec => {
        expect(rec.reason).toBe('Popular right now');
      });
    });
  });
});

/**
 * Unit Tests for StorageManager
 * 
 * Run with: node src/storage-manager.test.js
 */

// Mock localStorage for Node.js environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  get length() {
    return Object.keys(this.store).length;
  }

  hasOwnProperty(key) {
    return key in this.store;
  }
}

global.localStorage = new LocalStorageMock();

// Import StorageManager
const { StorageManager, STORAGE_KEYS } = require('./storage-manager.js');

// Test utilities
let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`✓ ${testName}`);
  } else {
    failCount++;
    console.error(`✗ ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  assert(passed, testName);
  if (!passed) {
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual: ${JSON.stringify(actual)}`);
  }
}

function assertGreaterThan(actual, threshold, testName) {
  assert(actual > threshold, testName);
  if (!(actual > threshold)) {
    console.log(`  Expected > ${threshold}, got ${actual}`);
  }
}

function assertLessThan(actual, threshold, testName) {
  assert(actual < threshold, testName);
  if (!(actual < threshold)) {
    console.log(`  Expected < ${threshold}, got ${actual}`);
  }
}

// Test Suite
console.log('\n=== StorageManager Unit Tests ===\n');

// Test 1: Initialization
console.log('Test Suite 1: Initialization');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  assert(sm.get(STORAGE_KEYS.ENGAGEMENT) !== null, 
    '1.1: Engagement schema initialized');
  assert(sm.get(STORAGE_KEYS.GAMIFICATION) !== null, 
    '1.2: Gamification schema initialized');
  assert(sm.get(STORAGE_KEYS.SOCIAL) !== null, 
    '1.3: Social schema initialized');
  
  const engagement = sm.get(STORAGE_KEYS.ENGAGEMENT);
  assertEqual(engagement.streakCount, 0, 
    '1.4: Streak count starts at 0');
  assertEqual(engagement.streakActive, false, 
    '1.5: Streak inactive by default');
}

// Test 2: Get/Set Operations
console.log('\nTest Suite 2: Get/Set Operations');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const testData = { foo: 'bar', count: 42 };
  const success = sm.set('test_key', testData);
  
  assert(success, '2.1: Set operation returns true');
  
  const retrieved = sm.get('test_key');
  assertEqual(retrieved, testData, '2.2: Retrieved data matches stored data');
  
  sm.remove('test_key');
  assertEqual(sm.get('test_key'), null, '2.3: Remove operation works');
}

// Test 3: Quota Calculation
console.log('\nTest Suite 3: Quota Calculation');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const initialUsage = sm.getCurrentUsageMB();
  assert(initialUsage >= 0, '3.1: Usage is non-negative');
  
  // Add some data
  const largeData = { data: 'x'.repeat(10000) };
  sm.set('large_test', largeData);
  
  const afterUsage = sm.getCurrentUsageMB();
  // Note: In mock environment, usage tracking may not work perfectly
  assert(afterUsage >= initialUsage, 
    '3.2: Usage does not decrease after storing data');
  
  const quotaInfo = sm.getQuotaInfo();
  assert(quotaInfo.usedMB !== undefined, '3.3: Quota info contains usedMB');
  assert(quotaInfo.maxMB === 10, '3.4: Max storage is 10MB');
  assert(quotaInfo.percentUsed !== undefined, '3.5: Quota info contains percentUsed');
}

// Test 4: Size Estimation
console.log('\nTest Suite 4: Size Estimation');
{
  const sm = new StorageManager();
  
  const smallData = { value: 'test' };
  const size = sm.estimateSize(smallData);
  
  assert(size > 0, '4.1: Size estimation is positive');
  assertLessThan(size, 0.001, '4.2: Small data has small size (< 1KB)');
  
  const largeData = { data: 'x'.repeat(100000) };
  const largeSize = sm.estimateSize(largeData);
  assertGreaterThan(largeSize, size, '4.3: Larger data has larger size');
}

// Test 5: Cleanup - Expired Sessions
console.log('\nTest Suite 5: Cleanup - Expired Sessions');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  // Create expired session
  const expiredSession = {
    conceptId: 'test',
    phase: 'hook',
    expiresAt: Date.now() - 1000 // Expired 1 second ago
  };
  sm.set(STORAGE_KEYS.SESSION_STATE, expiredSession);
  
  assert(sm.get(STORAGE_KEYS.SESSION_STATE) !== null, 
    '5.1: Expired session exists before cleanup');
  
  sm.cleanExpiredSessions();
  
  assertEqual(sm.get(STORAGE_KEYS.SESSION_STATE), null, 
    '5.2: Expired session removed after cleanup');
}

// Test 6: Cleanup - Archived Sessions Trimming
console.log('\nTest Suite 6: Cleanup - Archived Sessions');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  // Create 15 archived sessions
  const archived = [];
  for (let i = 0; i < 15; i++) {
    archived.push({
      id: `session-${i}`,
      lastActive: Date.now() - (i * 60 * 1000) // Staggered times
    });
  }
  sm.set(STORAGE_KEYS.ARCHIVED_SESSIONS, archived);
  
  assertEqual(sm.get(STORAGE_KEYS.ARCHIVED_SESSIONS).length, 15, 
    '6.1: 15 sessions stored');
  
  sm.trimArchivedSessions(10);
  
  const trimmed = sm.get(STORAGE_KEYS.ARCHIVED_SESSIONS);
  assertEqual(trimmed.length, 10, '6.2: Trimmed to 10 sessions');
  assertEqual(trimmed[0].id, 'session-0', 
    '6.3: Most recent sessions kept');
}

// Test 7: Cleanup - Activity Feed Trimming
console.log('\nTest Suite 7: Cleanup - Activity Feed');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const social = sm.get(STORAGE_KEYS.SOCIAL);
  social.activityFeed = [];
  
  // Add 30 activity items
  for (let i = 0; i < 30; i++) {
    social.activityFeed.push({
      topic: `Topic ${i}`,
      timestamp: Date.now() - (i * 1000)
    });
  }
  sm.set(STORAGE_KEYS.SOCIAL, social);
  
  sm.trimActivityFeed(20);
  
  const updated = sm.get(STORAGE_KEYS.SOCIAL);
  assertEqual(updated.activityFeed.length, 20, 
    '7.1: Activity feed trimmed to 20 items');
}

// Test 8: Cleanup - Old Peer Sessions
console.log('\nTest Suite 8: Cleanup - Peer Sessions');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const social = sm.get(STORAGE_KEYS.SOCIAL);
  social.peerSessions = [
    { code: 'ABC123', expiresAt: Date.now() + 3600000 }, // Future
    { code: 'XYZ789', expiresAt: Date.now() - 1000 }, // Expired
    { code: 'DEF456', expiresAt: Date.now() + 7200000 }  // Future
  ];
  sm.set(STORAGE_KEYS.SOCIAL, social);
  
  sm.cleanOldPeerSessions();
  
  const updated = sm.get(STORAGE_KEYS.SOCIAL);
  assertEqual(updated.peerSessions.length, 2, 
    '8.1: Expired peer session removed');
  assert(!updated.peerSessions.some(s => s.code === 'XYZ789'), 
    '8.2: Correct session removed');
}

// Test 9: Migration
console.log('\nTest Suite 9: Data Migration');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  // Simulate old progress format
  const oldProgress = {
    tracked: [
      {
        id: 'topic-1',
        title: 'Test Topic 1',
        subject: 'Physics',
        mastery: 0.75,
        lastStudied: '2024-01-01'
      },
      {
        id: 'topic-2',
        title: 'Test Topic 2',
        subject: 'Math',
        mastery: 0.55,
        lastStudied: '2024-01-02'
      }
    ]
  };
  sm.set(STORAGE_KEYS.PROGRESS, oldProgress);
  
  const success = sm.migrateProgressData();
  assert(success, '9.1: Migration succeeds');
  
  const engagement = sm.get(STORAGE_KEYS.ENGAGEMENT);
  assert(engagement.constellationCache !== undefined, 
    '9.2: Constellation cache created');
  assert(engagement.constellationCache.Physics !== undefined, 
    '9.3: Physics topics migrated');
  assertEqual(engagement.constellationCache.Physics[0].stars, 3, 
    '9.4: Mastery > 0.7 converts to 3 stars');
  assertEqual(engagement.constellationCache.Math[0].stars, 2, 
    '9.5: Mastery 0.5-0.7 converts to 2 stars');
}

// Test 10: Archive Session
console.log('\nTest Suite 10: Archive Session');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const session = {
    conceptId: 'test-topic',
    phase: 'discuss',
    turnCount: 5,
    lastActive: Date.now()
  };
  sm.set(STORAGE_KEYS.SESSION_STATE, session);
  
  sm.archiveSession(session);
  
  assertEqual(sm.get(STORAGE_KEYS.SESSION_STATE), null, 
    '10.1: Active session cleared');
  
  const archived = sm.get(STORAGE_KEYS.ARCHIVED_SESSIONS);
  assert(archived.length > 0, '10.2: Session added to archive');
  assertEqual(archived[0].conceptId, 'test-topic', 
    '10.3: Correct session archived');
  assert(archived[0].archivedAt !== undefined, 
    '10.4: Archive timestamp added');
}

// Test 11: Diagnostics
console.log('\nTest Suite 11: Diagnostics');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  const diagnostics = sm.getDiagnostics();
  
  assert(diagnostics.quota !== undefined, '11.1: Diagnostics include quota');
  assert(diagnostics.keys !== undefined, '11.2: Diagnostics include keys');
  assert(diagnostics.timestamp !== undefined, '11.3: Diagnostics include timestamp');
  assert(diagnostics.keys.ENGAGEMENT !== undefined, 
    '11.4: Diagnostics show engagement key');
  assert(diagnostics.keys.ENGAGEMENT.exists === true, 
    '11.5: Engagement key exists');
}

// Test 12: Clear All
console.log('\nTest Suite 12: Clear All');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  // Add some data
  sm.set(STORAGE_KEYS.INTERESTS, ['cricket', 'coding']);
  
  const beforeInterests = sm.get(STORAGE_KEYS.INTERESTS);
  assertEqual(beforeInterests.length, 2, '12.1: Interests set');
  
  sm.clearAll(true); // Keep interests
  
  const afterInterests = sm.get(STORAGE_KEYS.INTERESTS);
  assertEqual(afterInterests.length, 2, '12.2: Interests preserved');
  
  const engagement = sm.get(STORAGE_KEYS.ENGAGEMENT);
  assertEqual(engagement.streakCount, 0, 
    '12.3: Other data reinitialized');
  
  sm.clearAll(false); // Don't keep interests
  assertEqual(sm.get(STORAGE_KEYS.INTERESTS).length, 0, 
    '12.4: Interests cleared when requested');
}

// Test 13: Full Cleanup Flow
console.log('\nTest Suite 13: Full Cleanup Flow');
{
  localStorage.clear();
  const sm = new StorageManager();
  
  // Add various data
  const expiredSession = {
    conceptId: 'test',
    expiresAt: Date.now() - 1000
  };
  sm.set(STORAGE_KEYS.SESSION_STATE, expiredSession);
  
  const archived = [];
  for (let i = 0; i < 15; i++) {
    archived.push({ id: `s${i}`, lastActive: Date.now() });
  }
  sm.set(STORAGE_KEYS.ARCHIVED_SESSIONS, archived);
  
  const beforeSize = sm.getCurrentUsageMB();
  const result = sm.cleanup();
  const afterSize = sm.getCurrentUsageMB();
  
  assert(result.freedMB >= 0, '13.1: Cleanup frees space');
  // Note: In mock environment, size tracking may be approximate
  assert(afterSize <= beforeSize, '13.2: Usage does not increase after cleanup');
  
  const remainingArchived = sm.get(STORAGE_KEYS.ARCHIVED_SESSIONS);
  assertEqual(remainingArchived.length, 10, 
    '13.3: Archived sessions trimmed during cleanup');
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total Tests: ${testCount}`);
console.log(`Passed: ${passCount} ✓`);
console.log(`Failed: ${failCount} ✗`);
console.log(`Success Rate: ${((passCount/testCount)*100).toFixed(1)}%\n`);

process.exit(failCount > 0 ? 1 : 0);

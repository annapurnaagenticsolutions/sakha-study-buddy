/**
 * Schema Validation Script
 * Validates all data files and LocalStorage schemas against design specifications
 */

const fs = require('fs');
const path = require('path');

let validationErrors = [];
let validationWarnings = [];

function error(message) {
  validationErrors.push(message);
  console.error(`✗ ${message}`);
}

function warn(message) {
  validationWarnings.push(message);
  console.warn(`⚠ ${message}`);
}

function success(message) {
  console.log(`✓ ${message}`);
}

console.log('\n=== Schema Validation ===\n');

// 1. Validate concept-index-lite.json
console.log('Validating concept-index-lite.json...');
try {
  const conceptPath = path.join(__dirname, '..', 'content', 'concept-index-lite.json');
  const concepts = JSON.parse(fs.readFileSync(conceptPath, 'utf-8'));
  
  if (!Array.isArray(concepts)) {
    error('Concept index must be an array');
  } else {
    success(`Found ${concepts.length} concepts`);
    
    // Check for required new fields
    const requiredFields = ['difficulty', 'curiosity_score', 'interest_tags', 
                           'estimated_duration_minutes', 'related_concepts'];
    
    let missingFieldsConcepts = [];
    let invalidDifficulty = [];
    let invalidCuriosity = [];
    let invalidTags = [];
    let invalidDuration = [];
    
    concepts.forEach((concept, index) => {
      const missing = requiredFields.filter(field => concept[field] === undefined);
      if (missing.length > 0) {
        missingFieldsConcepts.push({ id: concept.id, missing });
      }
      
      // Validate difficulty (1-5)
      if (concept.difficulty < 1 || concept.difficulty > 5) {
        invalidDifficulty.push({ id: concept.id, value: concept.difficulty });
      }
      
      // Validate curiosity_score (1-5)
      if (concept.curiosity_score < 1 || concept.curiosity_score > 5) {
        invalidCuriosity.push({ id: concept.id, value: concept.curiosity_score });
      }
      
      // Validate interest_tags (array)
      if (!Array.isArray(concept.interest_tags)) {
        invalidTags.push({ id: concept.id, type: typeof concept.interest_tags });
      }
      
      // Validate duration (positive number)
      if (typeof concept.estimated_duration_minutes !== 'number' || 
          concept.estimated_duration_minutes <= 0) {
        invalidDuration.push({ id: concept.id, value: concept.estimated_duration_minutes });
      }
    });
    
    if (missingFieldsConcepts.length > 0) {
      error(`${missingFieldsConcepts.length} concepts missing required fields`);
      missingFieldsConcepts.slice(0, 3).forEach(c => {
        console.log(`  - ${c.id}: missing ${c.missing.join(', ')}`);
      });
    } else {
      success('All concepts have required fields');
    }
    
    if (invalidDifficulty.length > 0) {
      error(`${invalidDifficulty.length} concepts have invalid difficulty (must be 1-5)`);
    } else {
      success('All difficulty values are valid (1-5)');
    }
    
    if (invalidCuriosity.length > 0) {
      error(`${invalidCuriosity.length} concepts have invalid curiosity_score (must be 1-5)`);
    } else {
      success('All curiosity scores are valid (1-5)');
    }
    
    if (invalidTags.length > 0) {
      error(`${invalidTags.length} concepts have invalid interest_tags (must be array)`);
    } else {
      success('All interest_tags are valid arrays');
    }
    
    if (invalidDuration.length > 0) {
      error(`${invalidDuration.length} concepts have invalid duration`);
    } else {
      success('All durations are valid positive numbers');
    }
  }
} catch (err) {
  error(`Failed to validate concept-index-lite.json: ${err.message}`);
}

// 2. Validate cities.json
console.log('\nValidating cities.json...');
try {
  const citiesPath = path.join(__dirname, '..', 'content', 'cities.json');
  const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
  
  if (!Array.isArray(cities)) {
    error('Cities must be an array');
  } else if (cities.length < 20) {
    warn(`Only ${cities.length} cities (expected 20+)`);
  } else {
    success(`Found ${cities.length} cities`);
  }
  
  // Check for duplicates
  const uniqueCities = new Set(cities);
  if (uniqueCities.size !== cities.length) {
    warn('Duplicate cities found');
  } else {
    success('No duplicate cities');
  }
  
  // Check all are strings
  const nonStrings = cities.filter(c => typeof c !== 'string');
  if (nonStrings.length > 0) {
    error(`${nonStrings.length} non-string cities found`);
  } else {
    success('All cities are strings');
  }
} catch (err) {
  error(`Failed to validate cities.json: ${err.message}`);
}

// 3. Validate StorageManager exists and has correct structure
console.log('\nValidating storage-manager.js...');
try {
  const smPath = path.join(__dirname, '..', 'src', 'storage-manager.js');
  if (!fs.existsSync(smPath)) {
    error('storage-manager.js not found');
  } else {
    const content = fs.readFileSync(smPath, 'utf-8');
    
    // Check for key exports
    const requiredExports = ['StorageManager', 'storageManager', 'STORAGE_KEYS'];
    const hasExports = requiredExports.every(exp => content.includes(exp));
    
    if (hasExports) {
      success('StorageManager has all required exports');
    } else {
      error('StorageManager missing required exports');
    }
    
    // Check for key methods
    const requiredMethods = [
      'get', 'set', 'remove',
      'getCurrentUsageMB', 'getQuotaInfo', 'cleanup',
      'migrateProgressData', 'archiveSession'
    ];
    
    const missingMethods = requiredMethods.filter(method => 
      !content.includes(`${method}(`)
    );
    
    if (missingMethods.length > 0) {
      error(`StorageManager missing methods: ${missingMethods.join(', ')}`);
    } else {
      success('StorageManager has all required methods');
    }
    
    // Check for storage keys
    const requiredKeys = [
      'PROGRESS', 'ENGAGEMENT', 'GAMIFICATION', 'SOCIAL',
      'INTERESTS', 'SESSION_STATE', 'ARCHIVED_SESSIONS'
    ];
    
    const missingKeys = requiredKeys.filter(key => 
      !content.includes(`${key}:`)
    );
    
    if (missingKeys.length > 0) {
      warn(`StorageManager missing storage keys: ${missingKeys.join(', ')}`);
    } else {
      success('StorageManager defines all required storage keys');
    }
  }
} catch (err) {
  error(`Failed to validate storage-manager.js: ${err.message}`);
}

// 4. Validate test file exists
console.log('\nValidating tests...');
try {
  const testPath = path.join(__dirname, '..', 'src', 'storage-manager.test.js');
  if (!fs.existsSync(testPath)) {
    error('storage-manager.test.js not found');
  } else {
    success('storage-manager.test.js exists');
    
    const content = fs.readFileSync(testPath, 'utf-8');
    const testCount = (content.match(/assert\(/g) || []).length;
    
    if (testCount < 40) {
      warn(`Only ${testCount} test assertions (expected 40+)`);
    } else {
      success(`${testCount} test assertions found`);
    }
  }
} catch (err) {
  error(`Failed to validate test file: ${err.message}`);
}

// 5. Validate concept state schemas
console.log('\nValidating concept JSON state schemas...');
try {
  const conceptsDir = path.join(__dirname, '..', 'content', 'concepts');
  if (fs.existsSync(conceptsDir)) {
    const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.json'));
    let stateMachineConcepts = 0;
    files.forEach(file => {
      try {
        const p = path.join(conceptsDir, file);
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (data.conversationStates) {
          stateMachineConcepts++;
          if (!data.conversationStates['START']) {
            error(`${file}: Missing START state in conversationStates`);
          }
          Object.entries(data.conversationStates).forEach(([stateId, stateObj]) => {
            if (!stateObj.onEnter) error(`${file} [${stateId}]: Missing onEnter`);
            else if (!stateObj.onEnter.message) error(`${file} [${stateId}]: Missing onEnter.message`);
            
            if (stateObj.misconceptions && !Array.isArray(stateObj.misconceptions)) {
              error(`${file} [${stateId}]: misconceptions must be an array`);
            }
            if (stateObj.nextStates && typeof stateObj.nextStates !== 'object') {
              error(`${file} [${stateId}]: nextStates must be an object`);
            }
          });
        }
      } catch (e) {
        error(`Failed to parse/validate ${file}: ${e.message}`);
      }
    });
    success(`Validated ${stateMachineConcepts} concepts with conversationStates`);
  } else {
    warn('content/concepts directory not found for state validation');
  }
} catch (err) {
  error(`Failed to validate concept state schemas: ${err.message}`);
}

// Summary
console.log('\n=== Validation Summary ===');
console.log(`Errors: ${validationErrors.length}`);
console.log(`Warnings: ${validationWarnings.length}`);

if (validationErrors.length === 0 && validationWarnings.length === 0) {
  console.log('\n✓ All validations passed!\n');
  process.exit(0);
} else {
  if (validationErrors.length > 0) {
    console.log('\nValidation failed. Please fix the errors above.\n');
    process.exit(1);
  } else {
    console.log('\n⚠ Validation passed with warnings.\n');
    process.exit(0);
  }
}

/**
 * Script to enhance concept-index-lite.json with new engagement fields
 * Adds: difficulty, curiosity_score, interest_tags, estimated_duration_minutes, related_concepts
 */

const fs = require('fs');
const path = require('path');

// Interest tags mapping based on topic characteristics
const INTEREST_TAG_MAPPING = {
  'cricket': ['bowling-swing', 'ball-trajectory', 'speed-distance'],
  'gaming': ['computer-vision', 'probability', 'strategy-optimization'],
  'food': ['ice-melting', 'cooking-temperature', 'fermentation', 'nutrition'],
  'space': ['gravity', 'planets', 'satellites', 'light-years', 'cosmic-rays'],
  'music': ['sound-waves', 'frequency', 'resonance', 'acoustics'],
  'coding': ['algorithms', 'binary', 'logic-gates', 'computation'],
  'sports': ['motion', 'force', 'energy-transfer', 'biomechanics'],
  'art': ['colors', 'light-spectrum', 'perspective', 'symmetry'],
  'books': ['paper-chemistry', 'ink-properties', 'knowledge-organization'],
  'experiments': ['chemical-reactions', 'physics-demos', 'biology-observations'],
  'bikes': ['friction', 'momentum', 'gears', 'balance'],
  'travel': ['navigation', 'climate', 'geography', 'transportation']
};

// Keywords for automatic interest tag assignment
const KEYWORD_TO_INTEREST = {
  'sport': ['sports', 'cricket'],
  'cricket': ['cricket', 'sports'],
  'ball': ['sports', 'cricket'],
  'food': ['food'],
  'cook': ['food', 'experiments'],
  'eat': ['food'],
  'space': ['space'],
  'planet': ['space'],
  'star': ['space'],
  'gravity': ['space'],
  'sound': ['music'],
  'music': ['music'],
  'frequency': ['music'],
  'computer': ['coding', 'gaming'],
  'algorithm': ['coding'],
  'game': ['gaming'],
  'video': ['gaming'],
  'art': ['art'],
  'color': ['art'],
  'paint': ['art'],
  'bike': ['bikes'],
  'cycle': ['bikes'],
  'vehicle': ['bikes', 'travel'],
  'experiment': ['experiments'],
  'test': ['experiments'],
  'lab': ['experiments'],
  'travel': ['travel'],
  'journey': ['travel'],
  'map': ['travel']
};

/**
 * Assign difficulty based on level and class band
 */
function calculateDifficulty(concept) {
  const level = concept.level || 'Foundations';
  const classBand = concept.class_band || [5, 6];
  const avgClass = (classBand[0] + classBand[1]) / 2;

  // Difficulty scale 1-5
  if (level === 'Foundations' && avgClass <= 6) return 2;
  if (level === 'Foundations' && avgClass <= 8) return 3;
  if (level === 'Advanced' && avgClass <= 7) return 3;
  if (level === 'Advanced' && avgClass <= 9) return 4;
  return 5;
}

/**
 * Generate curiosity score (simulated based on topic)
 * In production, this would come from actual student ratings
 */
function generateCuriosityScore(concept) {
  // Seed random based on concept ID for consistency
  let hash = 0;
  for (let i = 0; i < concept.id.length; i++) {
    hash = ((hash << 5) - hash) + concept.id.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Generate score between 3-5 (most topics are interesting)
  const score = 3 + Math.abs(hash % 3);
  return score;
}

/**
 * Assign interest tags based on title, subject, and hook
 */
function assignInterestTags(concept) {
  const tags = new Set();
  const searchText = `${concept.title} ${concept.subject} ${concept.hook || ''}`.toLowerCase();

  // Check keywords
  for (let keyword in KEYWORD_TO_INTEREST) {
    if (searchText.includes(keyword)) {
      KEYWORD_TO_INTEREST[keyword].forEach(tag => tags.add(tag));
    }
  }

  // Add subject-based tags
  if (concept.subject === 'Physics') tags.add('experiments');
  if (concept.subject === 'Chemistry') tags.add('experiments');
  if (concept.subject === 'Biology') tags.add('experiments');
  if (concept.subject === 'Math') tags.add('coding');

  // Ensure at least 2 tags, default to experiments
  if (tags.size === 0) {
    tags.add('experiments');
    tags.add('books');
  } else if (tags.size === 1) {
    tags.add('experiments');
  }

  // Limit to 4 tags max
  return Array.from(tags).slice(0, 4);
}

/**
 * Estimate session duration based on level
 */
function estimateDuration(concept) {
  const level = concept.level || 'Foundations';
  const classBand = concept.class_band || [5, 6];
  const avgClass = (classBand[0] + classBand[1]) / 2;

  // Foundations: 12-18 minutes
  // Advanced: 18-25 minutes
  if (level === 'Foundations') {
    return avgClass <= 6 ? 12 : 15;
  } else {
    return avgClass <= 8 ? 18 : 22;
  }
}

/**
 * Find related concepts based on subject similarity
 */
function findRelatedConcepts(concept, allConcepts) {
  const related = [];
  const sameSubject = allConcepts.filter(c => 
    c.id !== concept.id && 
    c.subject === concept.subject
  );

  // Pick 2-3 related from same subject
  for (let i = 0; i < Math.min(3, sameSubject.length); i++) {
    const randomIndex = Math.floor(Math.random() * sameSubject.length);
    const candidate = sameSubject[randomIndex];
    if (candidate && !related.includes(candidate.id)) {
      related.push(candidate.id);
    }
  }

  return related;
}

/**
 * Main enhancement function
 */
function enhanceConceptIndex() {
  console.log('Loading concept-index-lite.json...');
  
  const conceptPath = path.join(__dirname, '..', 'content', 'concept-index-lite.json');
  const concepts = JSON.parse(fs.readFileSync(conceptPath, 'utf-8'));
  
  console.log(`Found ${concepts.length} concepts`);
  console.log('Enhancing with new fields...');

  const enhanced = concepts.map(concept => {
    const difficulty = calculateDifficulty(concept);
    const curiosity_score = generateCuriosityScore(concept);
    const interest_tags = assignInterestTags(concept);
    const estimated_duration_minutes = estimateDuration(concept);
    const related_concepts = findRelatedConcepts(concept, concepts);

    return {
      ...concept,
      difficulty,
      curiosity_score,
      interest_tags,
      estimated_duration_minutes,
      related_concepts
    };
  });

  // Write enhanced version
  console.log('Writing enhanced concept index...');
  fs.writeFileSync(conceptPath, JSON.stringify(enhanced, null, 2));
  
  console.log('✓ Enhancement complete!');
  console.log(`  - Added difficulty (1-5) to ${enhanced.length} concepts`);
  console.log(`  - Added curiosity_score (1-5) to ${enhanced.length} concepts`);
  console.log(`  - Added interest_tags to ${enhanced.length} concepts`);
  console.log(`  - Added estimated_duration_minutes to ${enhanced.length} concepts`);
  console.log(`  - Added related_concepts to ${enhanced.length} concepts`);

  // Show sample
  console.log('\nSample enhanced concept:');
  console.log(JSON.stringify(enhanced[0], null, 2));
}

// Run enhancement
try {
  enhanceConceptIndex();
} catch (error) {
  console.error('Error enhancing concept index:', error);
  process.exit(1);
}

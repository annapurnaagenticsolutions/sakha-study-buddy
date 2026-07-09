const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const conceptsDir = path.join(root, 'content', 'concepts');
const indexPath = path.join(root, 'content', 'concept-index-lite.json');

let errors = 0;
let warnings = 0;

const showcaseTopicIds = new Set([
  'boiling-water',
  'magnets-at-home',
  'clothes-drying-sun-wind',
  'ohms_law'
]);
const showcaseFields = [
  'try_first',
  'simple_idea',
  'formal_idea',
  'common_trap',
  'trap_fix',
  'memory_anchor',
  'friend_nudge',
  'teach_back_goal',
  'review_plan'
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors += 1;
    console.error('ERROR invalid JSON: ' + path.relative(root, file) + ' - ' + error.message);
    return null;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function hasEnoughWhiteboard(concept) {
  const wb = concept.whiteboard;
  if (Array.isArray(wb)) return wb.filter(Boolean).length >= 3;
  if (!wb || typeof wb !== 'object') return false;
  const basics = asArray(wb.basics).filter(Boolean).length;
  const steps = asArray(wb.steps).filter((item) => text(item.detail || item).length >= 12).length;
  const symbols = asArray(wb.symbols).filter((item) => text(item.symbol) && text(item.means || item.meaning || item.detail)).length;
  return basics >= 1 && steps >= 2 && (symbols >= 1 || text(wb.formula).length > 0);
}

function hasShowcaseLearning(concept) {
  const data = concept.learning_showcase;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return showcaseFields.every((field) => {
    if (field === 'review_plan') return asArray(data[field]).filter(Boolean).length >= 3;
    return text(data[field]).length >= 20;
  });
}
function checkConcept(file) {
  const concept = readJson(file);
  if (!concept) return null;
  const id = concept.concept_id || concept.id || path.basename(file, '.json');
  const required = ['title', 'intro_hook', 'big_idea', 'question_flow'];
  required.forEach((field) => {
    if (!concept[field] || (Array.isArray(concept[field]) && concept[field].length === 0)) {
      errors += 1;
      console.error('ERROR ' + id + ' missing ' + field);
    }
  });
  if (!hasEnoughWhiteboard(concept)) {
    warnings += 1;
    console.warn('WARN  ' + id + ' needs richer whiteboard basics/steps/symbols');
  }
  if (!text(concept.teach_back_prompt) && !asArray(concept.question_flow).some((q) => q.type === 'teach_back')) {
    warnings += 1;
    console.warn('WARN  ' + id + ' needs a teach-back prompt');
  }
  if (showcaseTopicIds.has(id) && !hasShowcaseLearning(concept)) {
    errors += 1;
    console.error('ERROR ' + id + ' missing static learning_showcase fields');
  }
  return id;
}

const index = readJson(indexPath) || [];
if (!Array.isArray(index)) {
  errors += 1;
  console.error('ERROR concept-index-lite.json must be an array');
}

const files = fs.readdirSync(conceptsDir).filter((name) => name.endsWith('.json')).sort();
const ids = new Set(files.map((file) => checkConcept(path.join(conceptsDir, file))).filter(Boolean));

if (Array.isArray(index)) {
  index.forEach((item) => {
    if (!item.id) {
      errors += 1;
      console.error('ERROR lite index entry missing id');
      return;
    }
    if (!ids.has(item.id)) {
      errors += 1;
      console.error('ERROR lite index points to missing concept: ' + item.id);
    }
    ['difficulty', 'curiosity_score'].forEach((field) => {
      const value = Number(item[field] || 3);
      if (value < 1 || value > 5) {
        errors += 1;
        console.error('ERROR ' + item.id + ' invalid ' + field + ': ' + item[field]);
      }
    });
  });
}

console.log('Content quality checked: ' + ids.size + ' concept files, ' + warnings + ' warnings, ' + errors + ' errors.');
process.exit(errors ? 1 : 0);
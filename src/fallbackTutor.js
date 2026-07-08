export const DEFAULT_API_CONCEPT_IDS = [
    'biomedical-monitoring',
    'drone-flight-controller',
    'earthquake-alert-system',
    'smart-traffic-signal',
    'solar-microgrid',
    'water-treatment-network'
];

export class FallbackTutor {
    constructor() {
        this.turn = 0;
    }

    reset() {
        this.turn = 0;
    }

    createResponse(concept, userMessage, apiFailed = false, language = 'Hinglish') {
        this.turn += 1;
        const text = userMessage.toLowerCase();
        const whiteboard = normalizeWhiteboard(concept.whiteboard, concept);
        const misconception = findMisconception(concept, text);
        const asksWhiteboard = /formula|equation|whiteboard|step|derive|symbol|meaning|deep|detail|samjhao|explain|process|flow/.test(text);
        const wantsExample = /example|practice|try|sample|solve|use case/.test(text);
        const wantsRepeat = /repeat|again|slow|from start|basic|basics/.test(text);
        const saysClear = /clear|samajh|understand|yes|haan|ok|got it/.test(text);
        const saysNotClear = /not clear|confus|samajh nahi|doubt|no|nahi/.test(text);
        const likelyTeachBack = isLikelyTeachBack(userMessage, concept);
        const english = language === 'English';

        if (likelyTeachBack && this.turn >= 3) {
            return jsonReply(
                english ? 'Nice. You connected cause and result. Final polish: include cause, process, and result.' : 'Nice. Cause aur result connect ho gaya. Last polish: cause, process, result teenon add karo.',
                'none',
                {},
                true
            );
        }

        if (asksWhiteboard || wantsExample || wantsRepeat) {
            return jsonReply(
                english ? 'Use the whiteboard. I will show only the useful slice first; after 1-2 steps, tell me clear or confusing.' : 'Whiteboard dekho. Pehle sirf useful slice dikh raha hai; 1-2 steps ke baad bolo clear ya doubt.',
                'Whiteboard',
                { whiteboard, title: concept.title, stage: wantsExample ? 'full' : (wantsRepeat ? 'start' : 'steps') },
                false
            );
        }

        if (saysNotClear) {
            return jsonReply(
                makeNotClearReply(concept, whiteboard, language),
                'Whiteboard',
                { whiteboard, title: concept.title, stage: 'start' },
                false
            );
        }

        if (saysClear && this.turn > 1) {
            const nextStage = this.turn >= 4 ? 'full' : 'steps';
            return jsonReply(
                english ? 'Good. I am opening the next whiteboard slice. Next: ' + getNextQuestion(concept, this.turn) + ' Short answer, in your words.' : 'Good. Main next whiteboard slice khol raha hoon. Next: ' + getNextQuestion(concept, this.turn) + ' Short answer, apne words mein.',
                'Whiteboard',
                { whiteboard, title: concept.title, stage: nextStage },
                false
            );
        }

        if (misconception) {
            return jsonReply(
                english ? 'Good thought, but there is a common trap here: "' + misconception.belief + '". Think about this: ' + (misconception.probe || 'what is the actual cause behind the observation?') + ' Hint: ' + (misconception.repair || concept.big_idea || 'follow the cause-process-result chain.') : 'Good thought, but yahan ek common trap hai: "' + misconception.belief + '". Socho: ' + (misconception.probe || 'is observation ke peeche actual cause kya hai?') + ' Hint: ' + (misconception.repair || concept.big_idea || 'cause-process-result chain follow karo.'),
                'none',
                {},
                false
            );
        }

        if (apiFailed) {
            return jsonReply(
                english ? 'Online AI is unavailable. Guided mode: ' + getFallbackTeachingMove(concept, whiteboard, this.turn, language) : 'Online AI unavailable. Guided mode: ' + getFallbackTeachingMove(concept, whiteboard, this.turn, language),
                'Whiteboard',
                { whiteboard, title: concept.title, stage: this.turn >= 3 ? 'steps' : 'start' },
                false
            );
        }

        return jsonReply(
            getFallbackTeachingMove(concept, whiteboard, this.turn, language),
            this.turn <= 3 ? 'Whiteboard' : 'none',
            this.turn <= 3 ? { whiteboard, title: concept.title, stage: this.turn >= 3 ? 'steps' : 'start' } : {},
            false
        );
    }
}

export function createGenericWhiteboard(concept) {
    const legacyLines = Array.isArray(concept.whiteboard) ? concept.whiteboard : [];
    const causeResult = normalizeCauseProcessResult(concept.cause_process_result);
    const processSteps = buildProcessSteps(concept, legacyLines, causeResult);
    const formula = deriveFormula(concept, legacyLines, causeResult);

    return {
        title: concept.title || 'Concept whiteboard',
        goal: concept.big_idea || 'Understand the idea step by step.',
        basics: buildBasics(concept, legacyLines, causeResult),
        formula,
        formula_reading: deriveFormulaReading(formula, causeResult),
        symbols: buildSymbols(concept, legacyLines, causeResult),
        steps: processSteps,
        check_after_step: Math.min(2, Math.max(1, processSteps.length)),
        feedback_prompt: 'Pause: clear so far? Name the confusing word/symbol/step.',
        worked_example: '',
        common_confusions: []
    };
}

export function normalizeWhiteboard(whiteboard, concept = {}) {
    const generated = createGenericWhiteboard({ ...concept, whiteboard });

    if (whiteboard && !Array.isArray(whiteboard) && typeof whiteboard === 'object') {
        return {
            ...generated,
            ...whiteboard,
            basics: normalizeArray(whiteboard.basics, generated.basics),
            symbols: normalizeArray(whiteboard.symbols, generated.symbols),
            steps: normalizeArray(whiteboard.steps, generated.steps),
            common_confusions: normalizeArray(whiteboard.common_confusions, generated.common_confusions),
            formula: whiteboard.formula || generated.formula,
            formula_reading: whiteboard.formula_reading || generated.formula_reading,
            worked_example: whiteboard.worked_example || ''
        };
    }

    return generated;
}

function normalizeCauseProcessResult(input) {
    if (!input || typeof input !== 'object') return null;
    return {
        cause: cleanLine(input.cause || ''),
        process: cleanLine(input.process || ''),
        result: cleanLine(input.result || '')
    };
}

function buildBasics(concept, legacyLines, causeResult) {
    return uniqueNonEmpty([
        concept.intro_hook,
        concept.big_idea,
        causeResult?.cause ? 'Cause: ' + causeResult.cause : '',
        causeResult?.result ? 'Result: ' + causeResult.result : '',
        ...legacyLines.filter((line) => !looksLikeFormula(line)).slice(0, 2)
    ]).slice(0, 5);
}

function buildProcessSteps(concept, legacyLines, causeResult) {
    const flow = Array.isArray(concept.flow) ? concept.flow.map(cleanLine).filter(Boolean) : [];
    if (flow.length) {
        return flow.map((item, index) => ({ label: stepLabel(index, flow.length), detail: item }));
    }

    if (causeResult) {
        const processParts = splitProcess(causeResult.process);
        return uniqueStepDetails([
            causeResult.cause ? { label: 'Cause', detail: causeResult.cause } : null,
            ...processParts.map((part, index) => ({ label: 'Process ' + (index + 1), detail: part })),
            causeResult.result ? { label: 'Result', detail: causeResult.result } : null
        ]);
    }

    const usefulLegacy = legacyLines.map(cleanLine).filter(Boolean).filter((line) => !looksLikeSeparator(line));
    if (usefulLegacy.length) {
        return usefulLegacy.slice(0, 6).map((line, index) => ({ label: 'Step ' + (index + 1), detail: explainLegacyLine(line) }));
    }

    return uniqueStepDetails([
        { label: 'Observe', detail: concept.intro_hook || 'Start from what you can observe.' },
        { label: 'Reason', detail: concept.big_idea || 'Find the cause that explains the change.' },
        { label: 'Teach back', detail: 'Explain the idea simply to a younger student.' }
    ]);
}

function deriveFormula(concept, legacyLines, causeResult) {
    const cleanedLines = legacyLines.map(cleanLine).filter(Boolean);
    const fractionIndex = cleanedLines.findIndex((line) => /^fraction\s*=\s*/i.test(line));
    if (fractionIndex >= 0) {
        const denominator = cleanedLines.slice(fractionIndex + 1, fractionIndex + 4).find((line) => /equal parts total/i.test(line));
        if (denominator) return cleanedLines[fractionIndex] + ' / ' + denominator;
    }

    const latexLine = legacyLines.find((line) => /\$\$/.test(String(line || '')));
    if (latexLine && looksLikeFormula(latexLine)) return cleanLine(latexLine);

    const compactEquation = cleanedLines.find((line) => /^[A-Za-z]\s*=\s*/.test(line));
    if (compactEquation) return compactEquation;

    const formulaLine = cleanedLines.find((line) => looksLikeFormula(line));
    if (formulaLine) return formulaLine;

    const equationInBigIdea = extractEquation(concept.big_idea || '');
    if (equationInBigIdea) return equationInBigIdea;

    if (causeResult?.cause || causeResult?.process || causeResult?.result) {
        return uniqueNonEmpty([causeResult.cause, causeResult.process, causeResult.result]).join(' -> ');
    }

    return '';
}
function deriveFormulaReading(formula, causeResult) {
    if (!formula) return '';
    if (formula.includes('->')) {
        return 'Read left to right: start -> process -> result.';
    }
    if (formula.includes('=')) {
        return 'Left side is the idea; right side shows what creates it.';
    }
    return causeResult?.process ? 'Each part shows what happens next.' : 'This is the main relationship.';
}

function buildSymbols(concept, legacyLines, causeResult) {
    const decoderSymbols = legacyLines.map(parseSymbolLine).filter(Boolean);
    const formulaSymbols = legacyLines.filter(looksLikeFormula).flatMap(parseFormulaSymbols);
    const causeSymbols = causeResult ? [
        causeResult.cause ? { symbol: 'Cause', means: 'start', example: causeResult.cause } : null,

        causeResult.result ? { symbol: 'Result', means: 'end', example: causeResult.result } : null
    ].filter(Boolean) : [];

    return dedupeSymbols([...decoderSymbols, ...formulaSymbols, ...causeSymbols]).slice(0, 6);
}

function splitProcess(process) {
    return cleanLine(process)
        .split(/->|=>|-->| to | then |,/i)
        .map(cleanLine)
        .filter(Boolean)
        .slice(0, 5);
}

function parseSymbolLine(line) {
    const cleaned = cleanLine(line);
    const match = cleaned.match(/^([A-Za-z][A-Za-z0-9_ /().-]{0,18})\s*:\s*(.+)$/);
    if (!match) return null;
    const label = match[1].trim();
    if (/^(example|visual|intuition|formal|application)$/i.test(label)) return null;
    return { symbol: label, means: match[2].trim(), example: '' };
}
function parseFormulaSymbols(line) {
    const cleaned = cleanLine(line);
    const match = cleaned.match(/^([A-Za-z][A-Za-z0-9_ ]{0,24})\s*=\s*(.+)$/);
    if (!match) return [];
    const left = match[1].trim();
    const right = match[2].trim();
    return [
        { symbol: left, means: 'left side', example: cleaned },
        { symbol: right, means: 'right side', example: cleaned }
    ];
}

function extractEquation(text) {
    const cleaned = cleanLine(text);
    const match = cleaned.match(/[A-Za-z][A-Za-z0-9_ ]{0,24}\s*=\s*[^.]+/);
    return match ? match[0].trim() : '';
}

function looksLikeFormula(line) {
    const cleaned = cleanLine(line);
    return /\$\$|=|\b[A-Z]\s*=|\bI\s*=|\bV\s*=|\bW\s*=|\bF\s*=|\bE\s*=|\bfraction\b/i.test(cleaned) && cleaned.length <= 140;
}

function looksLikeSeparator(line) {
    return /^[-_\s]+$/.test(String(line || ''));
}

function explainLegacyLine(line) {
    const cleaned = cleanLine(line);
    if (/^cause:/i.test(cleaned)) return cleaned.replace(/^cause:\s*/i, 'Start with: ');
    if (/^result:/i.test(cleaned)) return cleaned.replace(/^result:\s*/i, 'End result: ');
    return cleaned;
}

function stepLabel(index, length) {
    if (index === 0) return 'Start';
    if (index === length - 1) return 'Result';
    return 'Process ' + index;
}

function cleanLine(value) {
    return String(value || '')
        .replace(/\$\$/g, '')
        .replace(/\*\*/g, '')
        .replace(/\\cdot/g, ' x ')
        .replace(/[→]/g, '->')
        .replace(/\s+/g, ' ')
        .trim();
}

function uniqueNonEmpty(items) {
    const seen = new Set();
    return items.map(cleanLine).filter(Boolean).filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function uniqueStepDetails(steps) {
    const seen = new Set();
    return steps.filter(Boolean).map((step, index) => ({
        label: step.label || 'Step ' + (index + 1),
        detail: cleanLine(step.detail)
    })).filter((step) => {
        if (!step.detail) return false;
        const key = step.detail.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function dedupeSymbols(symbols) {
    const seen = new Set();
    return symbols.filter(Boolean).map((item) => ({
        symbol: cleanLine(item.symbol),
        means: cleanLine(item.means || item.meaning || item.detail),
        example: cleanLine(item.example)
    })).filter((item) => {
        if (!item.symbol || !item.means) return false;
        const key = item.symbol.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeArray(value, fallback) {
    return Array.isArray(value) && value.length ? value : fallback;
}

function jsonReply(message, component, props, sessionComplete) {
    return {
        message,
        render_component: component,
        component_props: props,
        session_complete: sessionComplete
    };
}

function findMisconception(concept, text) {
    return (concept.misconceptions || []).find((item) => {
        const triggers = item.trigger_words || [];
        return triggers.some((word) => text.includes(String(word).toLowerCase()));
    });
}

function isLikelyTeachBack(message, concept) {
    const text = message.toLowerCase();
    const coreWords = [concept.title, 'because', 'heat', 'energy', 'particle', 'change', 'cause', 'process', 'result', 'water']
        .filter(Boolean)
        .map((word) => String(word).toLowerCase());
    const matches = coreWords.filter((word) => text.includes(word)).length;
    return message.length > 60 && matches >= 2;
}

function getNextQuestion(concept, turn) {
    const questions = concept.question_flow || [];
    const index = Math.min(Math.max(turn - 1, 0), questions.length - 1);
    return questions[index]?.q || concept.teach_back_prompt || 'ab is idea ko ek simple example se explain karo.';
}

function makeNotClearReply(concept, whiteboard, language = 'Hinglish') {
    const english = language === 'English';
    const formula = whiteboard.formula ? ' Formula/process line: ' + whiteboard.formula + '.' : '';
    const firstBasic = whiteboard.basics?.[0] || concept.intro_hook || 'observation se start karte hain.';
    const firstStep = whiteboard.steps?.[0]?.detail || concept.big_idea || 'cause-process-result chain dekho.';
    return english
        ? 'No problem. Basics: ' + firstBasic + formula + ' First step: ' + firstStep + ' Confusion: word, formula, or example?'
        : 'No problem. Basic se: ' + firstBasic + formula + ' First step: ' + firstStep + ' Confusion word, formula, ya example?';
}

function getFallbackTeachingMove(concept, whiteboard, turn, language = 'Hinglish') {
    const english = language === 'English';
    const steps = whiteboard.steps || [];
    if (turn === 1) {
        return english ? 'Use the right whiteboard for process, symbols, and first steps. After 1-2 steps, tell me: clear or confusing?' : 'Right whiteboard mein process, symbols, aur first steps dekho. 1-2 steps ke baad bolo: clear ya doubt?';
    }
    if (turn === 2) {
        const formula = whiteboard.formula ? 'Formula/process: ' + whiteboard.formula + '. ' : '';
        const step = steps[0]?.detail || concept.big_idea || 'cause identify karo.';
        return english ? formula + 'Step 1: ' + step + ' Write the simple meaning in your own words. If it is clear, say "clear"; otherwise tell me the doubt.' : formula + 'Step 1: ' + step + ' Iska simple meaning apne words mein likho. Agar clear hai toh "clear" bolo, warna doubt batao.';
    }
    if (turn === 3) {
        const step = steps[1]?.detail || getNextQuestion(concept, turn);
        return english ? 'Step 2: ' + step + ' Compare: what was true before, and what changed after?' : 'Step 2: ' + step + ' Compare: pehle kya tha, baad mein kya badla?';
    }
    return english ? getNextQuestion(concept, turn) + ' Ready ho toh 2-3 lines mein explain karo.' : getNextQuestion(concept, turn) + ' Ready ho toh 2-3 lines mein explain karo.';
}

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

    createResponse(concept, userMessage, apiFailed = false) {
        this.turn += 1;
        const text = userMessage.toLowerCase();
        const whiteboard = normalizeWhiteboard(concept.whiteboard, concept);
        const misconception = findMisconception(concept, text);
        const asksWhiteboard = /formula|equation|whiteboard|step|derive|symbol|meaning|deep|detail|samjhao|explain|process|flow/.test(text);
        const saysClear = /clear|samajh|understand|yes|haan|ok|got it/.test(text);
        const saysNotClear = /not clear|confus|samajh nahi|doubt|no|nahi/.test(text);
        const likelyTeachBack = isLikelyTeachBack(userMessage, concept);

        if (likelyTeachBack && this.turn >= 3) {
            return jsonReply(
                'Nice. Tumne cause aur result connect kar diya. Ek last polish: apne answer mein cause, process, aur result teenon words jod do, toh explanation aur strong ho jayegi.',
                'none',
                {},
                true
            );
        }

        if (asksWhiteboard) {
            return jsonReply(
                'Chalo whiteboard pe todte hain. Pehle formula/process line dekho, phir symbols ka matlab, phir 1-2 steps. Uske baad tum mujhe bolna: clear hai ya doubt hai?',
                'Whiteboard',
                { whiteboard, title: concept.title },
                false
            );
        }

        if (saysNotClear) {
            return jsonReply(
                makeNotClearReply(concept, whiteboard),
                'Whiteboard',
                { whiteboard, title: concept.title, focus: 'basics' },
                false
            );
        }

        if (saysClear && this.turn > 1) {
            return jsonReply(
                'Good. Ab next small step: ' + getNextQuestion(concept, this.turn) + ' Short answer chalega, bas apne words mein.',
                'none',
                {},
                false
            );
        }

        if (misconception) {
            return jsonReply(
                'Good thought, but yahan ek common trap hai: "' + misconception.belief + '". Socho: ' + (misconception.probe || 'is observation ke peeche actual cause kya hai?') + ' Hint: ' + (misconception.repair || concept.big_idea || 'cause-process-result chain follow karo.'),
                'none',
                {},
                false
            );
        }

        if (apiFailed) {
            return jsonReply(
                'Online AI abhi available nahi hai, but guided mode se continue karte hain. ' + getFallbackTeachingMove(concept, whiteboard, this.turn),
                'none',
                {},
                false
            );
        }

        return jsonReply(
            getFallbackTeachingMove(concept, whiteboard, this.turn),
            this.turn === 1 ? 'Whiteboard' : 'none',
            this.turn === 1 ? { whiteboard, title: concept.title } : {},
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
        feedback_prompt: 'Pause check: are these first steps clear? If not, tell me the exact word, symbol, or step that is confusing.',
        worked_example: findWorkedExample(concept, legacyLines),
        common_confusions: buildConfusions(concept)
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
            worked_example: whiteboard.worked_example || generated.worked_example
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
        return 'Read this from left to right: starting condition -> change/process -> final result.';
    }
    if (formula.includes('=')) {
        return 'Read this slowly: the left side is what we are finding or explaining; the right side shows the parts or causes that create it.';
    }
    return causeResult?.process ? 'This is the process line: each part explains what happens next.' : 'Read this as the main relationship for the topic.';
}

function buildSymbols(concept, legacyLines, causeResult) {
    const decoderSymbols = legacyLines.map(parseSymbolLine).filter(Boolean);
    const formulaSymbols = legacyLines.filter(looksLikeFormula).flatMap(parseFormulaSymbols);
    const causeSymbols = causeResult ? [
        causeResult.cause ? { symbol: 'Cause', means: 'what starts the change', example: causeResult.cause } : null,
        causeResult.process ? { symbol: 'Process', means: 'what happens in between', example: causeResult.process } : null,
        causeResult.result ? { symbol: 'Result', means: 'what we finally observe', example: causeResult.result } : null
    ].filter(Boolean) : [];
    const keyConcepts = Array.isArray(concept.prerequisites)
        ? concept.prerequisites.slice(0, 3).map((item) => ({ symbol: cleanLine(item), means: 'basic idea needed here', example: concept.title || '' }))
        : [];

    return dedupeSymbols([...decoderSymbols, ...formulaSymbols, ...causeSymbols, ...keyConcepts]).slice(0, 8);
}

function buildConfusions(concept) {
    return (concept.misconceptions || []).slice(0, 3).map((item) => ({
        confusion: item.belief,
        fix: item.repair || item.probe || 'Go back to the process steps and check the cause.'
    }));
}

function findWorkedExample(concept, legacyLines) {
    const explicitExample = legacyLines.find((line) => /example/i.test(line));
    if (explicitExample) return cleanLine(explicitExample);
    if (Array.isArray(concept.practice_problems) && concept.practice_problems.length) {
        const first = concept.practice_problems[0];
        return cleanLine(first.prompt || first.question || first.problem || String(first));
    }
    return cleanLine(concept.story || concept.home_investigation || '');
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
        { symbol: left, means: 'quantity or idea being explained', example: cleaned },
        { symbol: right, means: 'parts or causes used to explain it', example: cleaned }
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

function makeNotClearReply(concept, whiteboard) {
    const formula = whiteboard.formula ? ' Formula/process line: ' + whiteboard.formula + '.' : '';
    const firstBasic = whiteboard.basics?.[0] || concept.intro_hook || 'observation se start karte hain.';
    const firstStep = whiteboard.steps?.[0]?.detail || concept.big_idea || 'cause-process-result chain dekho.';
    return 'No problem. Bilkul basic se: ' + firstBasic + formula + ' Pehla step sirf yeh hai: ' + firstStep + ' Ab bolo, confusion word mein hai, formula mein hai, ya example mein?';
}

function getFallbackTeachingMove(concept, whiteboard, turn) {
    const steps = whiteboard.steps || [];
    if (turn === 1) {
        return 'Main guided mode mein hoon, API ke bina bhi concept pack se padha sakta hoon. Right-side whiteboard mein formula/process, symbols, aur steps dekho. First 1-2 steps ke baad mujhe batao: clear hai ya doubt?';
    }
    if (turn === 2) {
        const formula = whiteboard.formula ? 'Formula/process: ' + whiteboard.formula + '. ' : '';
        const step = steps[0]?.detail || concept.big_idea || 'cause identify karo.';
        return formula + 'Step 1: ' + step + ' Iska simple meaning apne words mein likho. Agar clear hai toh "clear" bolo, warna doubt batao.';
    }
    if (turn === 3) {
        const step = steps[1]?.detail || getNextQuestion(concept, turn);
        return 'Step 2: ' + step + ' Ab compare karo: pehle kya tha, baad mein kya badla?';
    }
    return getNextQuestion(concept, turn) + ' Jab tum ready ho, teach-back mode mein 2-3 lines mein explain karo.';
}

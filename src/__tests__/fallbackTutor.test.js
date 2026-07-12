import { describe, it, expect, beforeEach } from 'vitest';
import {
    FallbackTutor,
    CONVERSATION_STATES,
    RESPONSE_CATEGORIES
} from '../fallbackTutor.js';

describe('FallbackTutor 12-State Conversational Engine & Response Classification', () => {
    let tutor;
    let mockConcept;

    beforeEach(() => {
        tutor = new FallbackTutor();
        mockConcept = {
            id: 'test-concept',
            title: 'Photosynthesis',
            intro_hook: 'Why are leaves green and how do plants eat?',
            big_idea: 'Plants convert sunlight, water, and CO2 into glucose and oxygen.',
            whiteboard: {
                title: 'Photosynthesis Whiteboard',
                basics: ['Light from sun', 'Water from roots', 'CO2 from air'],
                formula: 'CO2 + H2O + Light -> Glucose + O2',
                symbols: [
                    { symbol: 'CO2', means: 'Carbon Dioxide' },
                    { symbol: 'H2O', means: 'Water' }
                ],
                steps: [
                    { label: 'Step 1', detail: 'Chlorophyll captures sunlight' },
                    { label: 'Step 2', detail: 'Water split into H and O' }
                ]
            },
            misconceptions: [
                {
                    trigger_words: ['soil', 'dirt', 'mud'],
                    belief: 'Plants eat dirt from the ground',
                    probe: 'If plants ate soil, would the pot get lighter over time?',
                    repair: 'Plants only take water and minerals from soil; their real food (glucose) is built using carbon from the air and sunlight energy.'
                }
            ],
            question_flow: [
                { q: 'Where do you think a tree gets most of its mass from?' },
                { q: 'What happens to the oxygen after water is split?' }
            ],
            teach_back_prompt: 'Explain to your friend how a leaf makes food!'
        };
    });

    it('should export all 12 defined conversation states', () => {
        expect(CONVERSATION_STATES).toEqual([
            'INTRO', 'PRIOR_IDEA', 'CONCEPT_1', 'CHECK_1', 'CONCEPT_2',
            'CHECK_2', 'VISUAL_EXPLORATION', 'MISCONCEPTION_REPAIR',
            'PRACTICE', 'TEACH_BACK', 'FEEDBACK', 'COMPLETE'
        ]);
    });

    it('should export all 9 response interpretation categories', () => {
        expect(RESPONSE_CATEGORIES).toEqual([
            'CORRECT', 'PARTIALLY_CORRECT', 'MISCONCEPTION', 'UNCERTAIN',
            'REQUEST_EXAMPLE', 'REQUEST_VISUAL', 'REQUEST_SIMPLIFICATION',
            'OFF_TOPIC', 'EMPTY_OR_UNCLEAR'
        ]);
    });

    it('should initialize in INTRO state at turn 0', () => {
        expect(tutor.state).toBe('INTRO');
        expect(tutor.turn).toBe(0);
        expect(tutor.stateHistory).toEqual(['INTRO']);
    });

    it('should reset properly to initial state', () => {
        tutor.createResponse(mockConcept, 'hello there');
        expect(tutor.turn).toBe(1);
        expect(tutor.state).not.toBe('INTRO');
        tutor.reset();
        expect(tutor.turn).toBe(0);
        expect(tutor.state).toBe('INTRO');
        expect(tutor.stateHistory).toEqual(['INTRO']);
    });

    describe('classifyUserResponse', () => {
        it('should classify empty or unclear messages', () => {
            expect(tutor.classifyUserResponse('', mockConcept)).toBe('EMPTY_OR_UNCLEAR');
            expect(tutor.classifyUserResponse('   ', mockConcept)).toBe('EMPTY_OR_UNCLEAR');
        });

        it('should classify misconceptions', () => {
            expect(tutor.classifyUserResponse('I think plants get food from soil and dirt', mockConcept)).toBe('MISCONCEPTION');
        });

        it('should classify simplification / whiteboard requests', () => {
            expect(tutor.classifyUserResponse('Please show the formula and process steps', mockConcept)).toBe('REQUEST_SIMPLIFICATION');
            expect(tutor.classifyUserResponse('Can you simplify this in basic terms?', mockConcept)).toBe('REQUEST_SIMPLIFICATION');
        });

        it('should classify example requests', () => {
            expect(tutor.classifyUserResponse('Give me a worked example or practice problem to solve', mockConcept)).toBe('REQUEST_EXAMPLE');
        });

        it('should classify visual requests', () => {
            expect(tutor.classifyUserResponse('Show me the 3d animation or diagram for this', mockConcept)).toBe('REQUEST_VISUAL');
        });

        it('should classify teach back / correct explanations', () => {
            const teachBackMsg = 'Photosynthesis happens because plants use sunlight energy and particles of CO2 and water to cause a change that makes glucose result.';
            expect(tutor.classifyUserResponse(teachBackMsg, mockConcept)).toBe('CORRECT');
        });

        it('should classify clear / partially correct statements', () => {
            expect(tutor.classifyUserResponse('Yes I understand clear now', mockConcept)).toBe('PARTIALLY_CORRECT');
        });

        it('should classify uncertain / doubt statements', () => {
            expect(tutor.classifyUserResponse('I have a doubt not clear about this part', mockConcept)).toBe('UNCERTAIN');
        });
    });

    describe('State machine transitions and response enrichment', () => {
        it('should transition to PRIOR_IDEA on first turn and enrich response properties', () => {
            const reply = tutor.createResponse(mockConcept, 'Let us begin photosynthesis');
            expect(tutor.turn).toBe(1);
            expect(tutor.state).toBe('PRIOR_IDEA');
            expect(reply.state).toBe('PRIOR_IDEA');
            expect(reply.response_category).toBe('PARTIALLY_CORRECT');
            expect(reply.render_component).toBe('Whiteboard');
            expect(reply.component_props.state).toBe('PRIOR_IDEA');
        });

        it('should transition to MISCONCEPTION_REPAIR when misconception is triggered', () => {
            const reply = tutor.createResponse(mockConcept, 'Plants eat dirt from the soil', false, 'English');
            expect(tutor.state).toBe('MISCONCEPTION_REPAIR');
            expect(reply.state).toBe('MISCONCEPTION_REPAIR');
            expect(reply.response_category).toBe('MISCONCEPTION');
            expect(reply.message).toContain('Good thought, but there is a common trap here');
            expect(reply.message).toContain('If plants ate soil, would the pot get lighter over time?');
        });

        it('should transition through state chain INTRO -> PRIOR_IDEA -> CONCEPT_1 -> CHECK_1 -> CONCEPT_2', () => {
            tutor.createResponse(mockConcept, 'start');
            expect(tutor.state).toBe('PRIOR_IDEA');

            tutor.createResponse(mockConcept, 'ok got it');
            expect(tutor.state).toBe('CONCEPT_1');

            tutor.createResponse(mockConcept, 'clear');
            expect(tutor.state).toBe('CHECK_1');

            tutor.createResponse(mockConcept, 'understood clear');
            expect(tutor.state).toBe('CONCEPT_2');
        });

        it('should mark session_complete and transition to COMPLETE on teach-back', () => {
            tutor.createResponse(mockConcept, 'start');
            tutor.createResponse(mockConcept, 'clear');
            const teachBackMsg = 'Photosynthesis happens because plants use heat energy particle and water change process result.';
            const reply = tutor.createResponse(mockConcept, teachBackMsg, false, 'English');
            expect(tutor.state).toBe('COMPLETE');
            expect(reply.session_complete).toBe(true);
            expect(reply.message).toContain('include cause, process, and result');
        });
    });
});

// Declarative Render Engine for Sakha Static

export function renderComponent(componentName, props) {
    const container = document.createElement('div');
    container.className = 'interactive-component';

    if (componentName === 'ParticleSimulator') {
        renderParticleSimulator(container, props);
    } else if (componentName === 'MermaidDiagram') {
        renderMermaid(container, props);
    } else if (componentName === 'Whiteboard') {
        renderWhiteboard(container, props);
    } else {
        const error = document.createElement('div');
        error.className = 'component-error';
        error.textContent = 'Unknown component: ' + componentName;
        container.appendChild(error);
    }

    return container;
}

async function loadMermaid() {
    if (window.mermaid) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'lib/mermaid.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function renderMermaid(container, props) {
    container.style.padding = '20px';
    container.style.background = '#ffffff';

    const diagramCode = props.code || 'graph TD; A-->B;';

    const id = 'mermaid-' + crypto.randomUUID();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'mermaid';
    div.textContent = diagramCode;

    container.appendChild(div);

    await loadMermaid();
    mermaid.init(undefined, '#' + id);
}

function renderParticleSimulator(container, props) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    canvas.style.borderRadius = '8px';
    canvas.style.background = '#e0f7fa';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const numParticles = 100;
    let speedMultiplier = props.temperature === 'high' ? 3 : props.temperature === 'medium' ? 1.5 : 0.5;

    const memory = new WebAssembly.Memory({ initial: 1 });
    const float32Array = new Float32Array(memory.buffer);

    for (let i = 0; i < numParticles; i++) {
        const offset = i * 4;
        float32Array[offset] = Math.random() * canvas.width;
        float32Array[offset + 1] = Math.random() * canvas.height;
        float32Array[offset + 2] = (Math.random() - 0.5) * 2;
        float32Array[offset + 3] = (Math.random() - 0.5) * 2;
    }

    WebAssembly.instantiateStreaming(fetch('dist/physics.wasm'), {
        env: { memory }
    }).then(result => {
        const updateParticles = result.instance.exports.updateParticles;

        const controls = document.createElement('div');
        controls.className = 'component-controls';
        const label = document.createElement('label');
        label.textContent = 'Temperature:';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0.1';
        slider.max = '5';
        slider.step = '0.1';
        slider.value = String(speedMultiplier);
        controls.append(label, slider);
        container.appendChild(controls);

        slider.addEventListener('input', (e) => {
            speedMultiplier = parseFloat(e.target.value);
        });

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            updateParticles(numParticles, canvas.width, canvas.height, speedMultiplier);

            ctx.fillStyle = '#00bcd4';
            for (let i = 0; i < numParticles; i++) {
                const offset = i * 4;
                const x = float32Array[offset];
                const y = float32Array[offset + 1];
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(animate);
        }
        animate();
    }).catch(err => {
        console.error('WASM Load failed:', err);
        const error = document.createElement('div');
        error.className = 'component-error';
        error.textContent = 'Failed to load the physics engine.';
        container.appendChild(error);
    });
}


function renderWhiteboard(container, props) {
    const board = normalizeBoard(props.whiteboard || {}, props.title);
    container.classList.add('whiteboard-component');

    const header = document.createElement('div');
    header.className = 'whiteboard-header';
    const title = document.createElement('h2');
    title.textContent = board.title;
    const goal = document.createElement('p');
    goal.textContent = board.goal || 'Step-by-step board';
    header.append(title, goal);
    container.appendChild(header);

    if (board.basics.length) {
        container.appendChild(renderListSection('Start from basics', board.basics));
    }

    if (board.formula) {
        const formulaSection = document.createElement('section');
        formulaSection.className = 'whiteboard-section formula-section';
        const heading = document.createElement('h3');
        heading.textContent = 'Formula, slowly';
        const formula = document.createElement('div');
        formula.className = 'formula-line';
        formula.textContent = board.formula;
        formulaSection.append(heading, formula);
        if (board.formula_reading) {
            const reading = document.createElement('p');
            reading.textContent = board.formula_reading;
            formulaSection.appendChild(reading);
        }
        container.appendChild(formulaSection);
    }

    if (board.symbols.length) {
        const symbols = document.createElement('section');
        symbols.className = 'whiteboard-section symbols-section';
        const heading = document.createElement('h3');
        heading.textContent = 'What each symbol means';
        const grid = document.createElement('div');
        grid.className = 'symbol-grid';
        board.symbols.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'symbol-card';
            const symbol = document.createElement('strong');
            symbol.textContent = item.symbol || item.label || '?';
            const meaning = document.createElement('span');
            meaning.textContent = item.means || item.meaning || item.detail || '';
            const example = document.createElement('small');
            example.textContent = item.example || '';
            card.append(symbol, meaning, example);
            grid.appendChild(card);
        });
        symbols.append(heading, grid);
        container.appendChild(symbols);
    }

    if (board.steps.length) {
        const steps = document.createElement('section');
        steps.className = 'whiteboard-section steps-section';
        const heading = document.createElement('h3');
        heading.textContent = 'Build it in simple steps';
        const list = document.createElement('ol');
        board.steps.forEach((step, index) => {
            const item = document.createElement('li');
            const label = document.createElement('strong');
            label.textContent = step.label || 'Step ' + (index + 1);
            const detail = document.createElement('p');
            detail.textContent = step.detail || String(step);
            item.append(label, detail);
            list.appendChild(item);

            if (index + 1 === board.check_after_step) {
                const check = document.createElement('li');
                check.className = 'whiteboard-checkpoint';
                check.textContent = board.feedback_prompt || 'Quick check: is it clear so far?';
                list.appendChild(check);
            }
        });
        steps.append(heading, list);
        container.appendChild(steps);
    }

    if (board.worked_example) {
        const example = document.createElement('section');
        example.className = 'whiteboard-section example-section';
        const heading = document.createElement('h3');
        heading.textContent = 'Worked example';
        const body = document.createElement('p');
        body.textContent = board.worked_example;
        example.append(heading, body);
        container.appendChild(example);
    }

    if (board.common_confusions.length) {
        const confusions = document.createElement('section');
        confusions.className = 'whiteboard-section confusion-section';
        const heading = document.createElement('h3');
        heading.textContent = 'Common confusions';
        confusions.appendChild(heading);
        board.common_confusions.forEach((item) => {
            const row = document.createElement('p');
            row.textContent = (item.confusion || 'Confusion') + ' -> ' + (item.fix || 'Use the step-by-step chain.');
            confusions.appendChild(row);
        });
        container.appendChild(confusions);
    }
}

function renderListSection(title, items) {
    const section = document.createElement('section');
    section.className = 'whiteboard-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const list = document.createElement('ul');
    items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = String(item);
        list.appendChild(li);
    });
    section.append(heading, list);
    return section;
}

function normalizeBoard(input, fallbackTitle) {
    if (Array.isArray(input)) {
        return {
            title: fallbackTitle || 'Whiteboard',
            goal: 'Understand the idea step by step.',
            basics: input,
            formula: '',
            formula_reading: '',
            symbols: [],
            steps: input.map((line, index) => ({ label: 'Step ' + (index + 1), detail: line })),
            check_after_step: 2,
            feedback_prompt: 'Quick check: is it clear so far?',
            worked_example: '',
            common_confusions: []
        };
    }

    return {
        title: input.title || fallbackTitle || 'Whiteboard',
        goal: input.goal || '',
        basics: input.basics || [],
        formula: input.formula || '',
        formula_reading: input.formula_reading || '',
        symbols: input.symbols || [],
        steps: input.steps || [],
        check_after_step: input.check_after_step || 2,
        feedback_prompt: input.feedback_prompt || 'Quick check: is it clear so far?',
        worked_example: input.worked_example || '',
        common_confusions: input.common_confusions || []
    };
}

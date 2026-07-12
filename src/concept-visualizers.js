const VISUALIZER_TITLES = {
    'boiling-evaporation': 'Boiling and evaporation visualizer',
    'magnet-field': 'Magnet and material visualizer',
    'ohms-circuit': 'Ohm\'s Law circuit visualizer',
    'photosynthesis-flow': 'Photosynthesis flow visualizer',
    'soap-cleaning': 'Soap and oil cleaning visualizer',
    'area-perimeter': 'Area and perimeter visualizer',
    'sound-wave': 'Sound wave visualizer',
    'coordinate-grid': 'Coordinate grid visualizer',
    'newtons-laws-sim': 'Newton\'s Laws F=ma and impulse visualizer',
    'chemical-bonding-sim': 'Chemical bonding ionic transfer and sharing visualizer',
    'mitosis-genetics-sim': 'Mitosis chromosome separation and DNA replication visualizer'
};

export function getVisualizerTitle(id) {
    return VISUALIZER_TITLES[id] || 'Concept visualizer';
}

export function appendConceptVisualizer({ concept, container }) {
    container.appendChild(renderConceptVisualizer({ concept, visualizer: concept?.visualizer }));
}
export function renderConceptVisualizer({ concept, visualizer }) {
    const id = visualizer?.id || concept?.visualizer?.id;
    const shell = document.createElement('section');
    shell.className = 'concept-visualizer';
    shell.setAttribute('aria-label', getVisualizerTitle(id));

    const header = document.createElement('div');
    header.className = 'concept-visualizer-header';
    const title = document.createElement('h2');
    title.textContent = getVisualizerTitle(id);
    const source = document.createElement('p');
    source.textContent = visualizer?.source ? 'Inspired by: ' + visualizer.source : 'A small static visual to support this topic.';
    header.append(title, source);

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 360;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', getVisualizerTitle(id));

    const controls = document.createElement('div');
    controls.className = 'concept-visualizer-controls';

    shell.append(header, canvas, controls);

    const ctx = canvas.getContext('2d');
    const api = { shell, canvas, ctx, controls, concept, visualizer };

    if (id === 'boiling-evaporation') renderBoilingEvaporation(api);
    else if (id === 'magnet-field') renderMagnetField(api);
    else if (id === 'ohms-circuit') renderOhmsCircuit(api);
    else if (id === 'photosynthesis-flow') renderPhotosynthesis(api);
    else if (id === 'soap-cleaning') renderSoapCleaning(api);
    else if (id === 'area-perimeter') renderAreaPerimeter(api);
    else if (id === 'sound-wave') renderSoundWave(api);
    else if (id === 'coordinate-grid') renderCoordinateGrid(api);
    else if (id === 'newtons-laws-sim') renderNewtonsLaws(api);
    else if (id === 'chemical-bonding-sim') renderChemicalBonding(api);
    else if (id === 'mitosis-genetics-sim') renderMitosis(api);
    else renderUnsupported(api, id);

    return shell;
}

function makeSlider(controls, labelText, min, max, value, step = 1, onInput) {
    const label = document.createElement('label');
    label.className = 'visualizer-slider';
    const text = document.createElement('span');
    const valueLabel = document.createElement('strong');
    text.textContent = labelText;
    valueLabel.textContent = String(value);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
        valueLabel.textContent = input.value;
        onInput(Number(input.value));
    });
    label.append(text, input, valueLabel);
    controls.appendChild(label);
    return input;
}

function clear(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fcf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawLabel(ctx, text, x, y, color = '#173b2a', size = 18) {
    ctx.fillStyle = color;
    ctx.font = '700 ' + size + 'px system-ui, sans-serif';
    ctx.fillText(text, x, y);
}

function renderBoilingEvaporation({ canvas, ctx, controls }) {
    let heat = 55;
    let airflow = 35;
    makeSlider(controls, 'Heat', 0, 100, heat, 1, (v) => { heat = v; draw(); });
    makeSlider(controls, 'Airflow', 0, 100, airflow, 1, (v) => { airflow = v; draw(); });

    function draw() {
        clear(ctx, canvas);
        ctx.fillStyle = '#dff3ff';
        ctx.fillRect(110, 210, 500, 86);
        ctx.strokeStyle = '#245953';
        ctx.lineWidth = 4;
        ctx.strokeRect(105, 205, 510, 96);
        drawLabel(ctx, 'Water surface', 120, 195, '#245953', 16);

        const escapeCount = Math.round(6 + heat / 5 + airflow / 12);
        for (let i = 0; i < 34; i += 1) {
            const x = 130 + (i * 41) % 460;
            const y = 225 + ((i * 29) % 54);
            ctx.beginPath();
            ctx.fillStyle = i < escapeCount ? '#ff8a3d' : '#2aa4d6';
            ctx.arc(x, y - (i < escapeCount ? 20 + i * 2 : 0), i < escapeCount ? 5 : 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.strokeStyle = '#91a7ff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i += 1) {
            const y = 70 + i * 22;
            ctx.beginPath();
            ctx.moveTo(420, y);
            ctx.quadraticCurveTo(500 + airflow, y - 18, 640, y + 4);
            ctx.stroke();
        }
        drawLabel(ctx, 'More heat gives particles energy to escape.', 48, 42);
        drawLabel(ctx, 'Moving air carries vapour away.', 48, 72, '#46594f', 16);
        drawLabel(ctx, 'Evaporation speed: ' + Math.min(100, Math.round((heat * 0.65 + airflow * 0.35))) + '/100', 455, 332, '#8a4b00', 18);
    }
    draw();
}

function renderMagnetField({ canvas, ctx, controls }) {
    let material = 'steel';
    ['steel', 'wood', 'aluminium'].forEach((name) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = name;
        button.addEventListener('click', () => { material = name; draw(); });
        controls.appendChild(button);
    });
    function draw() {
        clear(ctx, canvas);
        ctx.fillStyle = '#d44343';
        ctx.fillRect(80, 135, 82, 90);
        ctx.fillStyle = '#2d69c4';
        ctx.fillRect(162, 135, 82, 90);
        drawLabel(ctx, 'N', 112, 188, '#fff', 28);
        drawLabel(ctx, 'S', 194, 188, '#fff', 28);
        ctx.strokeStyle = '#8aa899';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i += 1) {
            ctx.beginPath();
            ctx.ellipse(162, 180, 120 + i * 26, 38 + i * 12, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        const attracted = material === 'steel';
        const objectX = attracted ? 355 : 505;
        ctx.fillStyle = attracted ? '#6c7883' : material === 'wood' ? '#9b6636' : '#b9c2ca';
        ctx.fillRect(objectX, 150, 96, 58);
        drawLabel(ctx, material, objectX + 10, 238, '#173b2a', 18);
        drawLabel(ctx, attracted ? 'Attracted: iron/steel responds to magnetic force.' : 'No clear attraction: material matters.', 52, 48);
    }
    draw();
}

function renderOhmsCircuit({ canvas, ctx, controls }) {
    let voltage = 6;
    let resistance = 3;
    makeSlider(controls, 'Voltage V', 1, 12, voltage, 1, (v) => { voltage = v; draw(); });
    makeSlider(controls, 'Resistance R', 1, 12, resistance, 1, (v) => { resistance = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        const current = voltage / resistance;
        ctx.strokeStyle = '#173b2a';
        ctx.lineWidth = 5;
        ctx.strokeRect(130, 95, 460, 170);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(103, 146, 54, 72);
        drawLabel(ctx, voltage + ' V', 96, 238, '#8a4b00', 18);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#245953';
        ctx.lineWidth = 4;
        ctx.strokeRect(450, 132, 95, 76);
        drawLabel(ctx, resistance + ' ohm', 462, 176, '#173b2a', 16);
        ctx.strokeStyle = '#ff8a3d';
        ctx.lineWidth = Math.max(2, Math.min(12, current * 3));
        ctx.beginPath();
        ctx.moveTo(180, 180);
        ctx.lineTo(430, 180);
        ctx.stroke();
        drawLabel(ctx, 'I = V / R = ' + current.toFixed(2) + ' A', 248, 52);
        drawLabel(ctx, 'Higher voltage pushes more current; higher resistance slows it.', 86, 318, '#46594f', 16);
    }
    draw();
}

function renderPhotosynthesis({ canvas, ctx, controls }) {
    let sunlight = 70;
    let water = 60;
    let co2 = 55;
    makeSlider(controls, 'Sunlight', 0, 100, sunlight, 1, (v) => { sunlight = v; draw(); });
    makeSlider(controls, 'Water', 0, 100, water, 1, (v) => { water = v; draw(); });
    makeSlider(controls, 'CO2', 0, 100, co2, 1, (v) => { co2 = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        const growth = Math.min(sunlight, water, co2);
        ctx.fillStyle = '#8bd17c';
        ctx.fillRect(315, 185 - growth, 38, 120 + growth);
        ctx.fillStyle = '#21623b';
        ctx.beginPath();
        ctx.ellipse(295, 170 - growth * 0.4, 55, 24, -0.5, 0, Math.PI * 2);
        ctx.ellipse(375, 170 - growth * 0.4, 55, 24, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(95, 72, 38, 0, Math.PI * 2);
        ctx.fill();
        drawLabel(ctx, 'Sunlight + water + CO2', 54, 42);
        drawLabel(ctx, 'Limiting factor controls growth: ' + growth + '/100', 375, 320, '#245953', 18);
        drawLabel(ctx, 'Plant makes food and releases oxygen.', 54, 324, '#46594f', 16);
    }
    draw();
}

function renderSoapCleaning({ canvas, ctx, controls }) {
    let soap = 55;
    makeSlider(controls, 'Soap amount', 0, 100, soap, 1, (v) => { soap = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        ctx.fillStyle = '#6b4a2b';
        ctx.beginPath();
        ctx.ellipse(360, 185, 118, 72, 0, 0, Math.PI * 2);
        ctx.fill();
        const count = Math.round(soap / 8);
        for (let i = 0; i < count; i += 1) {
            const angle = (Math.PI * 2 * i) / Math.max(1, count);
            const x = 360 + Math.cos(angle) * 128;
            const y = 185 + Math.sin(angle) * 82;
            ctx.strokeStyle = '#2aa4d6';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(360 + Math.cos(angle) * 85, 185 + Math.sin(angle) * 50);
            ctx.stroke();
            ctx.fillStyle = '#2aa4d6';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        drawLabel(ctx, 'Soap surrounds oil: water-loving heads outside, oil-loving tails inside.', 46, 50, '#173b2a', 17);
        drawLabel(ctx, 'Micelle strength: ' + soap + '/100', 480, 320, '#245953', 18);
    }
    draw();
}

function renderAreaPerimeter({ canvas, ctx, controls }) {
    let width = 8;
    let height = 5;
    makeSlider(controls, 'Width', 2, 12, width, 1, (v) => { width = v; draw(); });
    makeSlider(controls, 'Height', 2, 10, height, 1, (v) => { height = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        const scale = 28;
        const x = 160;
        const y = 80;
        ctx.fillStyle = '#dff7e2';
        ctx.fillRect(x, y, width * scale, height * scale);
        ctx.strokeStyle = '#245953';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width * scale, height * scale);
        ctx.strokeStyle = 'rgba(36,89,83,0.25)';
        ctx.lineWidth = 1;
        for (let i = 1; i < width; i += 1) line(ctx, x + i * scale, y, x + i * scale, y + height * scale);
        for (let j = 1; j < height; j += 1) line(ctx, x, y + j * scale, x + width * scale, y + j * scale);
        drawLabel(ctx, 'Area = ' + (width * height) + ' squares', 460, 130);
        drawLabel(ctx, 'Perimeter = ' + (2 * (width + height)) + ' units', 460, 168);
        drawLabel(ctx, 'Area fills inside. Perimeter walks around the edge.', 90, 318, '#46594f', 16);
    }
    draw();
}

function renderSoundWave({ canvas, ctx, controls }) {
    let frequency = 4;
    let amplitude = 55;
    makeSlider(controls, 'Frequency', 1, 10, frequency, 1, (v) => { frequency = v; draw(); });
    makeSlider(controls, 'Amplitude', 10, 100, amplitude, 1, (v) => { amplitude = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        ctx.strokeStyle = '#245953';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 40; x < canvas.width - 40; x += 4) {
            const y = 180 + Math.sin((x / 640) * Math.PI * frequency * 2) * amplitude;
            if (x === 40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        drawLabel(ctx, 'Frequency changes pitch. Amplitude changes loudness.', 56, 50);
        drawLabel(ctx, 'Frequency ' + frequency + ' | Amplitude ' + amplitude, 470, 320, '#245953', 18);
    }
    draw();
}

function renderCoordinateGrid({ canvas, ctx, controls }) {
    let xPoint = 3;
    let yPoint = 4;
    makeSlider(controls, 'X', -5, 5, xPoint, 1, (v) => { xPoint = v; draw(); });
    makeSlider(controls, 'Y', -5, 5, yPoint, 1, (v) => { yPoint = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        const ox = 360;
        const oy = 180;
        const scale = 28;
        ctx.strokeStyle = '#d4e3d7';
        ctx.lineWidth = 1;
        for (let i = -10; i <= 10; i += 1) {
            line(ctx, ox + i * scale, 40, ox + i * scale, 320);
            line(ctx, 80, oy + i * scale, 640, oy + i * scale);
        }
        ctx.strokeStyle = '#173b2a';
        ctx.lineWidth = 3;
        line(ctx, 80, oy, 640, oy);
        line(ctx, ox, 40, ox, 320);
        const px = ox + xPoint * scale;
        const py = oy - yPoint * scale;
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        drawLabel(ctx, '(' + xPoint + ', ' + yPoint + ')', px + 12, py - 12, '#8a4b00', 18);
        drawLabel(ctx, 'Move across first, then up or down.', 62, 42);
    }
    draw();
}

function renderNewtonsLaws({ canvas, ctx, controls }) {
    let force = 20;
    let mass = 5;
    makeSlider(controls, 'Force (N)', 5, 100, force, 5, (v) => { force = v; draw(); });
    makeSlider(controls, 'Mass (kg)', 1, 25, mass, 1, (v) => { mass = v; draw(); });
    function draw() {
        clear(ctx, canvas);
        const acc = (force / mass).toFixed(2);
        drawLabel(ctx, 'Newton\'s Second Law: a = F / m', 40, 40);
        drawLabel(ctx, 'Force: ' + force + ' N | Mass: ' + mass + ' kg -> Acceleration: ' + acc + ' m/s²', 40, 70, '#245953', 18);
        const boxX = 100;
        const boxY = 160;
        const boxSize = Math.min(120, 40 + mass * 3);
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(boxX, boxY, boxSize, boxSize);
        drawLabel(ctx, mass + ' kg', boxX + boxSize / 4, boxY + boxSize / 2, '#ffffff', 18);
        ctx.strokeStyle = '#245953';
        ctx.lineWidth = 4;
        const arrowLen = force * 2.5;
        line(ctx, boxX + boxSize, boxY + boxSize / 2, boxX + boxSize + arrowLen, boxY + boxSize / 2);
        drawLabel(ctx, 'F = ' + force + ' N', boxX + boxSize + 10, boxY + boxSize / 2 - 12, '#245953', 16);
    }
    draw();
}

function renderChemicalBonding({ canvas, ctx, controls }) {
    let deltaEN = 2.1;
    makeSlider(controls, 'Electronegativity Diff (ΔEN)', 0.0, 3.2, deltaEN, 0.1, (v) => { deltaEN = Number(v); draw(); });
    function draw() {
        clear(ctx, canvas);
        drawLabel(ctx, 'Chemical Bonding Type & Octet Dynamics', 40, 40);
        const bondType = deltaEN >= 1.7 ? 'Ionic Bonding (Electron Transfer)' : 'Covalent Bonding (Electron Sharing)';
        const color = deltaEN >= 1.7 ? '#d9534f' : '#2e7d32';
        drawLabel(ctx, 'ΔEN: ' + deltaEN.toFixed(1) + ' -> ' + bondType, 40, 70, color, 18);
        const ox = 360;
        const oy = 200;
        ctx.beginPath();
        ctx.arc(ox - 100, oy, 50, 0, Math.PI * 2);
        ctx.fillStyle = '#e3f2fd';
        ctx.fill();
        ctx.stroke();
        drawLabel(ctx, deltaEN >= 1.7 ? 'Cation (+)' : 'Atom A', ox - 135, oy + 5);
        ctx.beginPath();
        ctx.arc(ox + (deltaEN >= 1.7 ? 100 : 20), oy, 50, 0, Math.PI * 2);
        ctx.fillStyle = deltaEN >= 1.7 ? '#ffebee' : '#e8f5e9';
        ctx.fill();
        ctx.stroke();
        drawLabel(ctx, deltaEN >= 1.7 ? 'Anion (-)' : 'Atom B', ox + (deltaEN >= 1.7 ? 65 : -15), oy + 5);
    }
    draw();
}

function renderMitosis({ canvas, ctx, controls }) {
    let phaseIdx = 2;
    const phases = ['Interphase (S Phase S - 2n->4n chromatids)', 'Prophase (Condense)', 'Metaphase (Equatorial line-up)', 'Anaphase (Pull apart)', 'Telophase (Two 2n daughter cells)'];
    makeSlider(controls, 'Stage (0:I, 1:P, 2:M, 3:A, 4:T)', 0, 4, phaseIdx, 1, (v) => { phaseIdx = Number(v); draw(); });
    function draw() {
        clear(ctx, canvas);
        drawLabel(ctx, 'Mitosis Cell Cycle: Preserving 2n Diploid Genome', 40, 40);
        drawLabel(ctx, 'Stage: ' + phases[phaseIdx], 40, 70, '#245953', 18);
        const ox = 360;
        const oy = 210;
        if (phaseIdx < 4) {
            ctx.beginPath();
            ctx.arc(ox, oy, 80, 0, Math.PI * 2);
            ctx.strokeStyle = '#245953';
            ctx.lineWidth = 3;
            ctx.stroke();
            if (phaseIdx === 0) drawLabel(ctx, 'Uncoiled DNA replicating...', ox - 80, oy);
            else if (phaseIdx === 1) drawLabel(ctx, 'X Chromosomes condensing...', ox - 90, oy);
            else if (phaseIdx === 2) {
                drawLabel(ctx, 'X  X  X  X', ox - 40, oy);
                line(ctx, ox - 100, oy, ox + 100, oy);
            }
            else if (phaseIdx === 3) {
                drawLabel(ctx, '<-- X  |  X -->', ox - 50, oy);
            }
        } else {
            ctx.beginPath();
            ctx.arc(ox - 90, oy, 60, 0, Math.PI * 2);
            ctx.arc(ox + 90, oy, 60, 0, Math.PI * 2);
            ctx.stroke();
            drawLabel(ctx, '2n Cell A', ox - 125, oy);
            drawLabel(ctx, '2n Cell B', ox + 55, oy);
        }
    }
    draw();
}

function renderUnsupported({ canvas, ctx }, id) {
    clear(ctx, canvas);
    drawLabel(ctx, 'Visualizer not available yet: ' + id, 70, 180);
}

function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}
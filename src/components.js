// Declarative Render Engine for Sakha Static

export function renderComponent(componentName, props) {
    const container = document.createElement('div');
    container.className = 'interactive-component';

    if (componentName === 'ParticleSimulator') {
        renderParticleSimulator(container, props);
    } else if (componentName === 'MermaidDiagram') {
        renderMermaid(container, props);
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

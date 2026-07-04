// Declarative Render Engine for Sakha Static

export function renderComponent(componentName, props) {
    const container = document.createElement('div');
    container.className = 'interactive-component';

    if (componentName === 'ParticleSimulator') {
        renderParticleSimulator(container, props);
    } else if (componentName === 'MermaidDiagram') {
        renderMermaid(container, props);
    } else {
        container.innerHTML = `<div style="padding: 10px; color: red;">Unknown component: ${componentName}</div>`;
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
    
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.id = id;
    div.className = 'mermaid';
    div.textContent = diagramCode;
    
    container.appendChild(div);
    
    await loadMermaid();
    mermaid.init(undefined, `#${id}`);
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
        let offset = i * 4;
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
        controls.innerHTML = `
            <label style="font-family: var(--font-body); margin-right: 10px;">Temperature:</label>
            <input type="range" min="0.1" max="5" step="0.1" value="${speedMultiplier}" id="tempSlider">
        `;
        container.appendChild(controls);

        document.getElementById('tempSlider').addEventListener('input', (e) => {
            speedMultiplier = parseFloat(e.target.value);
        });

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            updateParticles(numParticles, canvas.width, canvas.height, speedMultiplier);

            ctx.fillStyle = '#00bcd4';
            for (let i = 0; i < numParticles; i++) {
                let offset = i * 4;
                let x = float32Array[offset];
                let y = float32Array[offset + 1];
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(animate);
        }
        animate();
    }).catch(err => {
        console.error("WASM Load failed:", err);
        container.innerHTML += `<div style="color:red">Failed to load WASM physics engine. Fallback JS not implemented.</div>`;
    });
}

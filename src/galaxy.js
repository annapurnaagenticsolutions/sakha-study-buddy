import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export async function initGalaxy(containerId, onNodeClick) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Basic Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a1a');

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    // Fetch the 103 concepts
    let concepts = [];
    try {
        const res = await fetch('content/all_concepts.json');
        concepts = await res.json();
    } catch (e) {
        console.error("Failed to load concepts for galaxy", e);
        // Fallback for demo
        concepts = [
            { id: 'ice-melting', title: 'Ice Melting', x: 0, y: 0, z: 0, unlocked: true },
            { id: 'boiling-water', title: 'Boiling Water', x: 20, y: 10, z: -10, unlocked: false }
        ];
    }

    const nodes = [];
    const SUBJECT_COLORS = {
        'Physics': 0x00bcd4,      // cyan
        'Chemistry': 0x4caf50,    // green
        'Biology': 0xff9800,      // orange
        'Math': 0x9c27b0,         // purple
        'Life Skills': 0xf44336,  // red
        'Engineering': 0x2196f3,  // blue
    };

    concepts.forEach(c => {
        const color = SUBJECT_COLORS[c.subject] || 0x00bcd4;
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: c.unlocked ? color : 0x555555,
            wireframe: !c.unlocked
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(c.x, c.y, c.z);
        sphere.userData = c;
        scene.add(sphere);
        nodes.push(sphere);

        // Add Label
        const label = document.createElement('div');
        if (c.unlocked) {
            label.className = 'concept-label unlocked-label';
            label.innerHTML = `<div class="subject-tag">${c.subject || 'Subject'}</div><div class="title-tag">${c.title}</div>`;
            label.style.borderColor = '#' + color.toString(16).padStart(6, '0');
        } else {
            label.className = 'concept-label';
            label.textContent = c.title;
        }
        
        const labelObj = new CSS2DObject(label);
        labelObj.position.set(0, 3.5, 0); // Moved slightly higher so it doesn't overlap the sphere as much
        sphere.add(labelObj);

        // Add lines connecting them (Skill Tree logic)
        if (c.id !== 'ice-melting') {
            const materialLine = new THREE.LineBasicMaterial({ color: 0x333333 });
            const points = [];
            points.push(new THREE.Vector3(0, 0, 0));
            points.push(new THREE.Vector3(c.x, c.y, c.z));
            const geometryLine = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometryLine, materialLine);
            scene.add(line);
        }
    });

    // Raycaster for clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(nodes);

        if (intersects.length > 0) {
            const clickedNode = intersects[0].object.userData;
            if (clickedNode.unlocked) {
                onNodeClick(clickedNode.id);
            } else {
                alert('Concept Locked! Complete previous concepts first.');
            }
        }
    }

    window.addEventListener('click', onClick);

    // Animation Loop
    let animationFrameId = 0;
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        nodes.forEach(n => {
            n.rotation.y += 0.01;
            n.rotation.x += 0.005;
        });
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }

    animate();

    // Handle resize
    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onResize);

    // Setup Filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const subject = e.target.getAttribute('data-subject');
            
            nodes.forEach(sphere => {
                if (subject === 'all' || sphere.userData.subject === subject) {
                    sphere.visible = true;
                    // Also show labels
                    sphere.children.forEach(child => child.visible = true);
                } else {
                    sphere.visible = false;
                    // Hide labels
                    sphere.children.forEach(child => child.visible = false);
                }
            });
        });
    });

    return {
        destroy: () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('click', onClick);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            container.removeChild(renderer.domElement);
            container.removeChild(labelRenderer.domElement);
        }
    };
}

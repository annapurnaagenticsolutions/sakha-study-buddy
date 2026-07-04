// WASM Physics Engine for ParticleSimulator
// Compiles with AssemblyScript

// We will use the module's memory to store particle data:
// For each particle: [x: f32, y: f32, vx: f32, vy: f32]
// Total 16 bytes per particle.

export function updateParticles(numParticles: i32, width: f32, height: f32, speedMultiplier: f32): void {
  for (let i = 0; i < numParticles; i++) {
    let offset = i * 16;
    
    let x = load<f32>(offset);
    let y = load<f32>(offset + 4);
    let vx = load<f32>(offset + 8);
    let vy = load<f32>(offset + 12);
    
    // Update position
    x += vx * speedMultiplier;
    y += vy * speedMultiplier;
    
    // Bounce off walls
    if (x <= 0) {
        x = 0;
        vx = -vx;
    } else if (x >= width) {
        x = width;
        vx = -vx;
    }
    
    if (y <= 0) {
        y = 0;
        vy = -vy;
    } else if (y >= height) {
        y = height;
        vy = -vy;
    }
    
    // Store new position and velocity
    store<f32>(offset, x);
    store<f32>(offset + 4, y);
    store<f32>(offset + 8, vx);
    store<f32>(offset + 12, vy);
  }
}

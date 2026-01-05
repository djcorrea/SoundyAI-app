/**
 * 🌌 NEURAL NETWORK BACKGROUND - WebGL Optimized
 * Ultra-tech holographic constellation com performance guardrails
 * Versão: 1.0.0
 * 
 * FEATURES:
 * - Neural network constellation (pontos + linhas conectadas)
 * - Mouse parallax suave (lerp smoothing)
 * - Glow sutil via shader material
 * - Performance guardrails (DPR cap, FPS cap, pause on hidden)
 * - Mobile optimization & prefers-reduced-motion support
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO & GUARDRAILS
    // ═══════════════════════════════════════════════════════════════
    
    const CONFIG = {
        // Performance
        MAX_DPR: 1.5,
        TARGET_FPS: 50,
        MIN_FRAME_TIME: 1000 / 60, // ~16.67ms
        
        // Visual - Desktop
        PARTICLES_DESKTOP: 150,
        CONNECTION_DISTANCE: 180,
        PARTICLE_SIZE: 2.0,
        LINE_OPACITY: 0.15,
        
        // Visual - Mobile
        PARTICLES_MOBILE: 50,
        CONNECTION_DISTANCE_MOBILE: 120,
        PARTICLE_SIZE_MOBILE: 1.5,
        
        // Mouse parallax
        MOUSE_INFLUENCE: 0.03,
        LERP_FACTOR: 0.08,
        
        // Colors (neon tech)
        PRIMARY_COLOR: 0x00d9ff,    // Cyan neon
        SECONDARY_COLOR: 0x8b5cf6,  // Purple
        BACKGROUND_COLOR: 0x0a0a0f, // Deep dark
        
        // Glow
        GLOW_INTENSITY: 1.5,
        GLOW_SIZE: 0.5
    };
    
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    const state = {
        scene: null,
        camera: null,
        renderer: null,
        particles: [],
        lines: [],
        mouse: { x: 0, y: 0 },
        mouseTarget: { x: 0, y: 0 },
        isActive: true,
        isMobile: false,
        reducedMotion: false,
        lastFrameTime: 0,
        frameCount: 0
    };
    
    // ═══════════════════════════════════════════════════════════════
    // DEVICE DETECTION
    // ═══════════════════════════════════════════════════════════════
    
    function detectDevice() {
        const ua = navigator.userAgent.toLowerCase();
        const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua);
        const isWeakDevice = isMobile || navigator.hardwareConcurrency < 4;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        state.isMobile = isMobile;
        state.reducedMotion = reducedMotion;
        
        console.log('🌌 [NEURAL-BG] Device:', {
            mobile: isMobile,
            weak: isWeakDevice,
            reducedMotion,
            cores: navigator.hardwareConcurrency
        });
        
        return { isMobile, isWeakDevice, reducedMotion };
    }
    
    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    
    function init() {
        console.log('🌌 [NEURAL-BG] Initializing...');
        
        const device = detectDevice();
        
        // Respeitar prefers-reduced-motion
        if (device.reducedMotion) {
            console.log('🌌 [NEURAL-BG] Reduced motion detected - static mode');
            createStaticBackground();
            return;
        }
        
        // Canvas setup
        const canvas = document.getElementById('neural-canvas');
        if (!canvas) {
            console.error('🌌 [NEURAL-BG] Canvas not found!');
            return;
        }
        
        // Three.js setup
        state.scene = new THREE.Scene();
        state.scene.fog = new THREE.FogExp2(CONFIG.BACKGROUND_COLOR, 0.001);
        
        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        state.camera = new THREE.PerspectiveCamera(75, aspect, 1, 3000);
        state.camera.position.z = 500;
        
        // Renderer com DPR cap
        state.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: !device.isMobile,
            alpha: true,
            powerPreference: device.isMobile ? 'low-power' : 'high-performance'
        });
        
        const dpr = Math.min(window.devicePixelRatio, CONFIG.MAX_DPR);
        state.renderer.setPixelRatio(dpr);
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.setClearColor(CONFIG.BACKGROUND_COLOR, 1);
        
        console.log('🌌 [NEURAL-BG] Renderer DPR:', dpr);
        
        // Create neural network
        createNeuralNetwork();
        
        // Event listeners
        setupEventListeners();
        
        // Start render loop
        animate();
        
        console.log('🌌 [NEURAL-BG] ✅ Initialized');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // NEURAL NETWORK CREATION
    // ═══════════════════════════════════════════════════════════════
    
    function createNeuralNetwork() {
        const particleCount = state.isMobile ? 
            CONFIG.PARTICLES_MOBILE : 
            CONFIG.PARTICLES_DESKTOP;
            
        const particleSize = state.isMobile ?
            CONFIG.PARTICLE_SIZE_MOBILE :
            CONFIG.PARTICLE_SIZE;
        
        // Particle geometry com glow
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({
            color: CONFIG.PRIMARY_COLOR,
            size: particleSize,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        const positions = [];
        const velocities = [];
        
        // Criar partículas em distribuição 3D
        for (let i = 0; i < particleCount; i++) {
            const x = (Math.random() - 0.5) * 1000;
            const y = (Math.random() - 0.5) * 1000;
            const z = (Math.random() - 0.5) * 1000;
            
            positions.push(x, y, z);
            
            // Velocidade suave para movimento orgânico
            velocities.push(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            
            state.particles.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                )
            });
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const points = new THREE.Points(geometry, material);
        state.scene.add(points);
        state.particlesMesh = points;
        
        console.log('🌌 [NEURAL-BG] Created', particleCount, 'particles');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // CONNECTION LINES (Neural Network)
    // ═══════════════════════════════════════════════════════════════
    
    function updateConnections() {
        // Limpar linhas antigas
        state.lines.forEach(line => state.scene.remove(line));
        state.lines = [];
        
        const positions = state.particlesMesh.geometry.attributes.position.array;
        const particleCount = positions.length / 3;
        const maxDistance = state.isMobile ? 
            CONFIG.CONNECTION_DISTANCE_MOBILE : 
            CONFIG.CONNECTION_DISTANCE;
        
        // Limitar conexões para performance (só checar vizinhos próximos)
        const maxConnections = state.isMobile ? 3 : 5;
        
        for (let i = 0; i < particleCount; i++) {
            const p1 = new THREE.Vector3(
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            );
            
            let connections = 0;
            
            for (let j = i + 1; j < particleCount; j++) {
                if (connections >= maxConnections) break;
                
                const p2 = new THREE.Vector3(
                    positions[j * 3],
                    positions[j * 3 + 1],
                    positions[j * 3 + 2]
                );
                
                const distance = p1.distanceTo(p2);
                
                if (distance < maxDistance) {
                    const opacity = CONFIG.LINE_OPACITY * (1 - distance / maxDistance);
                    
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                    const lineMaterial = new THREE.LineBasicMaterial({
                        color: CONFIG.PRIMARY_COLOR,
                        transparent: true,
                        opacity: opacity,
                        blending: THREE.AdditiveBlending
                    });
                    
                    const line = new THREE.Line(lineGeometry, lineMaterial);
                    state.scene.add(line);
                    state.lines.push(line);
                    
                    connections++;
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════
    
    function animate() {
        if (!state.isActive) return;
        
        requestAnimationFrame(animate);
        
        const now = performance.now();
        const delta = now - state.lastFrameTime;
        
        // FPS cap - pular frames se muito rápido
        if (delta < CONFIG.MIN_FRAME_TIME) return;
        
        state.lastFrameTime = now;
        state.frameCount++;
        
        // Update a cada frame
        updateParticles(delta);
        
        // Connections menos frequentes (a cada 3 frames)
        if (state.frameCount % 3 === 0) {
            updateConnections();
        }
        
        // Mouse parallax suave
        updateMouseParallax();
        
        // Render
        state.renderer.render(state.scene, state.camera);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PARTICLE UPDATE
    // ═══════════════════════════════════════════════════════════════
    
    function updateParticles(delta) {
        if (!state.particlesMesh) return;
        
        const positions = state.particlesMesh.geometry.attributes.position.array;
        const time = Date.now() * 0.0001;
        
        for (let i = 0; i < positions.length; i += 3) {
            // Movimento suave
            positions[i] += state.particles[i / 3].velocity.x;
            positions[i + 1] += state.particles[i / 3].velocity.y;
            positions[i + 2] += state.particles[i / 3].velocity.z;
            
            // Bounce nos limites
            if (Math.abs(positions[i]) > 500) state.particles[i / 3].velocity.x *= -1;
            if (Math.abs(positions[i + 1]) > 500) state.particles[i / 3].velocity.y *= -1;
            if (Math.abs(positions[i + 2]) > 500) state.particles[i / 3].velocity.z *= -1;
            
            // Wave sutil
            positions[i + 1] += Math.sin(time + i) * 0.1;
        }
        
        state.particlesMesh.geometry.attributes.position.needsUpdate = true;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MOUSE PARALLAX (Smoothed)
    // ═══════════════════════════════════════════════════════════════
    
    function updateMouseParallax() {
        // Lerp suave para target
        state.mouse.x += (state.mouseTarget.x - state.mouse.x) * CONFIG.LERP_FACTOR;
        state.mouse.y += (state.mouseTarget.y - state.mouse.y) * CONFIG.LERP_FACTOR;
        
        // Aplicar rotação suave da câmera
        state.camera.position.x = state.mouse.x * CONFIG.MOUSE_INFLUENCE * 100;
        state.camera.position.y = state.mouse.y * CONFIG.MOUSE_INFLUENCE * 100;
        state.camera.lookAt(state.scene.position);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════
    
    function setupEventListeners() {
        // Mouse move
        window.addEventListener('mousemove', (e) => {
            state.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
            state.mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
        
        // Resize
        window.addEventListener('resize', onResize);
        
        // Visibility change - pausar quando aba não está ativa
        document.addEventListener('visibilitychange', () => {
            state.isActive = !document.hidden;
            console.log('🌌 [NEURAL-BG]', state.isActive ? 'Resumed' : 'Paused');
        });
    }
    
    function onResize() {
        if (!state.camera || !state.renderer) return;
        
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STATIC FALLBACK (prefers-reduced-motion)
    // ═══════════════════════════════════════════════════════════════
    
    function createStaticBackground() {
        const canvas = document.getElementById('neural-canvas');
        if (!canvas) return;
        
        canvas.style.background = `
            radial-gradient(circle at 20% 50%, rgba(0, 217, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, #0a0a0f 0%, #050508 100%)
        `;
        
        console.log('🌌 [NEURAL-BG] Static background created');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    
    window.NeuralBackground = {
        init: init,
        destroy: () => {
            state.isActive = false;
            if (state.renderer) {
                state.renderer.dispose();
                state.renderer = null;
            }
            console.log('🌌 [NEURAL-BG] Destroyed');
        },
        pause: () => { state.isActive = false; },
        resume: () => { state.isActive = true; }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // AUTO-INIT quando Three.js estiver pronto
    // ═══════════════════════════════════════════════════════════════
    
    if (typeof THREE !== 'undefined') {
        // Se Three.js já carregou, iniciar imediatamente
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    } else {
        // Aguardar carregamento do Three.js
        window.addEventListener('load', () => {
            if (typeof THREE !== 'undefined') {
                init();
            } else {
                console.error('🌌 [NEURAL-BG] Three.js not loaded');
            }
        });
    }
    
})();

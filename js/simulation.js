import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from './constants.js';

export class TidalSimulation {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.initScene();
    this.initObjects();
    this.initControls();
    
    this.mode = 'mercury';
    this.paused = false;
    this.orbitAngle = 0;
    this.moonAngle = 0;
    this.earthSpin = 0;
    
    this.currentDist = CONFIG.MERCURY_DIST;
    this.targetDist = CONFIG.MERCURY_DIST;
    this.currentBulge = CONFIG.DEFAULT_SUN_BULGE;
    this.targetBulge = CONFIG.DEFAULT_SUN_BULGE;
    this.simSpeed = 1.0;
    
    // Recording
    this.history = [];
    this.isPlayingBack = false;
    this.playbackIndex = 0;
    this.maxHistory = 600; // ~10 seconds at 60fps
    
    this.lastBulgeUpdate = 0;
    this.clock = new THREE.Clock();
    
    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initScene() {
    const W = window.innerWidth, H = window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: window.innerWidth > 768, // Disable antialias on mobile for performance
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped at 1.5 for performance
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, W/H, 0.01, 2000);
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0x1a2a4a, 0.6);
    this.scene.add(ambient);
    this.sunLight = new THREE.PointLight(0xfff4e0, 3, 120);
    this.scene.add(this.sunLight);
  }

  initObjects() {
    // Stars - reduced count for mobile performance
    const isMobile = window.innerWidth < 768;
    const starCount = isMobile ? 1000 : 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    for(let i=0; i<starCount; i++){
      starPositions.push((Math.random()-0.5)*600, (Math.random()-0.5)*600, (Math.random()-0.5)*600);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Sun
    const segments = isMobile ? 16 : 32; // Lower geometry complexity on mobile
    const sunGeo = new THREE.SphereGeometry(CONFIG.SUN_RADIUS, segments, segments);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xF2A623 });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.set(CONFIG.SUN_POS.x, CONFIG.SUN_POS.y, CONFIG.SUN_POS.z);
    this.scene.add(this.sun);
    this.sunLight.position.copy(this.sun.position);

    // Sun glow
    this.glow = this.createSunGlow();
    this.scene.add(this.glow);

    // Orbit rings
    this.mercuryOrbit = this.makeOrbitRing(CONFIG.MERCURY_DIST, 0xff7b4a, 0.3);
    this.earthOrbit   = this.makeOrbitRing(CONFIG.EARTH_DIST,   0x3B8BD4, 0.2);
    this.scene.add(this.mercuryOrbit);
    this.scene.add(this.earthOrbit);

    // Earth (Ocean + Core)
    this.initEarth();

    // Raycaster for annotations
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Moon
    const moonGeo = new THREE.SphereGeometry(CONFIG.MOON_RADIUS, 20, 20);
    const moonMat = new THREE.MeshPhongMaterial({ color: 0xc8d8f0, emissive: 0x1a2030, shininess: 20 });
    this.moon = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moon);

    // Moon orbit ring
    this.moonOrbitLine = this.makeMoonOrbitRing();
    this.scene.add(this.moonOrbitLine);

    // Gravity beam
    const beamPts = [new THREE.Vector3(-6.2,0,0), new THREE.Vector3(-1,0,0)];
    this.beamGeo = new THREE.BufferGeometry().setFromPoints(beamPts);
    const beamMat = new THREE.LineBasicMaterial({ color: 0xff7b4a, transparent: true, opacity: 0.25 });
    this.beam = new THREE.Line(this.beamGeo, beamMat);
    this.scene.add(this.beam);
  }

  createSunGlow() {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const gc = glowCanvas.getContext('2d');
    const grad = gc.createRadialGradient(64,64,8,64,64,64);
    grad.addColorStop(0,'rgba(255,200,80,0.9)');
    grad.addColorStop(0.3,'rgba(255,160,40,0.5)');
    grad.addColorStop(1,'rgba(255,100,0,0)');
    gc.fillStyle=grad; gc.fillRect(0,0,128,128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(8,8,1);
    glow.position.copy(this.sun.position);
    return glow;
  }

  makeOrbitRing(r, col, opacity=0.25) {
    const pts = [];
    for(let i=0;i<=128;i++){
      const a = (i/128)*Math.PI*2;
      pts.push(new THREE.Vector3(Math.cos(a)*r + CONFIG.SUN_POS.x, 0, Math.sin(a)*r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity });
    return new THREE.Line(geo, mat);
  }

  makeMoonOrbitRing() {
    const pts = [];
    for(let i=0;i<=64;i++){
      const a=(i/64)*Math.PI*2;
      pts.push(new THREE.Vector3(Math.cos(a)*CONFIG.MOON_ORBIT_RADIUS, 0, Math.sin(a)*CONFIG.MOON_ORBIT_RADIUS));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc8d8f0, transparent: true, opacity: 0.15 }));
  }

  initEarth() {
    const isMobile = window.innerWidth < 768;
    const segments = isMobile ? 32 : 64;
    const sunDir = new THREE.Vector3(1, 0, 0);
    const moonDir = new THREE.Vector3(-1, 0, 0);
    
    const oceanGeo = this.makeTidalEarth(CONFIG.DEFAULT_SUN_BULGE, CONFIG.DEFAULT_MOON_BULGE, sunDir, moonDir, segments);
    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0x1565c0,
      emissive: 0x0a1a3a,
      shininess: 80,
      transparent: true,
      opacity: 0.60,
    });
    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.scene.add(this.ocean);

    // Tidal overlay
    this.tidalTex = this.createTidalTexture();
    const overlayMat = new THREE.MeshBasicMaterial({ map: this.tidalTex, transparent: true, opacity: 0.7, depthWrite: false });
    this.tidalOverlay = new THREE.Mesh(oceanGeo.clone(), overlayMat);
    this.ocean.add(this.tidalOverlay);

    // Atmosphere
    const atmGeo = new THREE.SphereGeometry(0.92, 32, 32);
    const atmMat = new THREE.MeshPhongMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    this.ocean.add(new THREE.Mesh(atmGeo, atmMat));

    // Core
    const coreGeo = new THREE.SphereGeometry(0.83, 48, 48);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x2e5e1e,
      emissive: 0x0a1a08,
      shininess: 10,
    });
    this.earthCore = new THREE.Mesh(coreGeo, coreMat);
    this.addContinents();
    this.ocean.add(this.earthCore);
  }

  createTidalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const tc = canvas.getContext('2d');
    const imgData = tc.createImageData(512,256);
    for(let py=0;py<256;py++){
      for(let px=0;px<512;px++){
        const lon = (px/512)*Math.PI*2 - Math.PI;
        const lat = (py/256)*Math.PI - Math.PI/2;
        const cosX = Math.cos(lat)*Math.cos(lon);
        const P2 = (3*cosX*cosX-1)/2;
        let r,g,b,a;
        if(P2>0){
          const t=P2;
          r=Math.round(50+180*t); g=Math.round(80+60*t); b=Math.round(180-130*t); a=Math.round(120+100*t);
        } else {
          const t=-P2;
          r=Math.round(20+30*t); g=Math.round(60+80*t); b=Math.round(160+80*t); a=Math.round(80+80*t);
        }
        const idx=(py*512+px)*4;
        imgData.data[idx]=r; imgData.data[idx+1]=g; imgData.data[idx+2]=b; imgData.data[idx+3]=a;
      }
    }
    tc.putImageData(imgData,0,0);
    return new THREE.CanvasTexture(canvas);
  }

  addContinents() {
    const addCoreLand = (lat, lon, r, col) => {
      const g = new THREE.SphereGeometry(r, 10, 10);
      const m = new THREE.MeshPhongMaterial({ color: col, emissive: 0x081008 });
      const patch = new THREE.Mesh(g, m);
      const radius = 0.835;
      patch.position.set(radius*Math.cos(lat)*Math.cos(lon), radius*Math.sin(lat), radius*Math.cos(lat)*Math.sin(lon));
      patch.lookAt(new THREE.Vector3(0,0,0));
      patch.scale.set(1, 0.18, 1);
      this.earthCore.add(patch);
    };
    addCoreLand( 0.2,  0.35, 0.28, 0x8B6914);
    addCoreLand( 0.5,  0.2,  0.18, 0x6B8C3A);
    addCoreLand( 0.3, -1.3,  0.22, 0x7A9E3B);
    addCoreLand(-0.2, -0.9,  0.19, 0x5C7A2A);
    addCoreLand( 0.4,  1.6,  0.30, 0x8B7355);
    addCoreLand( 0.1,  2.2,  0.20, 0x6B8C3A);
    addCoreLand(-0.4,  2.5,  0.15, 0xC4A35A);
    addCoreLand(-1.4,  0.0,  0.22, 0xdde8f0);
    addCoreLand( 1.2, -0.7,  0.10, 0xd0dde8);
  }

  makeTidalEarth(sunBulge, moonBulge, sunDir, moonDir, segments = 64) {
    const geo = new THREE.SphereGeometry(CONFIG.EARTH_RADIUS, segments, segments);
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
      const len = Math.sqrt(x*x+y*y+z*z);
      const nx=x/len, ny=y/len, nz=z/len;
      const cosS = nx*sunDir.x + ny*sunDir.y + nz*sunDir.z;
      const P2sun = (3*cosS*cosS - 1) / 2;
      const cosM = nx*moonDir.x + ny*moonDir.y + nz*moonDir.z;
      const P2moon = (3*cosM*cosM - 1) / 2;
      const scale = 1 + sunBulge * P2sun + moonBulge * P2moon;
      pos.setXYZ(i, x*scale, y*scale, z*scale);
    }
    geo.computeVertexNormals();
    return geo;
  }

  initControls() {
    this.isDragging = false;
    this.prevMouse = {x:0, y:0};
    this.spherical = { theta: 0.3, phi: 1.1, r: 12 };
    this.updateCamera();

    const el = this.renderer.domElement;
    el.addEventListener('mousedown', e => { this.isDragging=true; this.prevMouse={x:e.clientX,y:e.clientY}; });
    window.addEventListener('mouseup', () => this.isDragging=false);
    window.addEventListener('mousemove', e => {
      if(!this.isDragging) return;
      const dx=(e.clientX-this.prevMouse.x)*0.006;
      const dy=(e.clientY-this.prevMouse.y)*0.006;
      this.spherical.theta -= dx;
      this.spherical.phi = Math.max(0.2, Math.min(Math.PI-0.2, this.spherical.phi+dy));
      this.prevMouse={x:e.clientX,y:e.clientY};
      this.updateCamera();
    });
    el.addEventListener('wheel', e => {
      this.spherical.r = Math.max(4, Math.min(30, this.spherical.r + e.deltaY*0.02));
      this.updateCamera();
    });

    // Touch events for mobile
    el.addEventListener('touchstart', e => { 
      this.isDragging = true; 
      this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
    }, { passive: true });
    window.addEventListener('touchend', () => this.isDragging = false);
    window.addEventListener('touchmove', e => {
      if(!this.isDragging) return;
      const dx = (e.touches[0].clientX - this.prevMouse.x) * 0.006;
      const dy = (e.touches[0].clientY - this.prevMouse.y) * 0.006;
      this.spherical.theta -= dx;
      this.spherical.phi = Math.max(0.2, Math.min(Math.PI-0.2, this.spherical.phi + dy));
      this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.updateCamera();
    }, { passive: true });
  }

  updateCamera() {
    this.camera.position.x = this.spherical.r * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
    this.camera.position.y = this.spherical.r * Math.cos(this.spherical.phi);
    this.camera.position.z = this.spherical.r * Math.sin(this.spherical.phi) * this.spherical.r * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
    // Wait, the Z calculation was wrong in my head, let me fix it
    this.camera.position.z = this.spherical.r * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
    this.camera.lookAt(0, 0, 0);
  }

  onMouseMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([this.sun, this.ocean, this.moon]);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (this.hoveredObject !== obj) {
        this.hoveredObject = obj;
        let label = "";
        if (obj === this.sun) label = "The Sun: Its massive gravity creates solar tides, though weaker than the Moon's due to distance.";
        else if (obj === this.ocean) label = "Earth's Oceans: The differential pull of gravity stretches the water into an ellipsoid shape.";
        else if (obj === this.moon) label = "The Moon: The primary driver of tides on Earth due to its proximity.";
        
        if (this.onHover) this.onHover(label, e.clientX, e.clientY);
      }
    } else {
      if (this.hoveredObject) {
        this.hoveredObject = null;
        if (this.onHover) this.onHover(null);
      }
    }
  }

  onResize() {
    const w=window.innerWidth, h=window.innerHeight;
    this.renderer.setSize(w,h);
    this.camera.aspect=w/h;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();

    if(!this.paused && !this.isPlayingBack) {
      this.orbitAngle += dt * 0.18 * this.simSpeed;
      this.moonAngle  += dt * 0.8 * this.simSpeed;
      this.earthSpin  += dt * 0.3 * this.simSpeed;

      // Record state
      this.history.push({
        orbitAngle: this.orbitAngle,
        moonAngle: this.moonAngle,
        earthSpin: this.earthSpin,
        dist: this.currentDist,
        bulge: this.currentBulge
      });
      if (this.history.length > this.maxHistory) this.history.shift();
    } else if (this.isPlayingBack) {
      const state = this.history[this.playbackIndex];
      if (state) {
        this.orbitAngle = state.orbitAngle;
        this.moonAngle = state.moonAngle;
        this.earthSpin = state.earthSpin;
        this.currentDist = state.dist;
        this.currentBulge = state.bulge;
        this.playbackIndex = (this.playbackIndex + 1) % this.history.length;
      }
    }

    this.currentDist  += (this.targetDist  - this.currentDist)  * 0.03;
    this.currentBulge += (this.targetBulge - this.currentBulge) * 0.02;

    this.lastBulgeUpdate += dt;

    const ex = Math.cos(this.orbitAngle) * this.currentDist + CONFIG.SUN_POS.x;
    const ez = Math.sin(this.orbitAngle) * this.currentDist;
    this.ocean.position.set(ex, 0, ez);

    const moonX = ex + Math.cos(this.moonAngle) * CONFIG.MOON_ORBIT_RADIUS;
    const moonZ = ez + Math.sin(this.moonAngle) * CONFIG.MOON_ORBIT_RADIUS;
    this.moon.position.set(moonX, 0, moonZ);

    const toSunWorld  = new THREE.Vector3(CONFIG.SUN_POS.x - ex, 0, -ez).normalize();
    const toMoonWorld = new THREE.Vector3(moonX - ex, 0, moonZ - ez).normalize();

    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), toSunWorld);
    this.ocean.quaternion.copy(quat);

    const moonDirLocal = toMoonWorld.clone().applyQuaternion(quat.clone().invert());
    const sunDirLocal  = new THREE.Vector3(1, 0, 0);

    if(this.lastBulgeUpdate > 0.08) {
      this.updateTidalGeo(this.currentBulge, 0.09, sunDirLocal, moonDirLocal);
      this.lastBulgeUpdate = 0;
    }

    this.moonOrbitLine.position.set(ex, 0, ez);

    // Gravity beam Sun→Earth
    const beamPositions = this.beamGeo.attributes.position;
    beamPositions.setXYZ(0, CONFIG.SUN_POS.x + 1.8, 0, 0);
    const distToSun = Math.sqrt(Math.pow(ex-CONFIG.SUN_POS.x, 2) + ez*ez);
    beamPositions.setXYZ(1, ex - (ex-CONFIG.SUN_POS.x)/distToSun*0.9, 0, ez - ez/distToSun*0.9);
    this.beamGeo.attributes.position.needsUpdate = true;

    // Subtle sun pulse
    const s = 1 + 0.04*Math.sin(this.clock.getElapsedTime()*1.5);
    this.sun.scale.set(s,s,s);
    this.glow.scale.set(7*s+0.5,7*s+0.5,1);

    this.renderer.render(this.scene, this.camera);
    
    if(this.onUpdate) this.onUpdate({ex, ez, moonX, moonZ, theta: this.spherical.theta});
  }

  updateTidalGeo(sunBulge, moonBulge, sunDir, moonDir) {
    const isMobile = window.innerWidth < 768;
    const segments = isMobile ? 32 : 64;
    const geo = this.makeTidalEarth(sunBulge, moonBulge, sunDir, moonDir, segments);
    this.ocean.geometry.dispose();
    this.ocean.geometry = geo;
    this.tidalOverlay.geometry.dispose();
    this.tidalOverlay.geometry = geo.clone();
  }

  setMode(m) {
    this.mode = m;
    if(m==='mercury') {
      this.targetDist = CONFIG.MERCURY_DIST;
      this.targetBulge = 0.18;
    } else if (m==='earth') {
      this.targetDist = CONFIG.EARTH_DIST;
      this.targetBulge = 0.04;
    }
  }

  setDistance(dist) {
    this.targetDist = dist;
    // Calculate bulge based on inverse cube law (relative to Earth at 1.0 AU)
    // Tidal force proportional to 1/R^3
    const earthDistAU = 8.5; 
    const currentDistAU = dist;
    const ratio = Math.pow(earthDistAU / currentDistAU, 3);
    this.targetBulge = 0.04 * ratio;
  }

  setSpeed(speed) {
    this.simSpeed = speed;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  togglePlayback() {
    this.isPlayingBack = !this.isPlayingBack;
    this.playbackIndex = 0;
    return this.isPlayingBack;
  }
}

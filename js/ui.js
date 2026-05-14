export class TideChart {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.data = [];
    this.maxDataPoints = 100;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
  }

  addData(value) {
    this.data.push(value);
    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = 'rgba(126,207,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<4; i++) {
      const y = i * h / 3;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    if (this.data.length < 2) return;

    // Line
    ctx.strokeStyle = '#7ecfff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = w / (this.maxDataPoints - 1);
    
    for(let i=0; i<this.data.length; i++) {
      const x = i * step;
      // Map value (approx 0.8 to 1.2) to height
      const y = h - ((this.data[i] - 0.8) / 0.4) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Label
    ctx.fillStyle = 'rgba(126,207,255,0.5)';
    ctx.font = '8px Space Mono, monospace';
    ctx.fillText('Tidal Height', 5, 12);
  }
}

export class Minimap {
  constructor(canvasId) {
    this.mm = document.getElementById(canvasId);
    this.mmDPR = Math.min(window.devicePixelRatio || 1, 2); // Lower DPR for mobile performance
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.MM = window.innerWidth < 768 ? 120 : 180;
    this.mm.width  = this.MM * this.mmDPR;
    this.mm.height = this.MM * this.mmDPR;
    this.ctx = this.mm.getContext('2d');
    this.ctx.scale(this.mmDPR, this.mmDPR);
    this.MM_CX = this.MM/2;
    this.MM_CY = this.MM/2;
  }

  worldToMM(wx, wz) {
    const scale = this.MM / (2 * 11.5);
    return {
      x: this.MM_CX + (wx + 8) * scale,
      y: this.MM_CY + wz * scale
    };
  }

  draw(data) {
    const { ex, ez, mx, mz, theta, mode, currentBulge } = data;
    const ctx = this.ctx;
    const MM = this.MM;

    ctx.clearRect(0, 0, MM, MM);

    // Faint grid lines
    ctx.strokeStyle = 'rgba(126,207,255,0.06)';
    ctx.lineWidth = 0.5;
    for(let i=1;i<6;i++){
      const x=i*(MM/6), y=i*(MM/6);
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,MM); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(MM,y); ctx.stroke();
    }

    const sunMM = this.worldToMM(-8, 0);

    // Orbit rings
    this.drawRing(sunMM, 5.5, 'rgba(255,123,74,0.35)', [3,3]);
    this.drawRing(sunMM, 8.5, 'rgba(59,139,212,0.25)', [2,4]);

    // Sun → Earth gravity line
    const earthMM = this.worldToMM(ex, ez);
    ctx.beginPath();
    ctx.moveTo(sunMM.x, sunMM.y);
    ctx.lineTo(earthMM.x, earthMM.y);
    ctx.strokeStyle = 'rgba(255,123,74,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sun
    this.drawSun(sunMM);

    // Earth & Moon
    this.drawEarth(earthMM, ex, ez, currentBulge);
    this.drawMoon(mx, mz);

    // Labels
    ctx.font = '7px Space Mono, monospace';
    ctx.fillStyle = 'rgba(232,228,216,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('SUN', sunMM.x, sunMM.y + 16);
    ctx.fillText('EARTH', earthMM.x, earthMM.y + 14);

    // Camera angle
    this.drawCameraIndicator(theta);
  }

  drawRing(center, radius, color, dash) {
    const r = (radius / 11.5) * (this.MM/2);
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, r, 0, Math.PI*2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash(dash);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawSun(pos) {
    const ctx = this.ctx;
    const sg = ctx.createRadialGradient(pos.x, pos.y, 1, pos.x, pos.y, 10);
    sg.addColorStop(0, 'rgba(255,200,80,0.95)');
    sg.addColorStop(0.4, 'rgba(255,160,40,0.5)');
    sg.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2);
    ctx.fillStyle = sg; ctx.fill();
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#F2A623'; ctx.fill();
  }

  drawEarth(pos, ex, ez, currentBulge) {
    const ctx = this.ctx;
    const toSunAngle = Math.atan2(-(ez), -8 - ex);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(toSunAngle);
    const tidalAmt = currentBulge / 0.18;
    const lobeR = 4 + tidalAmt * 2.5;
    
    const lg1 = ctx.createRadialGradient(-lobeR*0.6,0,0,-lobeR*0.6,0,lobeR);
    lg1.addColorStop(0,'rgba(255,100,50,0.7)');
    lg1.addColorStop(1,'rgba(255,100,50,0)');
    ctx.fillStyle=lg1; ctx.beginPath(); ctx.arc(-lobeR*0.6,0,lobeR,0,Math.PI*2); ctx.fill();
    
    const lg2 = ctx.createRadialGradient(lobeR*0.6,0,0,lobeR*0.6,0,lobeR);
    lg2.addColorStop(0,'rgba(255,100,50,0.5)');
    lg2.addColorStop(1,'rgba(255,100,50,0)');
    ctx.fillStyle=lg2; ctx.beginPath(); ctx.arc(lobeR*0.6,0,lobeR,0,Math.PI*2); ctx.fill();
    
    ctx.scale(1+tidalAmt*0.3, 1-tidalAmt*0.1);
    ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2);
    ctx.fillStyle='#1565c0'; ctx.fill();
    ctx.strokeStyle='rgba(79,195,247,0.6)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.restore();
  }

  drawMoon(mx, mz) {
    const moonMM = this.worldToMM(mx, mz);
    this.ctx.beginPath();
    this.ctx.arc(moonMM.x, moonMM.y, 2, 0, Math.PI*2);
    this.ctx.fillStyle = '#c8d8f0';
    this.ctx.fill();
  }

  drawCameraIndicator(theta) {
    const ctx = this.ctx;
    const ax = this.MM_CX + 80, ay = 16;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-theta);
    ctx.strokeStyle = 'rgba(126,207,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -12);
    ctx.moveTo(0,-12); ctx.lineTo(-3,-12+5);
    ctx.moveTo(0,-12); ctx.lineTo(3,-12+5);
    ctx.stroke();
    ctx.fillStyle='rgba(126,207,255,0.35)';
    ctx.font='6px Space Mono, monospace'; ctx.textAlign='center';
    ctx.fillText('CAM',0,20);
    ctx.restore();
  }
}

export class UIManager {
  constructor(simulation) {
    this.sim = simulation;
    this.minimap = new Minimap('minimap');
    this.chart = new TideChart('tide-chart');
    this.initEventListeners();
    
    this.sim.onUpdate = (data) => {
      this.minimap.draw({
        ...data,
        mode: this.sim.mode,
        currentBulge: this.sim.currentBulge
      });
      
      const tideHeight = 1 + this.sim.currentBulge;
      this.chart.addData(tideHeight);
      
      this.updateInfoPanel();
    };

    this.sim.onHover = (text, x, y) => {
      if (window.innerWidth < 768) return; // Disable hover annotations on mobile
      const el = document.getElementById('hover-annotation');
      if (text) {
        el.style.display = 'block';
        el.textContent = text;
        el.style.left = (x + 20) + 'px';
        el.style.top = (y + 20) + 'px';
      } else {
        el.style.display = 'none';
      }
    };
  }

  initEventListeners() {
    document.getElementById('btn-mercury').onclick = () => this.setMode('mercury');
    document.getElementById('btn-earth').onclick = () => this.setMode('earth');
    document.getElementById('btn-pause').onclick = () => this.togglePause();
    document.getElementById('btn-playback').onclick = () => this.togglePlayback();
    
    // Sliders
    const distSlider = document.getElementById('slider-dist');
    distSlider.oninput = (e) => {
      const dist = parseFloat(e.target.value);
      // Map AU (0.3 to 1.5) to internal units (approx 4 to 13)
      // Earth 1.0 AU = 8.5 internal
      const internalDist = dist * 8.5;
      this.sim.setDistance(internalDist);
      document.getElementById('val-dist-readout').textContent = dist.toFixed(2) + ' AU';
    };

    const speedSlider = document.getElementById('slider-speed');
    speedSlider.oninput = (e) => {
      this.sim.setSpeed(parseFloat(e.target.value));
    };

    // Presets
    document.getElementById('btn-spring').onclick = () => {
      this.sim.targetBulge = 0.25; // Sun + Moon alignment
      this.updateStepGuide("Spring Tide", "The Sun and Moon are aligned, and their gravitational pulls combine to create the largest tidal bulges.");
    };
    document.getElementById('btn-neap').onclick = () => {
      this.sim.targetBulge = 0.10; // Sun + Moon at right angles
      this.updateStepGuide("Neap Tide", "The Sun and Moon are at right angles, and their gravitational pulls partially cancel each other out, resulting in smaller tides.");
    };

    // Quiz
    document.getElementById('btn-quiz').onclick = () => this.startQuiz();

    // Export
    document.getElementById('btn-export').onclick = () => this.exportReport();

    // Sidebar toggle
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    if (toggle) {
      toggle.onclick = () => sidebar.classList.toggle('open');
    }
  }

  exportReport() {
    const data = [
      ["Parameter", "Value"],
      ["Orbit Mode", this.sim.mode],
      ["Current Distance (internal)", this.sim.currentDist.toFixed(2)],
      ["Current Bulge", this.sim.currentBulge.toFixed(4)],
      ["Simulation Speed", this.sim.simSpeed.toFixed(1)],
      ["Timestamp", new Date().toISOString()]
    ];

    let csvContent = "data:text/csv;charset=utf-8," 
      + data.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tide_simulation_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  startQuiz() {
    const questions = [
      {
        q: "What causes the primary tidal bulge on Earth?",
        options: ["Centrifugal force", "Differential gravitational pull from the Sun/Moon", "Earth's rotation alone", "Atmospheric pressure"],
        correct: 1
      },
      {
        q: "When do 'Spring Tides' occur?",
        options: ["Only in the Spring season", "When the Sun and Moon are at right angles", "When the Sun and Moon are aligned", "During a solar eclipse only"],
        correct: 2
      }
    ];

    let currentQ = 0;
    const modal = document.getElementById('quiz-modal');
    const content = document.getElementById('quiz-content');
    const result = document.getElementById('quiz-result');
    const qText = document.getElementById('quiz-question');
    const optionsDiv = document.getElementById('quiz-options');

    modal.style.display = 'flex';
    content.style.display = 'block';
    result.style.display = 'none';

    const showQuestion = () => {
      const q = questions[currentQ];
      qText.textContent = q.q;
      optionsDiv.innerHTML = '';
      q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'ctrl-btn';
        btn.textContent = opt;
        btn.onclick = () => {
          if (i === q.correct) {
            currentQ++;
            if (currentQ < questions.length) showQuestion();
            else showResult(true);
          } else {
            showResult(false);
          }
        };
        optionsDiv.appendChild(btn);
      });
    };

    const showResult = (success) => {
      content.style.display = 'none';
      result.style.display = 'block';
      document.getElementById('result-title').textContent = success ? "Excellent!" : "Keep Learning";
      document.getElementById('result-text').textContent = success 
        ? "You have a solid understanding of tidal forces." 
        : "Review the simulation and the alignment of celestial bodies.";
    };

    showQuestion();
  }

  updateStepGuide(title, text) {
    const guide = document.getElementById('step-guide');
    guide.style.display = 'block';
    guide.querySelector('h4').textContent = title;
    guide.querySelector('p').textContent = text;
  }

  setMode(mode) {
    this.sim.setMode(mode);
    document.querySelectorAll('.ctrl-btn[id^="btn-"]').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+mode).classList.add('active');
    
    const label = mode === 'mercury' ? 'MERCURY ORBIT' : 'EARTH ORBIT';
    document.getElementById('mm-mode-label').textContent = label;
    document.getElementById('orbit-label').textContent = mode === 'mercury' ? '— Mercury orbit path —' : '— Earth normal orbit —';
  }

  togglePause() {
    const isPaused = this.sim.togglePause();
    document.getElementById('btn-pause').textContent = isPaused ? 'Resume' : 'Pause';
  }

  togglePlayback() {
    const isPlaying = this.sim.togglePlayback();
    document.getElementById('btn-playback').textContent = isPlaying ? 'Stop Replay' : 'Replay 10s';
  }

  updateInfoPanel() {
    const mode = this.sim.mode;
    if (mode === 'mercury') {
      document.getElementById('val-orbit').textContent = '0.39 AU';
      document.getElementById('val-tidal').textContent = '17.6×';
    } else {
      document.getElementById('val-orbit').textContent = '1.00 AU';
      document.getElementById('val-tidal').textContent = '1.0×';
    }
  }
}

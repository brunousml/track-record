/* Fundo interativo: rede de pontos e linhas em coordenadas da página (rola junto com o conteúdo).
   Leve por desenho: dorme sozinho sem interação, só anima o que está na tela e agrupa os traços.
   O brilho dourado e a cor de base são CSS (style.css); aqui só entram linhas e pontos. */
(() => {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lite = !!(navigator.connection && navigator.connection.saveData) || (navigator.hardwareConcurrency || 4) <= 2;
  const MAX_DIST = 150, MAX2 = MAX_DIST * MAX_DIST, MOUSE_R = 170, MOUSE_R2 = MOUSE_R * MOUSE_R, NEAR2 = (MOUSE_R * 1.3) ** 2;
  const PUSH = 26, GRAB_R = 240, MARGIN = MAX_DIST + 40, LEVELS = 5, TAU = 6.2832;
  const DPR_MAX = 1;                       // 1 = mais leve; suba para 1.5/2 se quiser traço mais nítido em tela retina
  const FRAME_MS = lite ? 50 : 33;         // física e desenho a ~30 fps (20 em modo econômico)
  const IDLE_MS = 2500;                    // sem interação por esse tempo, o laço de animação para
  const AREA = lite ? 18000 : 11000;       // px² por nó
  let w = 0, h = 0, covered = 0, sy = 0, dpr = 1, dark = true;
  let raf = 0, awake = false, needDraw = true, awakeUntil = 0, lastPhys = 0, clock = 0;
  let nodes = [], vis = [], hot = [];
  const mouse = {x: -9999, y: -9999, tx: -9999, ty: -9999};
  const drag = {on: false, ax: 0, ay: 0, x: 0, y: 0, vx: 0, vy: 0};
  // segmentos do quadro em buffers reaproveitados: x1,y1,x2,y2 + classe (nível de opacidade, normal ou dourado)
  let segCap = 1024, segs = new Float32Array(segCap * 4), segCls = new Uint8Array(segCap), nSeg = 0;
  let base = 0.32, nodeFill = '', styles = [];

  function readTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    dark = t ? t === 'dark' : mqDark.matches;
    base = dark ? 0.32 : 0.16;
    const line = dark ? '215,215,215' : '20,20,20';
    nodeFill = dark ? 'rgba(235,235,235,.7)' : 'rgba(20,20,20,.4)';
    styles = [];
    for (let l = 0; l < LEVELS; l++) styles[l] = `rgba(${line},${((l + 0.5) / LEVELS * base).toFixed(3)})`;
    for (let l = 0; l < LEVELS; l++) styles[LEVELS + l] = `rgba(255,188,17,${((l + 0.5) / LEVELS * 0.85).toFixed(3)})`;
  }

  function seed(y0, y1) {
    const n = Math.round((w * (y1 - y0)) / AREA);
    for (let i = 0; i < n; i++) {
      const x = Math.pow(Math.random(), 0.7) * w, y = y0 + Math.random() * (y1 - y0);
      nodes.push({
        hx: x, hy: y, x, y, vx: 0, vy: 0, gw: 0,
        ax: 8 + Math.random() * 22, ay: 8 + Math.random() * 22,
        sp: 0.00008 + Math.random() * 0.00018, ph: Math.random() * 6.28,
        r: Math.random() < 0.12 ? 1.8 + Math.random() * 1.4 : 0.7 + Math.random() * 0.9
      });
    }
    nodes.sort((a, b) => a.hx - b.hx);
  }

  // cobre a página com folga à frente: crescer aos poucos (card abrindo) não gera nós a cada quadro
  function fit() {
    const ph = Math.max(document.documentElement.scrollHeight, h);
    if (ph <= covered) return;
    const to = ph + 600;
    seed(covered, to);
    covered = to;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
    const widthChanged = innerWidth !== w;
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    if (widthChanged) { nodes = []; covered = 0; }  // só a altura mudou (barra do navegador no celular): mantém a rede
    fit(); readTheme(); redraw();
  }

  function collect() {
    const lo = sy - MARGIN, hi = sy + h + MARGIN;
    vis.length = 0;
    for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; if (n.y > lo && n.y < hi) vis.push(n); }
    // quase ordenado por x (herdado de nodes): a inserção é praticamente O(n) e o laço de pares pode parar cedo
    for (let i = 1; i < vis.length; i++) {
      const a = vis[i]; let j = i - 1;
      while (j >= 0 && vis[j].x > a.x) { vis[j + 1] = vis[j]; j--; }
      vis[j + 1] = a;
    }
  }

  function step() {
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty + sy - mouse.y) * 0.12;
    const tx = drag.on ? mouse.tx - drag.ax : 0, ty = drag.on ? mouse.ty + sy - drag.ay : 0;
    const k = drag.on ? 0.22 : 0.07, damp = drag.on ? 0.6 : 0.86;
    drag.vx = (drag.vx + (tx - drag.x) * k) * damp; drag.vy = (drag.vy + (ty - drag.y) * k) * damp;
    drag.x += drag.vx; drag.y += drag.vy;
    const dragging = drag.x * drag.x + drag.y * drag.y > 0.01, pushing = !drag.on && mouse.x > -999;
    for (let i = 0; i < vis.length; i++) {
      const n = vis[i];
      let gx = n.hx + Math.cos(clock * n.sp + n.ph) * n.ax;
      let gy = n.hy + Math.sin(clock * n.sp * 1.3 + n.ph) * n.ay;
      if (dragging && n.gw) { gx += drag.x * n.gw; gy += drag.y * n.gw; }
      if (pushing) {
        const dx = gx - mouse.x, dy = gy - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_R2 && d2 > 1e-4) {
          const d = Math.sqrt(d2), f = (1 - d / MOUSE_R) ** 2 * PUSH;
          gx += (dx / d) * f; gy += (dy / d) * f;
        }
      }
      n.vx = (n.vx + (gx - n.x) * 0.04) * 0.82; n.vy = (n.vy + (gy - n.y) * 0.04) * 0.82;
      n.x += n.vx; n.y += n.vy;
    }
  }

  function addSeg(a, b, cls) {
    if (nSeg === segCap) {
      segCap *= 2;
      const s = new Float32Array(segCap * 4); s.set(segs); segs = s;
      const c = new Uint8Array(segCap); c.set(segCls); segCls = c;
    }
    const k = nSeg * 4;
    segs[k] = a.x; segs[k + 1] = a.y; segs[k + 2] = b.x; segs[k + 3] = b.y; segCls[nSeg++] = cls;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(0, -sy);
    ctx.lineWidth = 0.7;
    const mx = mouse.x, my = mouse.y, hasMouse = mx > -999;
    let used = 0;
    nSeg = 0;
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      for (let j = i + 1; j < vis.length; j++) {
        const b = vis[j], dx = b.x - a.x;
        if (dx > MAX_DIST) break;                    // vis está ordenado por x
        const dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > MAX2) continue;
        const al = (1 - Math.sqrt(d2) / MAX_DIST) * base;
        let cls;
        if (hasMouse) {
          const cx = (a.x + b.x) / 2 - mx, cy = (a.y + b.y) / 2 - my, c2 = cx * cx + cy * cy;
          if (c2 < NEAR2) {
            cls = LEVELS + Math.min(LEVELS - 1, ((al + (1 - Math.sqrt(c2 / NEAR2)) * 0.5) / 0.85 * LEVELS) | 0);
            used |= 1 << cls; addSeg(a, b, cls); continue;
          }
        }
        cls = Math.min(LEVELS - 1, (al / base * LEVELS) | 0);
        used |= 1 << cls; addSeg(a, b, cls);
      }
    }
    // um stroke por classe de opacidade, em vez de um por linha
    for (let c = 0; c < 2 * LEVELS; c++) {
      if (!(used & (1 << c))) continue;
      ctx.beginPath();
      for (let s = 0; s < nSeg; s++) {
        if (segCls[s] !== c) continue;
        const k = s * 4;
        ctx.moveTo(segs[k], segs[k + 1]); ctx.lineTo(segs[k + 2], segs[k + 3]);
      }
      ctx.strokeStyle = styles[c]; ctx.stroke();
    }
    // pontos comuns num único path; só os próximos do cursor são desenhados à parte
    hot.length = 0;
    ctx.beginPath();
    for (let i = 0; i < vis.length; i++) {
      const n = vis[i], dx = n.x - mx, dy = n.y - my;
      if (hasMouse && dx * dx + dy * dy < MOUSE_R2) { hot.push(n); continue; }
      ctx.moveTo(n.x + n.r, n.y); ctx.arc(n.x, n.y, n.r, 0, TAU);
    }
    ctx.fillStyle = nodeFill; ctx.fill();
    for (let i = 0; i < hot.length; i++) {
      const n = hot[i], near = 1 - Math.hypot(n.x - mx, n.y - my) / MOUSE_R;
      ctx.fillStyle = `rgba(255,188,17,${(0.55 + near * 0.45).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + near * 1.2, 0, TAU); ctx.fill();
    }
  }

  const settled = () => Math.abs(drag.x) + Math.abs(drag.y) < 0.1 && Math.abs(drag.vx) + Math.abs(drag.vy) < 0.1;

  // Um único rAF, só agendado quando há o que fazer: física (acordado) ou redesenho (rolagem, resize, tema).
  function tick(t) {
    raf = 0;
    sy = scrollY;
    if (awake && t - lastPhys >= FRAME_MS) {
      clock += lastPhys ? Math.min(t - lastPhys, 64) : FRAME_MS;
      lastPhys = t;
      collect(); step(); draw();
      if (t > awakeUntil && !drag.on && settled()) { awake = false; lastPhys = 0; }
    } else if (needDraw) {
      collect(); draw();
    }
    needDraw = false;
    if (awake) schedule();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const redraw = () => { needDraw = true; schedule(); };
  function wake() {
    if (mqMotion.matches) return;           // movimento reduzido: a rede fica estática
    awakeUntil = performance.now() + IDLE_MS;
    if (!awake) { awake = true; lastPhys = 0; }
    schedule();
  }

  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX; mouse.ty = e.clientY;
    if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty + scrollY; }
    wake();
  }, {passive: true});
  addEventListener('pointerdown', (e) => {
    if (e.button || mqMotion.matches || e.target.closest('button,a,select,input,.card')) return;
    drag.on = true; drag.ax = mouse.tx = e.clientX; drag.ay = e.clientY + scrollY; mouse.ty = e.clientY;
    for (const n of nodes) { const d = Math.hypot(n.x - drag.ax, n.y - drag.ay); n.gw = d < GRAB_R ? (1 - d / GRAB_R) ** 1.3 : 0; }
    document.body.style.userSelect = 'none';
    wake();
  });
  const release = () => { if (!drag.on) return; drag.on = false; document.body.style.userSelect = ''; wake(); };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  document.documentElement.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = -9999; wake(); });
  addEventListener('scroll', redraw, {passive: true});
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  new ResizeObserver(fit).observe(document.body);
  const retheme = () => { readTheme(); redraw(); };
  mqDark.addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  mqMotion.addEventListener('change', redraw);
  resize();
  wake();                                   // breve animação de entrada, depois dorme
})();

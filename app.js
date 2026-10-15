(() => {
  const SITE = window.SITE, ITEMS = window.ITEMS;
  const TYPES = ['work', 'edu', 'milestone'];
  const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICON = {
    work: ic('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    edu: ic('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
    milestone: ic('<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>')
  };
  const UI = {
    pt: {
      skip: 'Ir para a linha do tempo', current: 'Ver capítulo atual', expandAll: 'Expandir tudo', collapseAll: 'Recolher tudo',
      type: 'Tipo', tech: 'Tecnologia', all: 'Todas', years: 'Ano',
      types: {work: 'Trabalho', edu: 'Formação', milestone: 'Marcos'},
      did: 'O que fiz', results: 'Resultados', stack: 'Stack', links: 'Links', copy: 'Copiar link', copied: 'Link copiado',
      ongoing: 'em andamento', empty: 'Nenhum item com esses filtros.', clear: 'Limpar filtros',
      foot: 'Navegação: ↑ ↓ entre itens, Enter abre ou fecha. Cada item tem link direto (ex.: #zig).',
      months: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], htmlLang: 'pt-BR',
      title: 'Bruno Melo — Trajetória', other: 'EN'
    },
    en: {
      skip: 'Skip to timeline', current: 'See current chapter', expandAll: 'Expand all', collapseAll: 'Collapse all',
      type: 'Type', tech: 'Technology', all: 'All', years: 'Year',
      types: {work: 'Work', edu: 'Education', milestone: 'Milestones'},
      did: 'What I did', results: 'Results', stack: 'Stack', links: 'Links', copy: 'Copy link', copied: 'Link copied',
      ongoing: 'in progress', empty: 'No items match these filters.', clear: 'Clear filters',
      foot: 'Navigation: ↑ ↓ between items, Enter opens or closes. Every item has a direct link (e.g. #zig).',
      months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], htmlLang: 'en',
      title: 'Bruno Melo — Career timeline', other: 'PT'
    }
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const qLang = new URLSearchParams(location.search).get('lang');
  let lang = ['pt', 'en'].includes(qLang) ? qLang : (store.get('lang') || 'pt');
  const state = {types: new Set(), tech: '', open: new Set()};
  const $ = (s, r = document) => r.querySelector(s);
  const t = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? (o[lang] ?? o.pt) : o);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const yearOf = (s) => +String(s).slice(0, 4);
  const endYear = (i) => yearOf(i.end || i.start);

  const fmt = (s, precision) => {
    const [y, m] = String(s).split('-');
    return precision === 'year' || !m ? y : `${UI[lang].months[+m - 1]}/${y}`;
  };
  const period = (i) => {
    const a = fmt(i.start, i.precision), b = fmt(i.end || i.start, i.precision);
    let p = a === b ? a : `${a} – ${b}`;
    if (i.ongoing) p += ` (${UI[lang].ongoing})`;
    return p;
  };

  const sorted = [...ITEMS].sort((a, b) => endYear(b) - endYear(a) || b.weight - a.weight || String(b.start).localeCompare(String(a.start)));
  const years = [...new Set(sorted.map(endYear))];
  const techs = [...new Set(ITEMS.flatMap((i) => i.stack || []))].sort((a, b) => a.localeCompare(b));
  const visible = (i) => (state.types.size === 0 || state.types.has(i.type)) && (!state.tech || (i.stack || []).includes(state.tech));

  function renderHero() {
    const u = UI[lang], cur = sorted.find((i) => i.weight === 5);
    $('#hero').innerHTML = `
      <div class="id">
        <img class="avatar" src="foto.jpg" width="120" height="120" decoding="async" fetchpriority="high" alt="${esc(SITE.name)}">
        <div><h1>${esc(SITE.name)}</h1>
        <p class="headline">${esc(t(SITE.headline))}</p></div>
      </div>
      <p class="intro">${esc(t(SITE.intro))}</p>
      <div class="row">
        ${cur ? `<a class="btn primary" href="#${esc(cur.id)}" data-goto="${esc(cur.id)}">${esc(u.current)}</a>` : ''}
        ${SITE.links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join('')}
      </div>`;
    $('#skip').textContent = u.skip;
  }

  function renderToolbar() {
    const u = UI[lang];
    $('#toolbar').innerHTML = `<div class="in">
      <div class="line"><span class="lbl">${u.type}</span>
        ${TYPES.map((k) => `<button class="chip" type="button" data-type="${k}" aria-pressed="${state.types.has(k)}">${ICON[k]}${esc(u.types[k])}</button>`).join('')}
        <label class="lbl" for="tech" style="margin-left:.6rem">${u.tech}</label>
        <select id="tech"><option value="">${u.all}</option>${techs.map((x) => `<option${x === state.tech ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <span class="spacer"></span>
        <button class="chip" type="button" id="toggle-all">${u.expandAll}</button>
        <button class="chip" type="button" id="lang" lang="${lang === 'pt' ? 'en' : 'pt'}" aria-label="${lang === 'pt' ? 'Switch to English' : 'Mudar para português'}">${u.other}</button>
      </div>
      <div class="line"><span class="lbl">${u.years}</span>
        ${years.map((y) => `<button class="yr-btn" type="button" data-year="${y}">${y}</button>`).join('')}
      </div></div>`;
  }

  function card(i) {
    const u = UI[lang], open = state.open.has(i.id);
    const did = t(i.did) || [];
    const meta = [i.org, t(i.place), period(i)].filter(Boolean).join(' · ');
    const yi = years.indexOf(endYear(i)) % 16;
    return `<li class="card w${i.weight} t-${i.type} y${yi}${open ? ' open' : ''}" id="${esc(i.id)}" data-id="${esc(i.id)}">
      <h3><button class="toggle" type="button" aria-expanded="${open}" aria-controls="d-${esc(i.id)}">
        <span class="tag">${ICON[i.type]}${esc(u.types[i.type])}</span>
        <span class="title">${esc(t(i.title))}</span>
        <span class="meta">${esc(meta)}</span>
        <span class="chev" aria-hidden="true">+</span></button></h3>
      <p class="sum">${esc(t(i.summary))}</p>
      <div class="detail" id="d-${esc(i.id)}" role="region" aria-label="${esc(t(i.title))}"><div class="detail-inner">
        ${did.length ? `<h4>${u.did}</h4><ul class="did">${did.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        ${i.results ? `<h4>${u.results}</h4><div class="stats">${i.results.map((r) => `<div class="stat"><b>${esc(r.v)}</b><span>${esc(t(r))}</span></div>`).join('')}</div>` : ''}
        ${i.note ? `<p class="note">${esc(t(i.note))}</p>` : ''}
        ${i.stack ? `<h4>${u.stack}</h4><div class="chips">${i.stack.map((s) => `<button class="chip" type="button" data-tech="${esc(s)}" aria-label="${u.tech}: ${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <div class="links">
          ${(i.links || []).map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(t(l.label))} ↗</a>`).join('')}
          <button class="btn copy" type="button" data-copy="${esc(i.id)}">${u.copy}</button>
        </div>
      </div></div></li>`;
  }

  function renderTimeline() {
    const u = UI[lang];
    const rows = years.map((y) => {
      const its = sorted.filter((i) => endYear(i) === y);
      return `<li class="year" id="y${y}"><h2 class="year-h" tabindex="-1">${y}</h2>
        <ul class="lane">${its.map(card).join('')}</ul></li>`;
    }).join('');
    $('#timeline').innerHTML = `<ol class="years">${rows}</ol>
      <p class="empty hidden" id="empty">${u.empty} <button class="chip" type="button" id="clear">${u.clear}</button></p>`;
    applyFilter();
  }

  function applyFilter() {
    let any = false;
    document.querySelectorAll('.card').forEach((el) => {
      const ok = visible(ITEMS.find((i) => i.id === el.dataset.id));
      el.classList.toggle('hidden', !ok);
      any ||= ok;
    });
    document.querySelectorAll('.year').forEach((y) => y.classList.toggle('hidden', !y.querySelector('.card:not(.hidden)')));
    $('#empty').classList.toggle('hidden', any);
    document.querySelectorAll('.yr-btn').forEach((b) => b.classList.toggle('hidden', !$(`#y${b.dataset.year} .card:not(.hidden)`)));
    const toggleAll = $('#toggle-all');
    if (toggleAll) toggleAll.textContent = allOpen() ? UI[lang].collapseAll : UI[lang].expandAll;
  }

  const visibleCards = () => [...document.querySelectorAll('.card:not(.hidden)')];
  const allOpen = () => visibleCards().length > 0 && visibleCards().every((c) => c.classList.contains('open'));

  function setOpen(id, open, {updateHash = true} = {}) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('card')) return;
    el.classList.toggle('open', open);
    el.querySelector('.toggle').setAttribute('aria-expanded', open);
    open ? state.open.add(id) : state.open.delete(id);
    if (updateHash) {
      const url = open ? `#${id}` : location.pathname + location.search;
      history.replaceState(null, '', url);
    }
    applyFilter();
  }

  function goto(id, {focus = true} = {}) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return false;
    if (!visible(item)) { state.types = new Set(); state.tech = ''; renderToolbar(); applyFilter(); }
    setOpen(id, true, {updateHash: false});
    const el = document.getElementById(id);
    el.scrollIntoView({block: 'start'});
    if (focus) el.querySelector('.toggle').focus({preventScroll: true});
    return true;
  }

  function renderAll() {
    document.documentElement.lang = UI[lang].htmlLang;
    document.title = UI[lang].title;
    renderHero(); renderToolbar(); renderTimeline();
    $('#foot').textContent = UI[lang].foot;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, a[data-goto]');
    if (!b) {
      // clique em qualquer parte do card abre/fecha; links, campos e seleção de texto ficam de fora
      const card = e.target.closest('.card');
      if (card && !e.target.closest('a, select, input, label') && !String(getSelection()))
        setOpen(card.dataset.id, !card.classList.contains('open'));
      return;
    }
    if (b.dataset.goto) { e.preventDefault(); goto(b.dataset.goto); return; }
    if (b.classList.contains('toggle')) { const c = b.closest('.card'); setOpen(c.dataset.id, !c.classList.contains('open')); return; }
    if (b.dataset.type) {
      const k = b.dataset.type; state.types.has(k) ? state.types.delete(k) : state.types.add(k);
      b.setAttribute('aria-pressed', state.types.has(k)); applyFilter(); return;
    }
    if (b.dataset.tech) { state.tech = state.tech === b.dataset.tech ? '' : b.dataset.tech; renderToolbar(); applyFilter(); return; }
    if (b.dataset.year) { const h = $(`#y${b.dataset.year} .year-h`); h.scrollIntoView({block: 'start'}); h.focus({preventScroll: true}); return; }
    if (b.id === 'toggle-all') { const open = !allOpen(); visibleCards().forEach((c) => setOpen(c.dataset.id, open, {updateHash: false})); return; }
    if (b.id === 'clear') { state.types = new Set(); state.tech = ''; renderToolbar(); applyFilter(); return; }
    if (b.id === 'lang') { lang = lang === 'pt' ? 'en' : 'pt'; store.set('lang', lang); renderAll(); return; }
    if (b.dataset.copy) {
      const url = `${location.origin}${location.pathname}#${b.dataset.copy}`;
      const done = () => { const old = b.textContent; b.textContent = UI[lang].copied; setTimeout(() => (b.textContent = old), 1500); };
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(done, () => prompt('URL', url));
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'tech') { state.tech = e.target.value; applyFilter(); }
  });

  document.addEventListener('keydown', (e) => {
    const cur = e.target.closest && e.target.closest('.toggle');
    if (!cur || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const btns = visibleCards().map((c) => c.querySelector('.toggle'));
    const i = btns.indexOf(cur);
    const next = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : btns.length - 1;
    if (btns[next]) { e.preventDefault(); btns[next].focus(); }
  });

  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id) goto(id); });

  renderAll();
  const hash = location.hash.slice(1);
  if (hash && ITEMS.some((i) => i.id === hash)) goto(hash, {focus: false});
  else { const cur = sorted.find((i) => i.weight === 5); if (cur) setOpen(cur.id, true, {updateHash: false}); }
})();

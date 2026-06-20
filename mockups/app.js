/* Gemeinsame UI-Logik für alle Mockup-Seiten:
   Theme (Light/Dark/Gray), Sprache, Branding, Hamburger-Menü, Dropdowns.
   Einstellungen werden in localStorage gespeichert (pro Nutzer:in persistent). */

(function () {
  // --- Persistenz beim Laden wiederherstellen ---
  const savedTheme = localStorage.getItem('km-theme') || 'light';
  const savedBrand = localStorage.getItem('km-brand');
  const savedLang = localStorage.getItem('km-lang') || 'DE';

  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedBrand) document.documentElement.style.setProperty('--brand-primary', savedBrand);

  document.addEventListener('DOMContentLoaded', () => {
    // Theme-Buttons markieren
    document.querySelectorAll('.themeseg button').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.theme === savedTheme);
    });
    // Sprache anzeigen
    const lc = document.getElementById('langCurrent');
    if (lc) lc.textContent = savedLang;
    document.querySelectorAll('#langMenu .menu button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.lang === savedLang ? 'true' : 'false');
    });

    // Klick ausserhalb schliesst Dropdowns
    document.addEventListener('click', () => {
      document.getElementById('langMenu')?.classList.remove('open');
      document.getElementById('userMenu')?.classList.remove('open');
    });
  });

  // --- Theme ---
  window.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('km-theme', t);
    document.querySelectorAll('.themeseg button').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.theme === t);
    });
  };

  // --- Branding-Farbe ---
  window.setBrand = function (color) {
    document.documentElement.style.setProperty('--brand-primary', color);
    localStorage.setItem('km-brand', color);
  };

  // --- Mobile-Menü ---
  window.toggleMenu = function () {
    document.body.classList.toggle('menu-open');
  };

  // --- Sprache ---
  window.toggleLang = function (e) {
    e.stopPropagation();
    document.getElementById('userMenu')?.classList.remove('open');
    document.getElementById('langMenu')?.classList.toggle('open');
  };
  window.setLang = function (label, code, el) {
    localStorage.setItem('km-lang', label);
    document.getElementById('langCurrent').textContent = label;
    document.documentElement.setAttribute('lang', code);
    document.querySelectorAll('#langMenu .menu button').forEach(b => b.setAttribute('aria-current', 'false'));
    if (el) el.setAttribute('aria-current', 'true');
    document.getElementById('langMenu').classList.remove('open');
  };

  // --- Nutzer-Menü ---
  window.toggleUser = function (e) {
    e.stopPropagation();
    document.getElementById('langMenu')?.classList.remove('open');
    document.getElementById('userMenu')?.classList.toggle('open');
  };
})();

/* Baut den gemeinsamen App-Header (Logo, Theme, Sprache, Nutzer).
   Aufruf: renderHeader({name, role, initials}) */
function renderHeader(user) {
  const u = user || { name: 'M. Keller', role: 'Lehrperson · BS Muster', initials: 'MK' };
  return `
  <header class="appbar">
    <button class="hamburger" aria-label="Menü öffnen" onclick="toggleMenu()">☰</button>
    <a class="brand" href="index.html" style="text-decoration:none;color:inherit">
      <img src="logo.png" alt="Logo Berufsschule Muster" />
      <span class="name">Kompetenzmatrix</span>
    </a>
    <div class="appspacer"></div>

    <!-- Theme-Umschalter im Header -->
    <div class="seg themeseg" role="group" aria-label="Anzeige-Modus">
      <button data-theme="light" onclick="setTheme('light')">Light</button>
      <button data-theme="dark" onclick="setTheme('dark')">Dark</button>
      <button data-theme="gray" onclick="setTheme('gray')">Gray</button>
    </div>

    <!-- Sprachauswahl -->
    <div class="lang" id="langMenu">
      <button aria-haspopup="true" onclick="toggleLang(event)">🌐 <span id="langCurrent">DE</span><span class="l-text"></span> ▾</button>
      <div class="menu" role="menu" aria-label="Sprache">
        <button role="menuitem" data-lang="DE" onclick="setLang('DE','de',this)">🇩🇪 Deutsch</button>
        <button role="menuitem" data-lang="FR" onclick="setLang('FR','fr',this)">🇫🇷 Français</button>
        <button role="menuitem" data-lang="IT" onclick="setLang('IT','it',this)">🇮🇹 Italiano</button>
        <button role="menuitem" data-lang="EN" onclick="setLang('EN','en',this)">🇬🇧 English</button>
      </div>
    </div>

    <!-- Eingeloggter Nutzer -->
    <div class="user" id="userMenu">
      <button aria-haspopup="true" onclick="toggleUser(event)">
        <span class="avatar">${u.initials}</span>
        <span class="u-info">
          <span class="u-name">${u.name}</span>
          <span class="u-role">${u.role}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      <div class="menu" role="menu" aria-label="Konto">
        <button role="menuitem">👤 Profil</button>
        <button role="menuitem">⚙️ Einstellungen</button>
        <button role="menuitem">🎨 Darstellung &amp; Sprache</button>
        <div class="sep"></div>
        <button role="menuitem">⎋ Abmelden</button>
      </div>
    </div>
  </header>
  <div class="scrim" onclick="toggleMenu()"></div>`;
}

/* Demo-Leiste mit Branding-Farben + Quicklinks */
function renderDemobar(active) {
  const link = (href, label) => `<a href="${href}" style="color:${active===href?'var(--brand-primary)':'var(--fg-muted)'}">${label}</a>`;
  return `
  <div class="demobar" role="region" aria-label="Mockup-Steuerung">
    <div class="db-links">
      <span class="label">Seiten:</span>
      ${link('index.html','Übersicht')} ·
      ${link('lehrer-dashboard.html','Lehrer-Dashboard')} ·
      ${link('lehrer-bewerten.html','Bewerten')} ·
      ${link('lernende-matrix.html','Matrix')} ·
      ${link('lernende-nachweis.html','Nachweis')} ·
      ${link('lernende-quiz.html','Quiz')} ·
      ${link('lernende-fachgespraech.html','Fachgespräch')}
    </div>
    <div class="db-brand">
      <span class="label">Branding:</span>
      <div class="swatches" role="group" aria-label="Schulfarbe">
        <span class="swatch" style="background:#2563eb" title="Blau" onclick="setBrand('#2563eb')"></span>
        <span class="swatch" style="background:#0d9488" title="Türkis" onclick="setBrand('#0d9488')"></span>
        <span class="swatch" style="background:#9333ea" title="Violett" onclick="setBrand('#9333ea')"></span>
        <span class="swatch" style="background:#e11d48" title="Rot" onclick="setBrand('#e11d48')"></span>
        <span class="swatch" style="background:#ea580c" title="Orange" onclick="setBrand('#ea580c')"></span>
      </div>
    </div>
  </div>`;

}

/* Sidebar-Navigation. role = 'teacher' | 'student' */
function renderSidebar(role, active) {
  const item = (id, icon, label, href, extra='') =>
    `<a href="${href}" class="${active===id?'active':''}"><span class="ic">${icon}</span> ${label} ${extra}</a>`;
  if (role === 'teacher') {
    return `<aside class="sidebar"><nav class="nav">
      ${item('dashboard','▦','Dashboard','lehrer-dashboard.html')}
      ${item('module','▤','Module &amp; Matrizen','lehrer-module.html')}
      ${item('klassen','◫','Klassen','lehrer-klassen.html')}
      ${item('bewerten','✓','Bewerten','lehrer-bewerten.html','<span class="badge b-submitted" style="margin-left:auto"><span class="dot" style="background:var(--st-submitted)"></span>7</span>')}
      ${item('ki','⚙','KI-Einstellungen','lehrer-ki.html')}
      ${item('branding','⌗','Branding','lehrer-branding.html')}
    </nav></aside>`;
  }
  return `<aside class="sidebar"><nav class="nav">
    ${item('matrix','▦','Meine Matrix','lernende-matrix.html')}
    ${item('lernpfad','➔','Lernpfad','lernende-lernpfad.html')}
    ${item('nachweise','📄','Meine Nachweise','lernende-nachweis.html')}
    ${item('quiz','❓','Quiz','lernende-quiz.html')}
    ${item('fachgespraech','💬','Fachgespräch üben','lernende-fachgespraech.html')}
    ${item('einstellungen','⚙','Einstellungen','lernende-einstellungen.html')}
  </nav></aside>`;
}

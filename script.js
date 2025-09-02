"use strict";
// Supabase client initialization (safe no-op if not configured)
let SUPA = null;
(function initSupabase() {
  try {
    const url = (window && window.SUPABASE_URL) || '';
    const key = (window && window.SUPABASE_ANON_KEY) || '';
    if (url && key && window && window.supabase && typeof window.supabase.createClient === 'function') {
      SUPA = window.supabase.createClient(url, key);
      // Expose client globally for the rest of the app (compat with existing code that uses `supabase`)
      try { window.supabaseClient = SUPA; } catch(_) {}

// --- Mobile Drawer & Mobile Perf ---
function initMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  const toggle = document.getElementById('mobileMenuToggle');
  if (!drawer || !toggle) return;
  const setOpen = (open) => {
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    drawer.classList.toggle('open', !!open);
    document.body.classList.toggle('no-scroll', !!open);
  };

  // Global desktop actions: settings, account, login, register
  document.addEventListener('click', (e) => {
    const target = (e.target instanceof Element) ? e.target : null;
    if (!target) return;
    const actEl = target.closest('[data-action]');
    if (!actEl) return;
    const action = actEl.getAttribute('data-action');
    if (!action) return;
    if (!['settings','account','login','register'].includes(action)) return;
    try { e.preventDefault(); e.stopPropagation(); } catch(_) {}
    // Close auth modal if any lingering
    try { window.closeAuth?.(); } catch(_) {}
    if (action === 'settings') {
      if (typeof navigateTo === 'function') navigateTo('#settings');
      else location.hash = '#settings';
      return;
    }
    if (action === 'account') {
      if (typeof navigateTo === 'function') navigateTo('#account');
      else location.hash = '#account';
      return;
    }
    if (action === 'login') {
      location.href = 'auth.html?mode=login';
      return;
    }
    if (action === 'register') {
      location.href = 'auth.html?mode=register';
      return;
    }
  });
  const isOpen = () => drawer.classList.contains('open') === true || drawer.getAttribute('aria-hidden') === 'false';
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  // Close when clicking a link or action inside drawer
  drawer.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    // Handle route links
    if (t.matches('a[data-link]')) {
      setTimeout(()=> setOpen(false), 0);
    }
    // Handle actions (account/login/register) -> open overlay modal in foreground
    if (t.matches('[data-action="account"]')) {
      try { location.href = 'auth.html?mode=login'; } catch(_) {}
      setOpen(false);
    }
    if (t.matches('[data-action="login"]')) {
      try { location.href = 'auth.html?mode=login'; } catch(_) {}
      setOpen(false);
    }
    if (t.matches('[data-action="register"]')) {
      try { location.href = 'auth.html?mode=register'; } catch(_) {}
      setOpen(false);
    }
  });
  // Close on ESC
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); });
}

function maybeReduceMotionOnMobile() {
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const narrow = (window.innerWidth || 0) <= 768;
    if (!(coarse || narrow)) return;
    const s = readSettings();
    // If user hasn't explicitly chosen minimal effects, apply a gentler default once
    if (s.effects !== 'minimal') {
      writeSettings({ effects: 'minimal' });
      applySettingsFromStore();
    }
  } catch(_) {}
}
      // Do NOT overwrite the Supabase namespace from the CDN
      // (window.supabase must remain the library, not the client)
      console.log('[supabase] client initialized');
    } else {
      console.warn('[supabase] missing config or library; skipped init');
    }
  } catch (e) {
    console.warn('[supabase] init error', e);
  }
})();
// Helpers to access the client in the rest of the app
window.supa = () => SUPA;
window.supaReady = () => !!SUPA;


// Supabase auth helpers (defined later after client init)

// Keep UI in sync with Supabase auth (including page reloads)
try {
  if (window.supaReady && window.supaReady()) {
    SUPA.auth.onAuthStateChange(async () => {
      try { await renderUser?.(); } catch(_) {}
      try { if (location.hash === '#account') await renderAccount?.(); } catch(_) {}
    });
  }
} catch(_) {}

// Account rendering and persistence
const ACC_LS_KEY = 'iany_profile';
function readProfile() { return lsGet(ACC_LS_KEY, {}); }

// Removed legacy Account Auth modal implementation in favor of dedicated auth.html
function writeProfile(p) { lsSet(ACC_LS_KEY, p || {}); }


async function renderAccount_initLegacy() {
  let prof = readProfile();
  // If Supabase user is present, load server profile and merge into local cache
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        if (!error && data) {
          prof = { ...prof, ...data };
          writeProfile(prof);
        }
      }
    }
  } catch (_) {}
  // Prefill identity
  const u = await currentUser();
  const name = prof.name || u?.user_metadata?.full_name || '';
  const email = u?.email || prof.email || '';
  const phone = prof.phone || '';
  $('#accName').value = name;
  $('#accEmail').value = email;
  $('#accPhone').value = phone;
  // Addresses
  $('#accShipAddr').value = prof.ship_addr || '';
  $('#accBillName').value = prof.bill_name || '';
  $('#accBillAddr').value = prof.bill_addr || '';
  $('#accBillTax').value = prof.bill_tax || '';
  // Prefs
  $('#accNewsletter').checked = !!prof.newsletter;
  // Avatar
  const avatarImg = $('#accAvatarImg');
  if (avatarImg) {
    const avLS = lsGet('iany.account.avatar', null);
    avatarImg.src = avLS || prof.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(name || (email||'U'));
  }
  // Handlers
  const saveBtn = $('#accSaveProfile');
  if (saveBtn) {
    saveBtn.onclick = () => {
      (async () => {
        const cur = readProfile();
        const patch = {
          name: ($('#accName')?.value || '').trim(),
          email: ($('#accEmail')?.value || '').trim() || cur.email || email,
          phone: ($('#accPhone')?.value || '').trim(),
          ship_addr: ($('#accShipAddr')?.value || '').trim(),
          bill_name: ($('#accBillName')?.value || '').trim(),
          bill_addr: ($('#accBillAddr')?.value || '').trim(),
          bill_tax: ($('#accBillTax')?.value || '').trim(),
          newsletter: $('#accNewsletter')?.checked || false,
          avatar: (readProfile().avatar || cur.avatar || prof.avatar || null),
          updated_at: new Date().toISOString()
        };
        try {
          if (supaReady && supaReady()) {
            const u = await sbCurrentUser();
            if (u?.id) {
              const { error } = await supabase.from('profiles').upsert({ id: u.id, ...patch });
              if (error) throw error;
            } else {
              writeProfile({ ...cur, ...patch });
            }
          } else {
            writeProfile({ ...cur, ...patch });
          }
          showToast?.('Profilo salvato', 'success');
        } catch (e) {
          console.warn('[profile] save failed', e);
          showToast?.('Errore nel salvataggio profilo', 'error');
        } finally {
          try { saveBtn.textContent = 'Salvato'; setTimeout(()=> saveBtn.textContent = 'Salva profilo', 1200); } catch(_) {}
        }
      })();
    };
  }
  const savePrefs = $('#accSavePrefs');
  if (savePrefs) {
    savePrefs.onclick = () => {
      (async () => {
        const cur = readProfile();
        const patch = { newsletter: $('#accNewsletter')?.checked || false, updated_at: new Date().toISOString() };
        try {
          if (supaReady && supaReady()) {
            const u = await sbCurrentUser();
            if (u?.id) {
              const { error } = await supabase.from('profiles').upsert({ id: u.id, ...cur, ...patch });
              if (error) throw error;
            } else {
              writeProfile({ ...cur, ...patch });
            }
          } else {
            writeProfile({ ...cur, ...patch });
          }
          showToast?.('Impostazioni salvate', 'success');
        } catch (e) {
          console.warn('[prefs] save failed', e);
          showToast?.('Errore nel salvataggio impostazioni', 'error');
        } finally {
          try { savePrefs.textContent = 'Salvato'; setTimeout(()=> savePrefs.textContent = 'Salva impostazioni', 1200); } catch(_) {}
        }
      })();
    };
  }
  const btn = $('#accAvatarBtn');
  const file = $('#accAvatarFile');
  if (btn && file) {
    btn.onclick = () => file.click();
    file.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const cur = readProfile();
        cur.avatar = dataUrl;
        writeProfile(cur);
        if (avatarImg) avatarImg.src = dataUrl;
      };
      reader.readAsDataURL(f);
    };
  }
  // Logout
  const logoutBtn = $('#accLogout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logoutAll();
      // Optionally navigate to home
      navigate('#home');
    };
  }
}

// Utilities
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
// App-wide locale/currency (configurable via Settings)
let APP_LOCALE = 'it-IT';
let APP_CURRENCY = 'EUR';
const VAT_RATE = 0.22; // default Italia

// FX rates with EUR as base. Values represent 1 EUR = FX_RATES[currency]
// Note: No network calls in this build; adjust with updateFxRates() if needed.
let FX_RATES = {
  EUR: 1,
  USD: 1.09,
  GBP: 0.84,
  CHF: 0.96,
};
function updateFxRates(partial) { FX_RATES = { ...FX_RATES, ...(partial||{}) }; }

function convertFromEUR(amountEUR, currency) {
  const rate = FX_RATES[currency] || 1;
  return (Number(amountEUR) || 0) * rate;
}

// Formats price according to settings (VAT is always excluded)
const formatEUR = (inputEUR) => {
  const body = document.body;
  // Always use the base price without VAT
  let vEUR = Number(inputEUR) || 0;
  // Convert to selected currency
  let v = convertFromEUR(vEUR, APP_CURRENCY);

  // Psychological rounding to x.99 (display-only) AFTER conversion
  const rounding = body.getAttribute('data-rounding'); // 'psych' | 'none'
  if (rounding === 'psych') {
    const int = Math.floor(v);
    let candidate = int + 0.99;
    if (candidate < v) candidate = int + 1 + 0.99;
    if (candidate < 0.99) candidate = 0.99;
    v = candidate;
  }
  try { return v.toLocaleString(APP_LOCALE, { style: 'currency', currency: APP_CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return `${v.toFixed(2)} ${APP_CURRENCY}`; }
};

// External API disabled
function getFunctionsBase() { return ''; }
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name, value, days = 365) {
  const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${d.toUTCString()}`;
}
function uuidv4() {
  // simple uuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8); return v.toString(16);
  });
}

// Account tabs + avatar preview
function initAccount() {
  const account = document.getElementById('account');
  if (!account) return;

  // Tabs
  const tabButtons = Array.from(account.querySelectorAll('.account-tab'));
  const panels = {
    profile: document.getElementById('accPanelProfile'),
    session: document.getElementById('accPanelSession'),
    addresses: document.getElementById('accPanelAddresses'),
    orders: document.getElementById('accPanelOrders'),
    terms: document.getElementById('accPanelTerms'),
  };

  const showTab = (key) => {
    tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === key));
    Object.entries(panels).forEach(([k, el]) => {
      if (!el) return;
      const on = k === key;
      el.toggleAttribute('hidden', !on);
      el.classList.toggle('show', on);
    });
  };

  tabButtons.forEach(btn => btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab'))));
  // Default tab
  showTab('profile');

  // Avatar handling
  const AV_KEY = 'iany.account.avatar';
  const img = document.getElementById('accAvatarImg');
  const file = document.getElementById('accAvatarFile');
  const btn = document.getElementById('accAvatarBtn');

  try {
    const saved = readLS(AV_KEY, '');
    if (saved && img) img.src = saved;
  } catch(_) {}

  if (btn && file) {
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      if (!f.type.startsWith('image/')) { showToast?.('Seleziona un file immagine', 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (img) img.src = dataUrl;
        try { writeLS(AV_KEY, dataUrl); } catch(_) {}
        // Also persist inside main profile object for consistency across renderers
        try {
          const cur = readProfile();
          writeProfile({ ...cur, avatar: dataUrl });
        } catch(_) {}
        showToast?.('Foto profilo aggiornata');
      };
      reader.readAsDataURL(f);
    });
  }
}

// Contact form handling
function initContact() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  if (!form) return;
  const setStatus = (msg, type = 'info') => {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove('error', 'success');
    if (type === 'error') status.classList.add('error');
    if (type === 'success') status.classList.add('success');
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const message = String(fd.get('message') || '').trim();
      if (!name || !email || !message) { setStatus('Compila tutti i campi.', 'error'); return; }
      if (!email.includes('@')) { setStatus('Inserisci una email valida.', 'error'); return; }

      // Prefer Supabase if configured
      if (supaReady && supaReady() && typeof supabase?.from === 'function') {
        setStatus('Invio in corso...');
        const text = `Da: ${name}\nEmail: ${email}\n\n${message}`;
        const { error } = await supabase.from('contact_messages').insert({ email, message: text });
        if (error) throw error;
        setStatus('Messaggio inviato! Ti risponderemo via email.', 'success');
        try { form.reset(); } catch(_) {}
        return;
      }

      // Fallback: suggerisci email manuale
      const support = window.IANY_SUPPORT_EMAIL || '';
      if (support) {
        setStatus(`Backend non disponibile. Scrivi a ${support}.`, 'error');
      } else {
        setStatus('Backend non disponibile. Riprova più tardi.', 'error');
      }
    } catch (err) {
      console.warn('[contact] send failed', err);
      const support = window.IANY_SUPPORT_EMAIL || '';
      if (support) setStatus(`Errore nell\'invio. Puoi contattarci su ${support}.`, 'error');
      else setStatus('Errore nell\'invio. Riprova più tardi.', 'error');
    }
  });
}
function getAnonId() {
  let id = getCookie('iany_anon_id');
  if (!id) { id = uuidv4(); setCookie('iany_anon_id', id); }
  return id;
}
async function apiPost(path, body) {
  // Disabled: no external API backend in this build
  throw new Error('backend_unavailable');
}
async function apiGet(pathAndQuery) {
  // Disabled: no external API backend in this build
  throw new Error('backend_unavailable');
}

// ===== Supabase Client (optional; fill placeholders to enable) =====
// 1) Add your Supabase project URL and key here
// 2) Ensure the Supabase CDN is loaded in index.html
const SUPABASE_URL = 'https://urkarrmozdccfcmbnfnx.supabase.co'; // <-- set me
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVya2Fycm1vemRjY2ZjbWJuZm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjMxNTIsImV4cCI6MjA3MDIzOTE1Mn0.ElclQbhk6-aKbOlt5abFCxxO-M7KBo2HxTMbIdEKiEI'; // <-- set me
let supabase = null;
try {
  // Prefer the already-initialized client from the top bootstrap
  if (window?.supaReady && window.supaReady()) {
    supabase = window.supa();
    console.log('[Supabase] client initialized');
    try { window.supabaseClient = supabase; window.supaReady = supaReady; window.supa = () => supabase; } catch(_) {}
  } else if (window?.supabase) {
    // Fallback: create from either inline config (index.html) or local constants
    const url = window.SUPABASE_URL || SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
    if (url && key) {
      supabase = window.supabase.createClient(url, key);
      console.log('[Supabase] client initialized');
      try { window.supabaseClient = supabase; window.SUPABASE_URL = url; window.SUPABASE_ANON_KEY = key; window.supaReady = supaReady; window.supa = () => supabase; } catch(_) {}
    }
  }
  if (!supabase) {
    console.log('[Supabase] not configured. Using LocalStorage.');
  } else {
    // Attach auth listener to trigger LS→DB sync on login
    try {
      supabase.auth.onAuthStateChange(async (event, session) => {
        const u = session?.user || null;
        // Keep a fast local mirror for synchronous callers (e.g., getSessionUser)
        try {
          if (u) {
            window.CURRENT_USER = u;
            try { localStorage.setItem(AUTH_LS_KEY, JSON.stringify(u)); } catch(_) {}
          } else {
            window.CURRENT_USER = null;
            try { localStorage.removeItem(AUTH_LS_KEY); } catch(_) {}
          }
        } catch(_) {}
        // One-time sync of local data to server on first login
        if (u?.id) {
          await syncLocalToSupabaseOnce(u);
        }
        // Update UI when auth state changes
        try { await renderUser?.(); } catch(_) {}
        try { if (location.hash === '#account') await renderAccount?.(); } catch(_) {}
      });
    } catch (_) {}
    // If already logged in at load, mirror session locally, sync once, and update UI
    (async ()=>{
      try {
        const u = await sbCurrentUser();
        if (u?.id) {
          try {
            window.CURRENT_USER = u;
            try { localStorage.setItem(AUTH_LS_KEY, JSON.stringify(u)); } catch(_) {}
          } catch(_) {}
          await syncLocalToSupabaseOnce(u);
          try { await renderUser?.(); } catch(_) {}
          try { if (location.hash === '#account') await renderAccount?.(); } catch(_) {}
        }
      } catch(_) {}
    })();
  }
} catch (e) { console.warn('[Supabase] init failed:', e); }

function supaReady() { return !!supabase; }
async function sbCurrentUser() {
  if (!supaReady()) return null;
  try {
    // Prefer session for immediate state without network
    const { data: s } = await supabase.auth.getSession();
    if (s?.session?.user) return s.session.user;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch { return null; }
}
async function sbSignOut() {
  if (!supaReady()) return;
  try { await supabase.auth.signOut(); } catch(_) {}
}

// Expose helpers on window for legacy callers
try {
  window.sbCurrentUser = sbCurrentUser;
  window.sbSignOut = sbSignOut;
} catch(_) {}

// Legacy migration removed
async function migrateLocalStorageOnce() { /* no-op */ }

// Simple LS helpers (scoped)
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function lsDel(key) { try { localStorage.removeItem(key); } catch {} }

// Simple i18n dictionary (extendable)
const I18N = {
  it: {
    settings_title: 'Impostazioni',
    settings_theme_label: 'Tema',
    settings_theme_hint: 'Seleziona il tema dello store',
    settings_theme_toggle: 'Tema chiaro',
    settings_email_label: 'Notifiche email',
    settings_email_hint: 'Ricevi offerte e aggiornamenti',
    settings_ship_label: 'Spedizione predefinita',
    settings_ship_hint: 'Usata di default al checkout',
    settings_addr_label: 'Indirizzo di spedizione',
    settings_lang_label: 'Lingua',
    settings_lang_hint: 'Preferenza di visualizzazione',
    settings_curr_label: 'Valuta',
    settings_curr_hint: 'Usata per i prezzi',
    settings_layout_label: 'Layout',
    settings_layout_hint: 'Interfaccia compatta',
    settings_cancel: 'Annulla',
    settings_save: 'Salva',
    dd_header_subtitle: 'Impostazioni account',
    dd_settings: 'Impostazioni',
    dd_account: 'Account',
    dd_login: 'Accedi',
    dd_register: 'Registrati',
    dd_logout: 'Esci',
    account_title: 'Il tuo account',
    account_profile: 'Profilo',
    account_fullname: 'Nome completo',
    account_email: 'Email',
    account_phone: 'Telefono',
    account_save_profile: 'Salva profilo',
    account_addresses: 'Indirizzi',
    account_ship: 'Spedizione',
    account_bill_section: 'Indirizzo di fatturazione diverso',
    account_bill_name: 'Nome e Cognome (fatturazione)',
    account_bill_addr: 'Indirizzo di fatturazione',
    account_bill_tax: 'CF/P.IVA',
    account_prefs: 'Preferenze',
    account_newsletter: 'Ricevi offerte via email',
    account_save_prefs: 'Salva impostazioni',
    account_orders: 'I tuoi ordini',
    account_export: 'Esporta dati (JSON)',
    account_clear_favs: 'Svuota preferiti',
    // Navbar & hero
    nav_home: 'Home',
    nav_shop: 'Shop',
    nav_prodotti: 'Pacchetti e Offerte',
    nav_contattaci: 'Contattaci',
    nav_chisiamo: 'Chi Siamo',
    nav_cart: 'Carrello',
    nav_fav: 'Preferiti',
    nav_profile: 'Profilo',
    hero_title: 'Benvenuto su Iany Gaming',
    hero_sub: 'Scopri console, giochi e accessori ai migliori prezzi. Spedizione rapida, pagamenti sicuri e assistenza dedicata.',
    hero_cta_shop: "Vai allo Shop",
    hero_cta_offers: 'Offerte del momento',
    cat_title: 'Categorie popolari',
    cat1: 'Carte Regalo',
    cat2: 'Chiavi Giochi',
    cat3: ' Accessori Gaming',
    // Cart sidebar
    cart_title: 'Il tuo carrello',
    cart_total: 'Totale:',
    cart_checkout: "Procedi all'ordine",
    // Sections
    section_shop: 'Shop',
    section_chisiamo: 'Chi Siamo',
    team_title: 'Il Team',
    prodotti_title: 'Pacchetti e Offerte',
    preferiti_title: 'I tuoi preferiti',
    checkout_title: 'Checkout',
    // Checkout labels
    co_summary: 'Riepilogo ordine',
    co_subtotal: 'Subtotale',
    co_shipping: 'Spedizione',
    co_discount: 'Sconto',
    co_total: 'Totale',
    co_payment: 'Pagamento',
    co_name: 'Nome e Cognome',
    co_email: 'Email',
    co_ship_addr: 'Indirizzo di spedizione',
    co_ship_method: 'Spedizione',
    co_billing_diff: 'Indirizzo di fatturazione diverso',
    co_terms_label: 'Accetto',
    co_terms_link: 'termini e condizioni',
    co_pay_method: 'Metodo di pagamento',
    co_pay_card: 'Carta',
    co_pay_paypal: 'PayPal',
    co_pay_cod: 'Contrassegno',
    co_confirm_pay: 'Conferma e paga',
    // Contact
    contact_title: 'Contattaci',
    contact_name: 'Nome',
    contact_email: 'Email',
    contact_message: 'Messaggio',
    contact_send: 'Invia',
    // Order completed
    oc_title: 'Ordine completato',
    oc_summary: 'Riepilogo',
    oc_next: 'Prossimi passi',
    oc_thanks: 'Grazie per il tuo acquisto! Il tuo numero ordine è',
    back_home: 'Torna alla Home',
    // Placeholders
    ph_fullname: 'Mario Rossi',
    ph_email: 'nome@email.com',
    ph_address: 'Via, numero civico, città',
    ph_phone: '+39 333 123 4567',
    ph_tax: 'Codice fiscale o Partita IVA',
    ph_coupon: 'Codice sconto',
    ph_contact_name: 'Il tuo nome',
    ph_contact_msg: 'Come possiamo aiutarti?',
    // Buttons / misc
    coupon_apply: 'Applica',
    // Empty states
    empty_orders: 'Nessun ordine effettuato al momento.',
    // Banners
    banner_title: 'Summer Gaming Sale',
    banner_subtitle: 'Fino al 30% di sconto su console selezionate',
    // Brands & Testimonials
    brands_title: 'Brand ',
    testimonials_title: 'Cosa dicono i nostri clienti',
    // Trust & Newsletter (Home and Settings pages)
    trust_secure_title: 'Pagamenti sicuri',
    trust_secure_text: 'Transazioni protette con SSL e 3D Secure.',
    trust_fast_title: 'Spedizione rapida',
    trust_fast_text: 'Consegna digitale immediata ove previsto.',
    trust_support_title: 'Assistenza dedicata',
    trust_support_text: 'Supporto via email per ogni esigenza.',
    newsletter_title: 'Iscriviti alla newsletter',
    newsletter_sub: 'Offerte esclusive, novità e coupon direttamente nella tua inbox.',
    newsletter_btn: 'Iscriviti',
    // Shop UI
    filter_all: 'Tutti',
    filter_console: 'Carte Regalo',
    filter_giochi: 'Chiavi Giochi',
    filter_accessori: 'Accessori Gaming',
    ph_shop_search: 'Cerca prodotti...',
    shop_sort_default: 'Ordina: Predefinito',
    shop_sort_price_asc: 'Prezzo: crescente',
    shop_sort_price_desc: 'Prezzo: decrescente',
    shop_sort_discount: 'Sconto',
    shop_sort_reviews: 'Più recensiti',
    // Welcome modal
    welcome_title: 'Benvenuto!',
    welcome_body: 'Vuoi registrarti o accedere per salvare preferiti, ordini e impostazioni?',
    welcome_login: 'Accedi',
    welcome_register: 'Registrati',
    welcome_later: 'Ricordamelo dopo',
    // Payments - Card
    pay_card_title: 'Pagamento con Carta',
    pay_amount_label: 'Importo da pagare:',
    card_number_label: 'Numero carta',
    card_holder_label: 'Intestatario',
    card_exp_label: 'Scadenza',
    card_cvv_label: 'CVV',
    pay_now: 'Paga ora',
    back_to_checkout: 'Torna al checkout',
    // Payments - Amex
    pay_amex_title: 'Pagamento American Express',
    amex_number_label: 'Numero carta Amex',
    amex_holder_label: 'Intestatario',
    amex_exp_label: 'Scadenza',
    amex_cid_label: 'CID',
    // Payments - PayPal
    pay_paypal_title: 'Paga con PayPal',
    go_to_paypal: 'Vai a PayPal',
    // Order detail & tracking
    order_detail_title: 'Dettaglio Ordine & Tracking',
    od_lookup_ph: 'Inserisci ID ordine',
    search: 'Cerca',
    od_or_load_last: 'Oppure lascia vuoto per caricare l’ultimo ordine.',
    od_none: 'Nessun ordine da mostrare.',
    // Account Session panel
    session_title: 'Sessione',
    session_status: 'Stato:',
    session_signin_add: 'Accedi / Aggiungi account',
    session_switch: 'Cambia account',
    session_logout: 'Esci',
    // About us
    about_p1: 'Iany Gaming nasce dalla passione per il gaming e l’innovazione digitale: un progetto creato per offrire ai giocatori un’esperienza d’acquisto semplice, veloce e affidabile. Dalle prime idee fino al lancio dello store, abbiamo sempre messo al centro qualità del servizio, trasparenza e cura del cliente.',
    about_p2: 'La nostra missione è rendere accessibili abbonamenti, giochi e accessori al miglior prezzo, con spedizioni rapide, pagamenti sicuri e assistenza dedicata.',
    team_title: 'Il Team',
    role_ceo_founder: 'CEO & Founder',
    // Settings UI labels
    effects_label: 'Effetti',
    contrast_label: 'Contrasto',
    fontsize_label: 'Dimensione testo',
    accent_label: 'Colore accento',
    view_label: 'Vista prodotti',
    corners_label: 'Angoli',
    vat_label: 'IVA prezzi',
    rounding_label: 'Arrotondamento',
    discounts_label: 'Sconti',
    // Settings chip values
    theme_dark: 'Scuro',
    theme_light: 'Chiaro',
    effects_full: 'Ricchi',
    effects_minimal: 'Minimali',
    contrast_normal: 'Normale',
    contrast_high: 'Alto',
    fontscale_normal: 'Normale',
    fontscale_large: 'Grande',
    fontscale_xlarge: 'Molto grande',
    accent_blue: 'Blu',
    accent_purple: 'Viola',
    accent_pink: 'Rosa',
    accent_green: 'Verde',
    view_grid: 'Griglia',
    view_list: 'Lista',
    corners_rounded: 'Arrotondati',
    corners_square: 'Squadrati',
    vat_excl: 'Esclusa',
    vat_incl: 'Inclusa',
    rounding_none: 'Standard',
    rounding_psych: 'a .99',
    discounts_on: 'Visibili',
    discounts_off: 'Nascosti',
  },
  en: {
    settings_title: 'Settings',
    settings_theme_label: 'Theme',
    settings_theme_hint: 'Select store theme',
    settings_theme_toggle: 'Light theme',
    settings_email_label: 'Email notifications',
    settings_email_hint: 'Get offers and updates',
    settings_ship_label: 'Default shipping',
    settings_ship_hint: 'Used by default at checkout',
    settings_addr_label: 'Shipping address',
    settings_lang_label: 'Language',
    settings_lang_hint: 'Display preference',
    settings_curr_label: 'Currency',
    settings_curr_hint: 'Used for prices',
    settings_layout_label: 'Layout',
    settings_layout_hint: 'Compact interface',
    settings_cancel: 'Cancel',
    settings_save: 'Save',
    dd_header_subtitle: 'Account settings',
    dd_settings: 'Settings',
    dd_account: 'Account',
    dd_login: 'Login',
    dd_register: 'Register',
    dd_logout: 'Logout',
    account_title: 'Your account',
    account_profile: 'Profile',
    account_fullname: 'Full name',
    account_email: 'Email',
    account_phone: 'Phone',
    account_save_profile: 'Save profile',
    account_addresses: 'Addresses',
    account_ship: 'Shipping',
    account_bill_section: 'Different billing address',
    account_bill_name: 'Full name (billing)',
    account_bill_addr: 'Billing address',
    account_bill_tax: 'Tax ID/VAT',
    account_prefs: 'Preferences',
    account_newsletter: 'Receive offers by email',
    account_save_prefs: 'Save settings',
    account_orders: 'Your orders',
    account_export: 'Export data (JSON)',
    account_clear_favs: 'Clear favorites',
    // Navbar & hero
    nav_home: 'Home',
    nav_shop: 'Shop',
    nav_prodotti: 'Bundles and Deals',
    nav_contattaci: 'Contact us',
    nav_chisiamo: 'About us',
    nav_cart: 'Cart',
    nav_fav: 'Favorites',
    nav_profile: 'Profile',
    hero_title: 'Welcome to Iany Gaming',
    hero_sub: 'Discover consoles, games and accessories at the best prices. Fast shipping, secure payments and dedicated support.',
    hero_cta_shop: 'Go to Shop',
    hero_cta_offers: 'Deals of the moment',
    cat_title: 'Popular categories',
    cat1: 'Gift Cards',
    cat2: 'Game Keys',
    cat3: ' Gaming Accessories',
    // Cart sidebar
    cart_title: 'Your cart',
    cart_total: 'Total:',
    cart_checkout: 'Proceed to order',
    // Sections
    section_shop: 'Shop',
    section_chisiamo: 'About Us',
    team_title: 'The Team',
    prodotti_title: 'Bundles and Deals',
    preferiti_title: 'Your favorites',
    checkout_title: 'Checkout',
    // Checkout labels
    co_summary: 'Order summary',
    co_subtotal: 'Subtotal',
    co_shipping: 'Shipping',
    co_discount: 'Discount',
    co_total: 'Total',
    co_payment: 'Payment',
    co_name: 'Full name',
    co_email: 'Email',
    co_ship_addr: 'Shipping address',
    co_ship_method: 'Shipping',
    co_billing_diff: 'Different billing address',
    co_terms_label: 'I accept the',
    co_terms_link: 'terms and conditions',
    co_pay_method: 'Payment method',
    co_pay_card: 'Card',
    co_pay_paypal: 'PayPal',
    co_pay_cod: 'Cash on delivery',
    co_confirm_pay: 'Confirm and pay',
    // Contact
    contact_title: 'Contact us',
    contact_name: 'Name',
    contact_email: 'Email',
    contact_message: 'Message',
    contact_send: 'Send',
    // Order completed
    oc_title: 'Order completed',
    oc_summary: 'Summary',
    oc_next: 'Next steps',
    oc_thanks: 'Thank you for your purchase! Your order number is',
    back_home: 'Back to Home',
    // Placeholders
    ph_fullname: 'John Smith',
    ph_email: 'name@email.com',
    ph_address: 'Street, number, city',
    ph_phone: '+1 555 123 4567',
    ph_tax: 'Tax code or VAT number',
    ph_coupon: 'Discount code',
    ph_contact_name: 'Your name',
    ph_contact_msg: 'How can we help you?',
    // Buttons / misc
    coupon_apply: 'Apply',
    // Empty states
    empty_orders: 'No orders yet.',
    // Banners
    banner_title: 'Summer Gaming Sale',
    banner_subtitle: 'Up to 30% off selected consoles',
    // Brands & Testimonials
    brands_title: 'Brands & Partners',
    testimonials_title: 'What our customers say',
    // Trust & Newsletter (Home and Settings pages)
    trust_secure_title: 'Secure payments',
    trust_secure_text: 'Transactions protected with SSL and 3D Secure.',
    trust_fast_title: 'Fast shipping',
    trust_fast_text: 'Instant digital delivery where available.',
    trust_support_title: 'Dedicated support',
    trust_support_text: 'Email support for every need.',
    newsletter_title: 'Subscribe to the newsletter',
    newsletter_sub: 'Exclusive offers, news and coupons directly to your inbox.',
    newsletter_btn: 'Subscribe',
    // Shop UI
    filter_all: 'All',
    filter_console: 'Gift Cards',
    filter_giochi: 'Game Keys',
    filter_accessori: 'Gaming Accessories',
    ph_shop_search: 'Search products...',
    shop_sort_default: 'Sort: Default',
    shop_sort_price_asc: 'Price: low to high',
    shop_sort_price_desc: 'Price: high to low',
    shop_sort_discount: 'Discount',
    shop_sort_reviews: 'Most reviewed',
    // Welcome modal
    welcome_title: 'Welcome!',
    welcome_body: 'Do you want to sign up or sign in to save favorites, orders, and settings?',
    welcome_login: 'Login',
    welcome_register: 'Register',
    welcome_later: 'Remind me later',
    // Payments - Card
    pay_card_title: 'Card Payment',
    pay_amount_label: 'Amount to pay:',
    card_number_label: 'Card number',
    card_holder_label: 'Cardholder',
    card_exp_label: 'Expiry',
    card_cvv_label: 'CVV',
    pay_now: 'Pay now',
    back_to_checkout: 'Back to checkout',
    // Payments - Amex
    pay_amex_title: 'American Express Payment',
    amex_number_label: 'Amex card number',
    amex_holder_label: 'Cardholder',
    amex_exp_label: 'Expiry',
    amex_cid_label: 'CID',
    // Payments - PayPal
    pay_paypal_title: 'Pay with PayPal',
    go_to_paypal: 'Go to PayPal',
    // Order detail & tracking
    order_detail_title: 'Order Detail & Tracking',
    od_lookup_ph: 'Enter order ID',
    search: 'Search',
    od_or_load_last: 'Or leave empty to load the latest order.',
    od_none: 'No orders to show.',
    // Account Session panel
    session_title: 'Session',
    session_status: 'Status:',
    session_signin_add: 'Sign in / Add account',
    session_switch: 'Switch account',
    session_logout: 'Logout',
    // About us
    about_p1: 'Iany Gaming was born from a passion for gaming and digital innovation: a project created to offer gamers a simple, fast and reliable shopping experience. From the first ideas to the store launch, we have always focused on service quality, transparency and customer care.',
    about_p2: 'Our mission is to make subscriptions, games and accessories accessible at the best price, with fast shipping, secure payments and dedicated support.',
    team_title: 'The Team',
    role_ceo_founder: 'CEO & Founder',
    // Settings UI labels
    effects_label: 'Effects',
    contrast_label: 'Contrast',
    fontsize_label: 'Text size',
    accent_label: 'Accent color',
    view_label: 'Product view',
    corners_label: 'Corners',
    vat_label: 'Prices VAT',
    rounding_label: 'Rounding',
    discounts_label: 'Discounts',
    // Settings chip values
    theme_dark: 'Dark',
    theme_light: 'Light',
    effects_full: 'Rich',
    effects_minimal: 'Minimal',
    contrast_normal: 'Normal',
    contrast_high: 'High',
    fontscale_normal: 'Normal',
    fontscale_large: 'Large',
    fontscale_xlarge: 'Extra large',
    accent_blue: 'Blue',
    accent_purple: 'Purple',
    accent_pink: 'Pink',
    accent_green: 'Green',
    view_grid: 'Grid',
    view_list: 'List',
    corners_rounded: 'Rounded',
    corners_square: 'Squared',
    vat_excl: 'Excluded',
    vat_incl: 'Included',
    rounding_none: 'Standard',
    rounding_psych: '.99',
    discounts_on: 'Visible',
    discounts_off: 'Hidden',
  }
};

function applyLanguage(lang) {
  // Select dictionary based on BCP-47 tag prefix; fallback to Italian
  const normalized = (lang || '').toLowerCase();
  const dict = normalized.startsWith('en') && I18N.en ? I18N.en : I18N.it;
  // Set document language attribute to requested value (do not force)
  try { if (lang) document.documentElement.setAttribute('lang', lang); } catch(_) {}
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] != null) {
      el.textContent = dict[key];
    }
  });
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key] != null) {
      el.setAttribute('placeholder', dict[key]);
    }
  });
}

// Auth session persistence (local only)
const AUTH_LS_KEY = 'iany_auth_user';
function setSessionUser(user) {
  // If Supabase is configured, never create a fake local session.
  if (user && (supaReady && supaReady())) {
    return; // rely on Supabase session only
  }
  if (user) { lsSet(AUTH_LS_KEY, user); window.CURRENT_USER = user; }
  else { lsDel(AUTH_LS_KEY); window.CURRENT_USER = null; }
}
function getSessionUser() { return window.CURRENT_USER || lsGet(AUTH_LS_KEY, null); }
function restoreSession() {
  const u = getSessionUser();
  if (u) { window.CURRENT_USER = u; }
}
async function currentUser() {
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u) return u;
    }
  } catch (_) {}
  return getSessionUser();
}

// Unified logout: signs out of Supabase if available and clears local session
async function logoutAll() {
  try {
    if (supaReady && supaReady()) {
      try { await sbSignOut(); } catch(_) {}
    }
  } catch(_) {}
  setSessionUser(null);
}
async function currentUserId() {
  const u = await currentUser();
  return u?.id || null;
}

// One-time LocalStorage → Supabase synchronization on first login
async function syncLocalToSupabaseOnce(user) {
  if (!user?.id || !supaReady()) return;
  const flagKey = `iany_synced_v1_${user.id}`;
  if (lsGet(flagKey, false)) return; // already synced
  try {
    // Favorites
    try {
      const localFavs = new Set(readLS(LS_KEYS.favs, []));
      if (localFavs.size) {
        const { data: serverFavs, error: favErr } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
        if (!favErr) {
          const serverSet = new Set((serverFavs || []).map(r => r.product_id));
          const toAdd = Array.from(localFavs).filter(id => !serverSet.has(id)).map(id => ({ user_id: user.id, product_id: id }));
          if (toAdd.length) {
            await supabase.from('favorites').insert(toAdd);
          }
        }
      }
    } catch (e) { console.warn('[sync] favorites', e); }

    // Cart
    try {
      const localCart = readLS(LS_KEYS.cart, {});
      const hasLocal = localCart && typeof localCart === 'object' && Object.keys(localCart).length > 0;
      if (hasLocal) {
        const { data: serverCart, error: cartErr } = await supabase.from('carts').select('items').eq('user_id', user.id).single();
        if (!cartErr || (cartErr && String(cartErr.message).includes('Row not found'))) {
          const serverItems = (serverCart && typeof serverCart.items === 'object') ? serverCart.items : {};
          const merged = { ...localCart, ...serverItems }; // prefer server quantities if exist
          await supabase.from('carts').upsert({ user_id: user.id, items: merged, updated_at: new Date().toISOString() });
        }
      }
    } catch (e) { console.warn('[sync] cart', e); }

    // Reviews
    try {
      const localReviews = readLS(LS_KEYS.reviews, {});
      const rows = [];
      for (const [productId, list] of Object.entries(localReviews || {})) {
        if (!Array.isArray(list)) continue;
        for (const r of list.slice(0, 50)) {
          const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
          const text = (r.text || '').toString().trim();
          if (!text) continue;
          rows.push({ user_id: user.id, product_id: productId, rating, text });
          if (rows.length >= 200) break; // avoid huge batch
        }
        if (rows.length >= 200) break;
      }
      if (rows.length) {
        // best effort insert; duplicates acceptable per schema (or handle unique(user_id,product_id,created_at) if any)
        await supabase.from('reviews').insert(rows);
      }
    } catch (e) { console.warn('[sync] reviews', e); }

    // Profile
    try {
      const prof = readProfile ? readProfile() : {};
      const patch = {};
      if (prof?.name) patch.name = String(prof.name);
      if (prof?.phone) patch.phone = String(prof.phone);
      if (prof?.avatar_url) patch.avatar_url = String(prof.avatar_url);
      if (Object.keys(patch).length) {
        await supabase.from('profiles').upsert({ id: user.id, ...patch, updated_at: new Date().toISOString() });
      }
    } catch (e) { console.warn('[sync] profile', e); }

    lsSet(flagKey, true);
    showToast?.('Dati locali sincronizzati', 'success');
  } catch (e) {
    console.warn('[sync] general failure', e);
  }
}
// App init
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    restoreSession();
    // Migrate legacy settings store to unified store
    try { migrateOldSettingsToNewStore(); } catch(_) {}
    // Mobile drawer + mobile perf
    try { initMobileDrawer(); } catch(_) {}
    try { maybeReduceMotionOnMobile(); } catch(_) {}
    // Apply settings early so motion/effects guards see correct state
    try { applySettingsFromStore(); } catch(_) {}
    // No remote migration
    migrateLocalStorageOnce();

    // Ensure UI reflects persisted Supabase session on first load
    (async () => {
      try {
        if (supaReady && supaReady()) {
          const u = await sbCurrentUser();
          if (u) {
            try { await renderUser?.(); } catch(_) {}
            try { if (location.hash === '#account') await renderAccount?.(); } catch(_) {}
            try { await syncLocalToSupabaseOnce?.(u); } catch(_) {}
          }
        }
      } catch(_) {}
    })();

    // UI animations (non-intrusive, respects reduced motion)
    try {
      // Parallax hero disabilitato (niente joystick sullo sfondo)
      removeParallaxLayers();
      initMagneticHover();
      initScrollReveal();
      initCursorTrail();
      initSparklesOnHover();
      initSettingsSection();
      initAccount();
      initContact();
      initNewsletter();
      // Ensure settings applied once more after any late-bound UI
      applySettingsFromStore();
    } catch (_) { /* no-op */ }
  });
}

// --- Rich UI interactions ---
function prefersReducedMotion() {
  try {
    // Honor effects setting: when minimal, we also reduce motion
    const eff = document.body?.getAttribute('data-effects');
    if (eff && eff !== 'full') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}
function removeParallaxLayers() {
  document.querySelectorAll('.parallax-layer').forEach(el => el.remove());
}
function initMagneticHover() {
  if (prefersReducedMotion()) return;
  const nodes = document.querySelectorAll('.btn, .icon-btn');
  nodes.forEach((el) => {
    const max = 6; // px
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = e.clientX - (r.left + r.width/2);
      const cy = e.clientY - (r.top + r.height/2);
      const dx = Math.max(-max, Math.min(max, cx/8));
      const dy = Math.max(-max, Math.min(max, cy/8));
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const reset = () => { el.style.transform = ''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
  });
}
function initScrollReveal() {
  const config = { threshold: 0.15, rootMargin: '40px' };
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const t = entry.target;
        t.classList.add('reveal-in');
        obs.unobserve(t);
      }
    });
  }, config);
  const addTargets = (els) => els.forEach(el => {
    el.setAttribute('data-reveal', '');
    io.observe(el);
  });
  addTargets(Array.from(document.querySelectorAll('.category-card, .product-card, .section-title, .testimonial-card, .brand-item, .brand-logo, .trust-badge, .newsletter')));
}

// Cursor trail
function initCursorTrail() {
  if (prefersReducedMotion()) return;
  if ((document.body.getAttribute('data-effects') || 'full') !== 'full') return;
  let last = 0;
  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - last < 24) return; // throttle
    last = now;
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 900);
  });
}

// Sparkles on hover for primary CTAs
function initSparklesOnHover() {
  if (prefersReducedMotion()) return;
  if ((document.body.getAttribute('data-effects') || 'full') !== 'full') return;
  document.body.addEventListener('pointerenter', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches('.btn.primary, .product-card .btn')) return;
    const rect = t.getBoundingClientRect();
    for (let i=0; i<5; i++) {
      const s = document.createElement('i');
      s.className = 'sparkle';
      s.style.left = `${rect.left + Math.random()*rect.width}px`;
      s.style.top = `${rect.top + Math.random()*rect.height}px`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }, true);
}

// Newsletter signup
function initNewsletter() {
  const forms = Array.from(document.querySelectorAll('.newsletter form'));
  if (!forms.length) return;
  forms.forEach((form) => {
    // Find the email input inside the form
    const emailInput = form.querySelector('input[type="email"], input[name="email"]');
    if (!emailInput) return;
    // Avoid double-binding
    if (form.__nlBound) return; form.__nlBound = true;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (emailInput?.value || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast?.("Inserisci un'email valida", 'error'); return; }
      if (!(supaReady && supaReady())) { showToast?.('Servizio newsletter non disponibile', 'error'); return; }
      try {
        const { error } = await supabase.from('newsletter_subscribers').insert({ email, source: 'web' });
        if (error) {
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('duplicate') || msg.includes('unique')) {
            showToast?.('Sei già iscritto', 'success');
          } else {
            throw error;
          }
        } else {
          showToast?.('Iscrizione completata! 🎉', 'success');
        }
      } catch (err) {
        console.warn('[newsletter] insert failed', err);
        showToast?.('Errore iscrizione newsletter', 'error');
      }
      try { if (emailInput) emailInput.value = ''; } catch(_) {}
    });
  });
}

// Settings Panel
const SETTINGS_KEY = 'iany.settings.v1';
const SETTINGS_DEFAULTS = {
  theme: 'dark',
  contrast: 'normal',
  fontscale: 'normal',
  accent: 'green',
  corners: 'rounded',
  showdiscounts: 'on',
  effects: 'full',
  view: 'grid',
  vat: 'excl',
  rounding: 'none',
  lang: 'it-IT',
  locale: 'it-IT',
  currency: 'EUR'
};
function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...SETTINGS_DEFAULTS, ...stored };
  } catch { return { ...SETTINGS_DEFAULTS }; }
}
function writeSettings(patch) {
  const cur = readSettings();
  const next = { ...cur, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
function applySettingsFromStore() {
  const s = readSettings();
  if (s.theme) document.body.setAttribute('data-theme', s.theme);
  // motion/density were removed; animations now respect `data-effects`
  if (s.contrast) document.body.setAttribute('data-contrast', s.contrast);
  // Apply selected products view (grid/list) to body for CSS switches
  if (s.view) document.body.setAttribute('data-view', s.view);
  else document.body.removeAttribute('data-view');
  if (s.fontscale) document.body.setAttribute('data-fontscale', s.fontscale);
  if (s.accent) document.body.setAttribute('data-accent', s.accent);
  if (s.corners) document.body.setAttribute('data-corners', s.corners);
  if (s.showdiscounts) document.body.setAttribute('data-showdiscounts', s.showdiscounts);
  if (s.effects) document.body.setAttribute('data-effects', s.effects);
  if (s.view) document.body.setAttribute('data-view', s.view);
  if (s.vat) document.body.setAttribute('data-vat', s.vat);
  if (s.rounding) document.body.setAttribute('data-rounding', s.rounding);
  if (s.lang) {
    document.documentElement.lang = s.lang;
    document.documentElement.dir = (['ar','he','fa','ur'].includes(s.lang)) ? 'rtl' : 'ltr';
    // Update UI strings according to language
    try { applyLanguage(s.lang); } catch(_) {}
  }
  if (s.currency) { APP_CURRENCY = s.currency; }
  if (s.locale) { APP_LOCALE = s.locale; }
}
function initSettingsSection() {
  const section = document.getElementById('impostazioni') || document.getElementById('settingsSection');
  if (!section) return;
  const scope = section.querySelector('#settingsSection') || section;
  const syncActive = () => {
    const s = readSettings();
    scope.querySelectorAll('.chip').forEach(btn => {
      const key = btn.getAttribute('data-set');
      const val = btn.getAttribute('data-val');
      btn.setAttribute('aria-checked', s[key] === val ? 'true' : 'false');
      btn.setAttribute('role', 'radio');
    });
  };
  syncActive();
  scope.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches('.chip')) {
      const key = t.getAttribute('data-set');
      const val = t.getAttribute('data-val');
      writeSettings({ [key]: val, ...(key==='lang' ? { locale: val } : {}) });
      applySettingsFromStore();
      syncActive();
      if (key === 'currency' || key === 'locale' || key === 'lang' || key === 'showdiscounts' || key === 'accent' || key === 'corners' || key === 'view' || key === 'vat' || key === 'rounding' || key === 'effects') {
        try { if (typeof rerenderCurrentRoute === 'function') rerenderCurrentRoute(); } catch(_){}
      }
    }
  });
  // Mantieni le chip sincronizzate quando si apre la sezione via routing
  window.addEventListener('hashchange', () => {
    if ((location.hash || '#home') === '#impostazioni') syncActive();
  });
  // Support apertura da menu profilo
  document.querySelectorAll('[data-action="settings"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof navigate === 'function') navigate('#impostazioni');
      else location.hash = '#impostazioni';
    });
  });
}

// Reviews storage (Supabase-first)
const REVIEWS_TABLE = 'reviews';
// Cache review stats to avoid repeated computations
const REVIEW_STATS = new Map(); // productId -> { avg, count }

async function getReviewStats(productId) {
  if (REVIEW_STATS.has(productId)) return REVIEW_STATS.get(productId);
  // Try Supabase aggregate first
  try {
    if (supaReady && supaReady()) {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select('avg:avg(rating),count:count()', { head: false})
        .eq('product_id', productId);
      if (!error && Array.isArray(data) && data[0]) {
        const avg = Number(data[0].avg) || 0;
        const count = Number(data[0].count) || 0;
        const stats = { avg, count };
        REVIEW_STATS.set(productId, stats);
        return stats;
      }
    }
  } catch (_) {}
  // Fallback: compute from local
  const list = await fetchReviews(productId);
  const count = list.length;
  const avg = count ? (list.reduce((s,r)=>s + (Number(r.rating)||0), 0) / count) : 0;
  const stats = { avg, count };
  REVIEW_STATS.set(productId, stats);
  return stats;
}

async function fetchReviews(productId) {
  // Supabase-first (public readable per policy)
  try {
    if (supaReady && supaReady()) {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select('id, user_id, rating, text, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) return data;
    }
  } catch (_) {}
  // Fallback: LocalStorage
  const all = readLS(LS_KEYS.reviews, {});
  const list = Array.isArray(all[productId]) ? all[productId] : [];
  // Normalize to supabase-like shape for rendering
  return list.map((r, idx) => ({ id: `ls_${idx}`, user_id: null, rating: r.rating, text: r.text, created_at: r.date, __source: 'local' }));
}

async function addReview(productId, { name, rating, text }) {
  const review = {
    rating: Math.max(1, Math.min(5, Number(rating) || 5)),
    text: (text || '').toString().trim(),
  };
  if (!review.text) throw new Error('empty_review');
  // Supabase insert if logged in
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const { error } = await supabase.from(REVIEWS_TABLE).insert({
          user_id: u.id,
          product_id: productId,
          rating: review.rating,
          text: review.text,
        });
        if (error) throw error;
        return { ok: true, source: 'supabase' };
      }
    }
  } catch (e) {
    console.warn('[reviews] supabase insert failed; falling back to LS', e);
  }
  // Fallback: LocalStorage
  const all = readLS(LS_KEYS.reviews, {});
  const list = Array.isArray(all[productId]) ? all[productId] : [];
  list.unshift({ name: (name || 'Anonimo').trim() || 'Anonimo', rating: review.rating, text: review.text, date: new Date().toISOString() });
  all[productId] = list.slice(0, 50);
  writeLS(LS_KEYS.reviews, all);
  return { ok: true, source: 'local' };
}

function isAdminEmail(email) {
  const list = Array.isArray(window.IANY_ADMINS_EMAILS) ? window.IANY_ADMINS_EMAILS : [];
  if (!email) return false;
  return list.map(e => String(e).toLowerCase().trim()).includes(String(email).toLowerCase().trim());
}

async function canDeleteReview(review) {
  try {
    const u = await sbCurrentUser();
    if (!u) return isAdminEmail(null); // no user; only allow if admin list contains empty (never)
    if (review.user_id && review.user_id === u.id) return true; // own review
    if (isAdminEmail(u.email)) return true; // admin
  } catch(_) {}
  return false;
}

async function deleteReview(productId, review) {
  // Supabase delete by id when possible
  try {
    if (supaReady && supaReady() && review.id && !String(review.id).startsWith('ls_')) {
      const allowed = await canDeleteReview(review);
      if (!allowed) throw new Error('not_allowed');
      const { error } = await supabase.from(REVIEWS_TABLE).delete().eq('id', review.id);
      if (error) throw error;
      REVIEW_STATS.delete(productId);
      return { ok: true, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[reviews] supabase delete failed', e);
    if (String(e?.message||'').includes('not_allowed')) throw e;
  }
  // Fallback: delete from LocalStorage list by matching text+date
  const all = readLS(LS_KEYS.reviews, {});
  const list = Array.isArray(all[productId]) ? all[productId] : [];
  const idx = list.findIndex(r => r.text === review.text && r.date === review.created_at);
  if (idx >= 0) {
    list.splice(idx, 1);
    all[productId] = list;
    writeLS(LS_KEYS.reviews, all);
    REVIEW_STATS.delete(productId);
    return { ok: true, source: 'local' };
  }
  throw new Error('not_found');
}

// LocalStorage helpers
const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
};
const writeLS = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
};

// Toasts
function showToast(message, type = 'success', timeout = 2500) {
  const wrap = $('#toasts');
  if (!wrap) return;
  const icons = { success: '✓', error: '⚠', info: 'ℹ', warning: '!', default: '✓' };
  const icon = icons[type] || icons.default;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icon}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Chiudi">✕</button>
    <div class="toast-progress"><i></i></div>
  `;
  wrap.appendChild(el);
  // animate in
  requestAnimationFrame(() => el.classList.add('show'));
  const remove = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); };
  el.querySelector('.toast-close')?.addEventListener('click', remove);
  // Progress bar animation (JS-driven to respect custom timeout)
  try {
    const bar = el.querySelector('.toast-progress i');
    if (bar) {
      const start = performance.now();
      const total = Math.max(800, Number(timeout) || 2500);
      const tick = (t) => {
        const p = Math.min(1, (t - start) / total);
        bar.style.transform = `scaleX(${1 - p})`;
        if (p < 1 && document.body.contains(el)) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  } catch (_) {}
  setTimeout(remove, Math.max(800, Number(timeout) || 2500));
}

// App State Keys
const LS_KEYS = {
  users: 'iany_users',
  session: 'iany_session',
  cart: 'iany_cart',
  favs: 'iany_favs',
  contact: 'iany_contact_msgs',
  settings: 'iany_settings',
  last_order: 'iany_last_order',
  coupon_usage: 'iany_coupon_usage',
  reviews: 'iany_reviews',
  pending_order: 'iany_pending_order'
};

// Mock Products
const PRODUCTS = [
  { id: 'Xbox Gift Card 10€', name: 'Carta Regalo Xbox 10€', price: 9.00, old: 10.00, img: 'assets/grafica1.png', tag: 'console' },
  { id: 'Xbox Gift Card 20€', name: 'Carta Regalo Xbox 20€', price: 19.15, old: 20.00, img: 'assets/grafica1.png', tag: 'console' },
  { id: 'Xbox Gift Card 50€', name: 'Carta Regalo Xbox 50€', price: 47.50, old: 50.00, img: 'assets/grafica1.png', tag: 'console' },
  { id: 'Playstation Gift Card 10€', name: 'Carta Regalo PlayStation 10€', price: 9.00, old: 10.00, img: 'assets/grafica2.png', tag: 'console' },
  { id: 'Playstation Gift Card 20€', name: 'Carta Regalo PlayStation 20€', price: 19.15, old: 20.00, img: 'assets/grafica2.png', tag: 'console' },
  { id: 'Playstation Gift Card 50€', name: 'Carta Regalo PlayStation 50€', price: 47.50, old: 50.00, img: 'assets/grafica2.png', tag: 'console' },
  { id: 'Steam Gift Card 10€', name: 'Carta Regalo Steam ', price: 9.00, old: 10.00, img: 'assets/grafica5.png', tag: 'console' },
  { id: 'Steam Gift Card 20€', name: 'Carta Regalo Steam ', price: 23.50, old: 25.00, img: 'assets/grafica5.png', tag: 'console' },
  { id: 'Steam Gift Card 50€', name: 'Carta Regalo Steam ', price: 47.50, old: 50.00, img: 'assets/grafica5.png', tag: 'console' },
  { id: '1000 Valorant Points', name: '1000 Valorant points ', price: 9.00, old: 10.00, img: 'assets/grafica4.png', tag: 'console' },
  { id: '2050 Valorant Points', name: '2050 Valorant points ', price: 18.80, old: 20.00, img: 'assets/grafica4.png', tag: 'console' },
  { id: '5350 Valorant Points', name: '5350 Valorant points ', price: 47.50, old: 50.00, img: 'assets/grafica4.png', tag: 'console' },
  { id: '1000 V-bucks', name: '1000 V-bucks Fortnite gift card ', price: 7.59, old: 8.00, img: 'assets/grafica1.png', tag: 'console' },
  { id: '2800 V-bucks', name: '2800 V-bucks Fortnite gift card ', price: 21.99, old: 23.00, img: 'assets/grafica2.png', tag: 'console'},
  { id: '5000 V-bucks', name: '5000 V-bucks Fortnite gift card ', price: 34.99, old: 35.00, img: 'assets/grafica3.png', tag: 'console'},
  { id: '13500 V-bucks', name: '13500 V-bucks Fortnite gift card ', price: 88.59, old: 90.00, img: 'assets/grafica6.png', tag: 'console'},
  { id: 'Controller per console', name: 'Controller per console', price: 39.99, old: 45.00, img: 'https://images.unsplash.com/photo-1599669454699-248893623440?q=80&w=1200&auto=format&fit=crop', tag: 'accessori' }
];

// Offerte speciali
const OFFERS = [
  { id: 'ps5-bundle', name: 'PS5 + 2 Giochi', price: 629.99, old: 699.99, img: 'https://images.unsplash.com/photo-1606813907291-76db6251b53a?q=80&w=1200&auto=format&fit=crop' },
  { id: 'xbox-bundle', name: 'Xbox X + Game Pass', price: 589.99, old: 649.99, img: 'https://images.unsplash.com/photo-1605901309584-818e25960a8b?q=80&w=1200&auto=format&fit=crop' },
];

// Dettagli prodotto (descrizioni + galleria)
const PRODUCT_DETAILS = {
  'Xbox Gift Card 10€': {
    desc: 'Gift Card Xbox da 10 euro (Formato Digitale)',
    images: [
      'assets/grafica1.png',
      
    ]
  },
  'Xbox Gift Card 20€': {
    desc: 'Gift Card Xbox da 20 euro (Formato Digitale)',
    images: [
      'assets/grafica1.png',
     
    ]
  },
  'Xbox Gift Card 50€': {
    desc: 'Gift Card Xbox da 50 euro (Formato Digitale)',
    images: [
      'assets/grafica1.png',
      
    ]
  },
  'Playstation Gift Card 10€': {
    desc: 'Gift Card Playstation da 10 euro (Formato Digitale)',
    images: [
      'assets/grafica2.png',
      
    ]
  },
  'Playstation Gift Card 20€': {
    desc: 'Gift Card Playstation da 20 euro (Formato Digitale) ',
    images: [
      'assets/grafica2.png',
      
    ]
  },
  'Playstation Gift Card 50€': {
    desc: 'Gift Card Playstation da 50 euro (Formato Digitale)',
    images: [
      'assets/grafica2.png',
  
    ]
  },
  'Steam Gift Card 10€ ': {
    desc: 'Gift Card Steam da 10 euro (Formato Digitale) ',
    images: [
      'assets/grafica5.png',
     
    ]
  },
  'Steam Gift Card 25€': {
    desc: 'Gift Card Steam da 25 euro (Formato Digitale)',
    images: [
      'assets/grafica5.png',
      
    ]
  },
  'Steam Gift Card 50€': {
    desc: 'Gift Card Steam da 50 euro (Formato Digitale)',
    images: [
      'assets/grafica5.png',
      
    ]
  },
    '1000 Valorant Points': {
    desc: 'Gift Card 1000 Valorant Points (Formato Digitale) ',
    images: [
      'assets/grafica4.png',
      
    ]
      },
      '2050 Valorant Points': {
    desc: 'Gift Card 2050 Valorant Points (Formato Digitale)',
    images: [
      'assets/grafica4.png',
 
    ]
      },
      '5350 Valorant Points': {
    desc: 'Gift Card 5350 Valorant Points (Formato Digitale) ',
    images: [
      'assets/grafica4.png',
     
    ]
      },
      '1000 V-bucks': {
    desc: 'Gift Card  da 1000 V-bucks (Formato Digitale)',
    images: [
      'assets/grafica1.png',
      
    ]
      },
      '2800 V-bucks': {
    desc: 'Gift Card da 2800  V-bucks (Formato Digitale)',
    images: [
      'assets/grafica2.png',
      
    ]
      },
      '5000 V-bucks': {
    desc: 'Gift Card da 5000 V-bucks (Formato Digitale)',
    images: [
      'assets/grafica3.png',
      
    ]
      },
         '13500 V-bucks': {
    desc: 'Gift Card da 13500 V-bucks (Formato Digitale)',
    images: [
      'assets/grafica6.png',
    ]
      },
};

function getItemById(id) {
  return [...PRODUCTS, ...OFFERS].find(x => x.id === id);
}

// Try to derive the original (undiscounted) price from product text (e.g., "20€")
function getOldPrice(p) {
  if (!p) return null;
  // 1) If explicit old price exists (e.g., in OFFERS), prefer that
  if (typeof p.old === 'number' && p.old > 0) return p.old;
  // 2) Always provide a fallback old price based on current price (+15%)
  const base = (typeof p.price === 'number' && isFinite(p.price)) ? p.price : null;
  if (base != null) {
    const FACTOR = 1.15; // adjustable default markup
    return Math.round(base * FACTOR * 100) / 100;
  }
  // 3) As a last resort try to parse amounts from text (kept for robustness)
  const txt = `${p.id || ''} ${p.name || ''}`;
  const re = /(\d+(?:[.,]\d{1,2})?)\s*€/g;
  let m, last = null;
  while ((m = re.exec(txt)) !== null) { last = m[1]; }
  if (last) {
    const val = Number(String(last).replace(',', '.'));
    if (isFinite(val)) return val;
  }
  return null;
}

// Product Modal helpers
let CURRENT_PM_ID = null;
let PM_OPENING = false;
function openProductModal(id) {
  if (PM_OPENING) return;
  PM_OPENING = true;
  try {
    const item = getItemById(id);
    if (!item) return;
    CURRENT_PM_ID = id;
    const details = PRODUCT_DETAILS[id] || { desc: '', images: [item.img] };
    $('#pmTitle').textContent = item.name;
    // Augment modal title with rating summary (async to avoid blocking)
    setTimeout(() => {
      getReviewStats(id).then(({ avg, count }) => {
        if (!count) return;
        const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(avg))));
        $('#pmTitle').textContent = `${item.name} · ${stars} ${avg.toFixed(1)} (${count})`;
      }).catch(console.warn);
    }, 0);

    // Price section (with old price and discount badge when applicable)
    {
      const old = getOldPrice(item);
      let html = `${formatEUR(item.price)}`;
      if (typeof old === 'number' && isFinite(old)) {
        html += ` <span class="old">${formatEUR(old)}</span>`;
        if (old > item.price) {
          const pct = Math.round((1 - (item.price / old)) * 100);
          // Optionally, you could render a badge somewhere if needed
        }
      }
      $('#pmPrice').innerHTML = html;
    }

    // gallery (filter out falsy/invalid entries)
    const imgs = (Array.isArray(details.images) && details.images.length ? details.images : [item.img]).filter(Boolean);
    if (!imgs.length) {
      console.warn('Nessuna immagine valida per il prodotto', id, details);
      showToast?.('Immagini prodotto non disponibili', 'error');
      return;
    }
    $('#pmImgMain').src = imgs[0];
    const thumbs = imgs.map((src, i) => `
      <button type="button" data-idx="${i}" class="${i===0?'active':''}" aria-label="Anteprima ${i+1}">
        <img src="${src}" alt="Thumbnail ${i+1}" />
      </button>`).join('');
    $('#pmThumbs').innerHTML = thumbs;

    // init fav icon state (async to avoid blocking)
    setTimeout(async () => {
      try {
        const favsNow = await favsDB();
        $('#pmFavBtn').textContent = favsNow.includes(id) ? '❤️' : '🤍';
      } catch(e) {
        console.warn('Error loading fav state:', e);
        $('#pmFavBtn').textContent = '🤍';
      }
    }, 0);

    // reviews (async to avoid blocking)
    setTimeout(() => renderPMReviews(id).catch(console.warn), 0);

    // review form handler
    const form = $('#pmReviewForm');
    if (form) {
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const name = ($('#pmReviewName')?.value || '').trim();
        const rating = Number($('#pmReviewRating')?.value || '5');
        const text = ($('#pmReviewText')?.value || '').trim();
        if (!text) { $('#pmReviewMsg').textContent = 'Scrivi una recensione prima di inviare.'; return; }
        try {
          await addReview(id, { name, rating, text });
          $('#pmReviewName').value = '';
          $('#pmReviewText').value = '';
          $('#pmReviewRating').value = '5';
          $('#pmReviewMsg').textContent = 'Grazie per la tua recensione!';
          renderPMReviews(id);
        } catch (err) {
          console.error(err);
          $('#pmReviewMsg').textContent = 'Errore durante il salvataggio della recensione.';
        }
      };
    }

    // close handler
    $('#pmClose').onclick = () => closeProductModal();
    const dlg = document.getElementById('productModal');
    // Prefer non-modal open to avoid full-page blocking/backdrop issues
    if (dlg && !dlg.open) {
      try { dlg.show(); }
      catch(_) {
        try { dlg.showModal(); } catch(_) {}
      }
      // Ensure dialog is visibly styled as open
      dlg.classList.add('open');
    }
  } catch (e) {
    console.error('Error opening product modal:', e);
  } finally {
    PM_OPENING = false;
  }
}
function closeProductModal() {
  const dlg = document.getElementById('productModal');
  if (!dlg) return;
  try { dlg.close(); } catch(_) {}
  dlg.classList.remove('open');
}

async function renderPMReviews(id) {
  const box = $('#pmReviewsList');
  if (!box) return;
  const list = await fetchReviews(id);
  if (!list.length) { box.innerHTML = '<p class="muted">Ancora nessuna recensione. Scrivi la prima!</p>'; return; }
  const u = await sbCurrentUser();
  const userEmail = u?.email || '';
  const isAdmin = isAdminEmail(userEmail);
  const safe = (s) => (String(s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));
  box.innerHTML = list.map(r => {
    const d = new Date(r.created_at || r.date);
    const when = isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT');
    const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(Number(r.rating)||5))));
    const canDel = (r.user_id && u?.id === r.user_id) || isAdmin || r.__source === 'local';
    const delBtn = canDel ? `<button class="btn ghost small" data-del="${r.id}">Elimina</button>` : '';
    return `<article class="review">
      <div class="r-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>${stars} <span class="muted">${when}</span></div>
        ${delBtn}
      </div>
      <p>${safe(r.text)}</p>
    </article>`;
  }).join('');
  // Wire delete buttons
  box.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rid = btn.getAttribute('data-del');
      const review = list.find(x => String(x.id) === String(rid));
      if (!review) return;
      btn.disabled = true;
      try {
        await deleteReview(id, review);
        await renderPMReviews(id);
        showToast?.('Recensione eliminata');
      } catch (e) {
        console.warn(e);
        showToast?.('Non hai i permessi per eliminare questa recensione', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// Cart & Favorites via Supabase-first with LS fallback for guests/offline
async function favsDB() {
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', u.id);
        if (!error && Array.isArray(data)) return data.map(r => r.product_id);
      }
    }
  } catch (_) {}
  return readLS(LS_KEYS.favs, []);
}

async function cartDB() {
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const { data, error } = await supabase.from('carts').select('items').eq('user_id', u.id).single();
        if (!error && data && typeof data.items === 'object') return data.items;
      }
    }
  } catch (_) {}
  return readLS(LS_KEYS.cart, {});
}

async function saveCart(cart) {
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const payload = { user_id: u.id, items: cart, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('carts').upsert(payload);
        if (error) throw error;
        return;
      }
    }
  } catch (e) { console.warn('[cart] save failed, falling back to LS', e); }
  writeLS(LS_KEYS.cart, cart);
}

async function addToCart(id, qty = 1) {
  const cart = await cartDB();
  cart[id] = (cart[id] || 0) + qty;
  await saveCart(cart);
  await renderCartBadge();
  const item = getItemById(id);
  if (item) showToast(`“${item.name}” aggiunto al carrello`, 'success');

  // Visual feedback
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) {
    cartBtn.classList.add('shake', 'glow');
    const clear = () => { cartBtn.classList.remove('shake', 'glow'); cartBtn.removeEventListener('animationend', clear); };
    cartBtn.addEventListener('animationend', clear);
    // Fallback timeout in case animationend doesn't fire
    setTimeout(clear, 1200);
    // Confetti burst near cart button
    const r = cartBtn.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    fireConfetti({ x, y, colors: ['#34d399','#60a5fa','#f472b6','#fbbf24','#a78bfa'] });
  }
}

// Confetti effect
function fireConfetti({ x, y, count = 24, spread = 60, gravity = 0.35, decay = 0.007, colors = ['#60a5fa','#93c5fd','#a78bfa','#f472b6'] }) {
  if (prefersReducedMotion()) return;
  const particles = [];
  for (let i=0;i<count;i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    const c = colors[i % colors.length];
    p.style.setProperty('--c', c);
    document.body.appendChild(p);
    particles.push({ el: p, x, y, angle: (Math.random()*spread - spread/2) * (Math.PI/180),
      vx: (Math.random()*6 + 3) * (Math.random() < .5 ? -1 : 1), vy: - (Math.random()*8 + 6), rot: Math.random()*360, vr: (Math.random()*12-6) });
  }
  const start = performance.now();
  (function frame(t){
    const dt = 16; // approx
    let alive = 0;
    particles.forEach(p => {
      p.vy += gravity;
      p.x += p.vx; p.y += p.vy;
      p.vx *= (1 - decay); p.vy *= (1 - decay);
      p.rot += p.vr;
      const el = p.el;
      el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      el.style.opacity = String(Math.max(0, 1 - (performance.now()-start)/1200));
      if (parseFloat(el.style.opacity) > 0) alive++;
    });
    if (alive > 0) requestAnimationFrame(frame); else particles.forEach(p => p.el.remove());
  })(start);
}
async function removeFromCart(id) {
  const cart = await cartDB();
  const item = getItemById(id);
  delete cart[id];
  await saveCart(cart);
  await renderCart();
  await renderCartBadge();
  if (item) showToast(`“${item.name}” rimosso dal carrello`, 'success');
}
async function setQty(id, qty) {
  const cart = await cartDB();
  if (qty <= 0) { return removeFromCart(id); }
  cart[id] = qty;
  await saveCart(cart);
  await renderCart();
  await renderCartBadge();
  const item = getItemById(id);
  if (item) showToast(`Quantità di “${item.name}” aggiornata a ${qty}`, 'success');
}
async function cartCount() {
  const cart = await cartDB();
  return Object.values(cart).reduce((a,b)=>a+b,0);
}
async function cartTotal() {
  const cart = await cartDB();
  return Object.entries(cart).reduce((sum,[id,qty]) => {
    const p = [...PRODUCTS, ...OFFERS].find(x => x.id === id);
    return sum + (p?.price || 0) * qty;
  }, 0);
}

async function toggleFav(id) {
  try {
    if (supaReady && supaReady()) {
      const u = await sbCurrentUser();
      if (u?.id) {
        const favs = new Set(await favsDB());
        const wasFav = favs.has(id);
        if (wasFav) {
          const { error } = await supabase.from('favorites').delete().eq('user_id', u.id).eq('product_id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('favorites').insert({ user_id: u.id, product_id: id });
          if (error) throw error;
        }
        await renderFavsIconStates();
        showToast?.(wasFav ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti', 'success');
        return;
      }
    }
  } catch (e) { console.warn('[fav] supabase toggle failed, fallback to LS', e); }
  // Fallback to LocalStorage
  const favs = new Set(readLS(LS_KEYS.favs, []));
  const wasFav = favs.has(id);
  if (wasFav) favs.delete(id); else favs.add(id);
  writeLS(LS_KEYS.favs, Array.from(favs));
  await renderFavsIconStates();
  showToast?.(wasFav ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti', 'success');
}

// UI: Navbar active link
function setActiveLink(hash) {
  $$(".nav-links a").forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));
}

// UI: Routing (hash-based SPA)
// Include payment and order detail routes so navigate() doesn't reset to #home when using them
const ROUTES = [
  '#home', '#shop', '#prodotti', '#contattaci', '#chisiamo', '#preferiti',
  '#checkout', '#ordine-completato', '#ordine-dettaglio', '#termini', '#account',
  '#impostazioni',
  '#pay-card', '#pay-amex', '#pay-paypal'
];
function navigate(hash) {
  if (!ROUTES.includes(hash)) hash = '#home';
  setActiveLink(hash);
  $$('.route').forEach(sec => sec.classList.add('hidden'));
  // Toggle Account page visibility (sezione separata)
  const acc = document.getElementById('account');
  if (acc) acc.hidden = (hash !== '#account');
  // Show target if it is a routed section
  const target = $(hash);
  if (target && target.classList.contains('route')) target.classList.remove('hidden');
  // Chatbot visible only in Shop
  try {
    const cb = document.getElementById('chatbot');
    if (cb) {
      const show = (hash === '#shop');
      cb.classList.toggle('hidden', !show);
      if (!show) cb.querySelector('.chatbot-panel')?.setAttribute('hidden','');
    }
  } catch(_) {}
  if (hash === '#shop') { setupShopFilters(); renderShop(); }
  if (hash === '#prodotti') renderOffers();
  if (hash === '#preferiti') renderFavs();
  if (hash === '#checkout') renderCheckout();
  if (hash === '#ordine-completato') renderOrderCompleted();
  if (hash === '#account') renderAccount();
}

// Helper: re-render current route without toggling visibility
function rerenderCurrentRoute() {
  const hash = location.hash || '#home';
  try {
    if (hash === '#home' || hash === '#shop') {
      // Home/Shop sections: refresh product and offers grids
      try { renderShop(); } catch (_) {}
      try { renderOffers(); } catch (_) {}
    } else if (hash === '#preferiti') {
      try { renderFavs(); } catch (_) {}
    } else if (hash === '#checkout') {
      try { renderCheckout(); } catch (_) {}
    } else if (hash === '#account') {
      try { renderAccount(); } catch (_) {}
    } else if (hash === '#ordine-completato') {
      try { renderOrderCompletedRoute(); } catch (_) {}
    } else if (hash === '#ordine-dettaglio') {
      try { renderOrderDetailRoute(); } catch (_) {}
    } else if (hash === '#pay-card' || hash === '#pay-amex' || hash === '#pay-paypal') {
      try { renderPaymentRoute(hash); } catch (_) {}
    }
  } catch (_) {}
}

// Render: Shop grid
function productCard(p, favsSet = new Set()) {
  const heart = favsSet.has(p.id) ? '❤️' : '🤍';
  const old = getOldPrice(p);
  const oldHtml = old ? ` <span class="old">${formatEUR(old)}</span>` : '';
  // rating placeholder (hydrated async after render)
  const stats = REVIEW_STATS.get(p.id);
  const ratingHtml = stats && stats.count ? `<div class="muted" data-rating="${p.id}">⭐ ${stats.avg.toFixed(1)} (${stats.count})</div>` : `<div class="muted" data-rating="${p.id}"></div>`;
  const discount = old ? Math.max(0, Math.round((1 - (p.price / old)) * 100)) : 0;
  const saleBadge = old ? `<span class="badge sale" aria-label="Sconto ${discount}%">-${discount}%</span>` : '';
  const bestBadge = `<span class="badge best" hidden>Best Seller</span>`;
  const desc = (p.desc || p.description || '').toString().trim();
  const descHtml = desc ? `<p class="product-desc">${desc}</p>` : '';
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-media">
        <div class="product-badges">${saleBadge}${bestBadge}</div>
        <img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/giftcard.png'">
      </div>
      <div class="product-body">
        <h3 class="product-title">${p.name}</h3>
        ${descHtml}
        ${ratingHtml}
        <div class="price">${formatEUR(p.price)}${oldHtml}</div>
      </div>
      <div class="product-actions">
        <button class="btn primary" data-add="${p.id}">Aggiungi al carrello</button>
        <button class="fav-btn" data-fav="${p.id}" aria-label="Aggiungi ai preferiti">${heart}</button>
        <button class="btn ghost" data-detail="${p.id}">Dettagli</button>
      </div>
    </div>`;
}

// Render: Offer card (same interaction hooks as productCard)
function offerCard(p, favsSet = new Set()) {
  const heart = favsSet.has(p.id) ? '❤️' : '🤍';
  const old = p.old ? `<span class="old">${formatEUR(p.old)}</span>` : '';
  const stats = REVIEW_STATS.get(p.id);
  const ratingHtml = stats && stats.count ? `<div class="muted" data-rating="${p.id}">⭐ ${stats.avg.toFixed(1)} (${stats.count})</div>` : `<div class="muted" data-rating="${p.id}"></div>`;
  const discount = p.old ? Math.max(0, Math.round((1 - (p.price / p.old)) * 100)) : 0;
  const saleBadge = p.old ? `<span class=\"badge sale\" aria-label=\"Sconto ${discount}%\">-${discount}%</span>` : '';
  const bestBadge = `<span class=\"badge best\" hidden>Best Seller</span>`;
  const desc = (p.desc || p.description || '').toString().trim();
  const descHtml = desc ? `<p class="product-desc">${desc}</p>` : '';
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-media">
        <div class="product-badges">${saleBadge}${bestBadge}</div>
        <img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/giftcard.png'">
      </div>
      <div class="product-body">
        <h3 class="product-title">${p.name}</h3>
        ${descHtml}
        ${ratingHtml}
        <div class="price">${formatEUR(p.price)} ${old}</div>
      </div>
      <div class="product-actions">
        <button class="btn primary" data-add="${p.id}">Aggiungi al carrello</button>
        <button class="fav-btn" data-fav="${p.id}" aria-label="Aggiungi ai preferiti">${heart}</button>
      </div>
    </div>`;
}

// Chatbot
function initChatbot() {
  const root = document.getElementById('chatbot');
  if (!root || root.dataset.wired === '1') return;
  root.dataset.wired = '1';
  const toggle = document.getElementById('chatbotToggle');
  const panel = root.querySelector('.chatbot-panel');
  const closeBtn = document.getElementById('chatbotClose');
  const resetBtn = document.getElementById('chatbotReset');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotText');
  const msgs = document.getElementById('chatbotMessages');
  const ping = toggle?.querySelector('.ping');
  // Ensure ping is hidden initially; it will be shown only for unread bot replies
  if (ping) ping.style.display = 'none';
  let unknownCount = 0;
  let lastIntent = '';
  let welcomed = false;
  const SUPPORT_EMAIL = (window && window.IANY_SUPPORT_EMAIL) ? String(window.IANY_SUPPORT_EMAIL) : '';
  // Short-term memory for the conversation
  const CHAT_MEMORY = { lastProduct: null, lastBrand: null, lastTopic: null };
  // Conversational variants per intent to avoid repetitive answers
  const RESPONSES = {
    greet: [
      'Ciao! Sono l’assistente Iany. Come posso aiutarti oggi?',
      'Ehi! Benvenuto su Iany. Dimmi pure come posso darti una mano.',
      'Ciao! Felice di rivederti su Iany. Serve aiuto per scegliere o acquistare?'
    ],
    thanks: [
      'Di nulla! Se ti serve altro sono qui 😊',
      'Figurati! Hai altre domande?',
      'Con piacere! Dimmi pure se posso aiutarti ancora.'
    ],
    bye: [
      'A presto e buon shopping! 👋',
      'Grazie della visita! A presto 👋',
      'Alla prossima! Buona giornata 👋'
    ],
    gift: [
      'Le carte regalo arrivano via email in pochi minuti dopo il pagamento: niente spedizione e nessun costo extra.',
      'Per le gift card ricevi il codice digitale subito dopo il pagamento, direttamente via email.',
      'Le nostre carte regalo sono consegnate istantaneamente via email: nessuna attesa di spedizione.'
    ],
    brand: [
      'Certo! Abbiamo diversi tagli. Puoi filtrare per marca nella sezione Carte Regalo.',
      'Sì, ci sono vari tagli disponibili. Usa il filtro “Carte Regalo” per trovare velocemente quello giusto.',
      'Assolutamente! Seleziona la marca che ti interessa tra Xbox, PlayStation, Steam e altro.'
    ],
    ship: [
      'Spedizione gratuita sopra 59€. Per i prodotti fisici: 24–48h. Le gift card sono istantanee via email.',
      'Per ordini sopra 59€ la spedizione è gratis. I prodotti fisici arrivano in 1–2 giorni; i codici digitali subito.',
      'Sopra 59€ non paghi la spedizione. Tempi rapidi per il fisico; consegna immediata per gift card.'
    ],
    coupon: [
      'I codici attivi sono: FREESHIP (spedizione gratuita), BENVENUTO5 (−5€), IANY10 (−10%). Ogni codice è utilizzabile una sola volta per account.',
      'Al checkout inserisci il codice nel campo “Codice sconto”. Disponibili: FREESHIP per spedizione gratuita, BENVENUTO5 per 5€ di sconto e IANY10 per il 10%. Validi una sola volta per account.',
      'Puoi usare solo uno alla volta: FREESHIP, BENVENUTO5 o IANY10. Ognuno è valido una volta per account. Inseriscilo nel campo coupon in checkout.'
    ],
    pay: [
      'Accettiamo carte e PayPal. Se vuoi, ti guido passo passo nel pagamento.',
      'Supportiamo carte e PayPal; altri metodi arriveranno presto. Vuoi completare ora l’ordine?',
      'Puoi pagare con carta o PayPal. Dimmi pure se preferisci un metodo specifico.'
    ],
    return: [
      'Hai 14 giorni di reso per i prodotti fisici in condizioni originali. Per i codici digitali, assistiamo in caso di problemi.',
      'Per i prodotti fisici è previsto il recesso entro 14 giorni. Per i codici, contattaci in caso di malfunzionamento.',
      'I resi sui prodotti fisici sono possibili entro 14 giorni; sui codici digitali valutiamo eventuali anomalie.'
    ],
    stock: [
      'Molti articoli sono disponibili subito. Quale prodotto ti interessa?',
      'Disponibilità aggiornate di frequente: dimmi il prodotto e controllo.',
      'Spesso spediamo in giornata per articoli in stock. Che prodotto cerchi?'
    ],
    support: [
      'Certo! Dimmi pure cosa non ti è chiaro e vediamo insieme.',
      'Sono qui per aiutarti. Raccontami il problema e troviamo la soluzione.',
      'Volentieri: spiegami nel dettaglio e ti supporto passo passo.'
    ],
    price: [
      () => `I prezzi mostrati sono nella valuta ${APP_CURRENCY}. Vuoi che ti aiuti a confrontare le offerte?`,
      () => `Al momento visualizzi i prezzi in ${APP_CURRENCY}. Posso guidarti tra i prodotti più convenienti.`,
      () => `Visualizzazione in ${APP_CURRENCY}: se cambi valuta nelle Impostazioni, aggiornerò tutti i prezzi al cambio corrente.`
    ],
    currency: [
      () => `Supportiamo più valute. Ora stai usando ${APP_CURRENCY}. Puoi cambiarla in Impostazioni e aggiornerò i prezzi automaticamente.`,
      () => `Sto mostrando i prezzi in ${APP_CURRENCY}. Vuoi passare a un’altra valuta?`,
      () => `Cambio valuta supportato: i prezzi base sono in EUR, li converto in ${APP_CURRENCY} per la tua comodità.`
    ],
    order: [
      'Vuoi un aiuto a concludere l’ordine? Posso accompagnarti passo passo.',
      'Se vuoi, rivediamo insieme carrello e checkout in pochi passaggi.',
      'Posso aiutarti a finalizzare l’acquisto ora: ti va?'
    ],
    coupon_help: [
      'Se il coupon non funziona, verifica maiuscole/minuscole e scadenza. In caso di problemi ti metto in contatto con l’assistenza.',
      'Controlla se il codice è valido e non ha superato i limiti di utilizzo. Posso anche avvisare il supporto per te.',
      'A volte il coupon è specifico per alcuni articoli o soglie. Vuoi che controlli insieme a te?'
    ],
    hours: [
      'Siamo online h24. Le spedizioni fisiche partono nei giorni lavorativi; i codici digitali arrivano subito.',
      'Il sito è sempre attivo. Logistica fisica: lun–ven; consegne digitali: istantanee.'
    ],
    warranty: [
      'I prodotti fisici hanno garanzia legale. Per i codici digitali ti assistiamo in caso di problemi di riscatto.',
      'Garanzia standard sui prodotti fisici; per i codici digitali offriamo supporto dedicato in caso di errori.'
    ],
    newsletter: [
      'Puoi iscriverti alla newsletter dalla home: inviamo offerte e coupon esclusivi.',
      'Iscriviti alla newsletter per sconti e anteprime: trovi il form in fondo alla home.'
    ],
    account: [
      'Per accedere o registrarti vai su Accedi/Registrati. Posso anche aprire la pagina per te.',
      'Gestisci profilo, ordini e preferiti dalla pagina Account dopo l’accesso.'
    ],
    terms: [
      'I nostri Termini e Condizioni sono qui: vai alla sezione Termini dal menu o usa questo link: index.html#termini',
      'Puoi leggere Termini e Privacy nella sezione dedicata: index.html#termini'
    ],
    security: [
      'Usiamo Supabase per autenticazione sicura; le password sono cifrate e non visibili allo staff.',
      'Connessioni protette e gestione sicura dell’account: i tuoi dati sono trattati nel rispetto della privacy.'
    ],
    order_status: [
      'Per lo stato dell’ordine controlla la sezione Ordini nel tuo Account oppure contattaci con l’ID ordine.',
      'Puoi verificare tracking e ricevute dall’Account. Se vuoi ti porto alla pagina.'
    ]
  };
  function pick(key){
    const arr = RESPONSES[key]||[];
    if (!arr.length) return '';
    if (!pick.last) pick.last = new Map();
    const last = pick.last.get(key);
    let choices = arr.filter(v => v !== last);
    if (!choices.length) choices = arr;
    const choice = choices[Math.floor(Math.random()*choices.length)];
    pick.last.set(key, choice);
    return choice;
  }
  // Helpers and small KB inside chatbot scope
  function rand(msMin=300, msMax=800){ return Math.floor(Math.random()*(msMax-msMin+1))+msMin; }
  function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }
  const KB = [
    { keys: ['resi','reso','rimbor','recesso'], answers: [
      'Puoi effettuare il reso dei prodotti fisici entro 14 giorni se in condizioni originali. Per i codici digitali ti assistiamo in caso di problemi.',
      'Per i resi: 14 giorni sui prodotti fisici; per le gift card interveniamo se il codice non funziona.'] },
    { keys: ['contatt','support','assistenza','email'], answers: [
      `Puoi scriverci a ${SUPPORT_EMAIL || 'l’email indicata in Contattaci'} oppure usare la pagina Contattaci dal menu.`,
      `Siamo raggiungibili via e‑mail (${SUPPORT_EMAIL || 'vedi Contattaci'}) e rispondiamo rapidamente.`] },
    { keys: ['orari','apert','quando','tempi'], answers: [
      'Il sito è attivo h24. Le spedizioni per articoli fisici partono nei giorni lavorativi; i codici digitali arrivano subito.',
      'Siamo operativi tutti i giorni online; per la logistica fisica seguiamo i giorni lavorativi.'] },
    { keys: ['garanzia','warranty','assistenza tecnica'], answers: [
      'Garanzia legale sui prodotti fisici; supporto in caso di problemi con codici digitali.',
      'Per assistenza tecnica o garanzie scrivici: rispondiamo rapidamente.' ] },
    { keys: ['termini','condizioni','privacy'], answers: [
      'Trovi Termini e Privacy su index.html#termini.',
      'Consulta i Termini nella pagina Termini e Condizioni del sito.' ] },
  ];
  function kbAnswer(q){
    for (const item of KB){ if (item.keys.some(k => q.includes(k))) { return item.answers[Math.floor(Math.random()*item.answers.length)]; } }
    return '';
  }
  function addCTAButtons(buttons){
    const row = document.createElement('div');
    row.className = 'bot';
    const wrap = document.createElement('div');
    wrap.style.display='flex'; wrap.style.flexWrap='wrap'; wrap.style.gap='6px';
    buttons.forEach(b=>{
      const btn = document.createElement('button');
      btn.type='button'; btn.className='btn ghost'; btn.textContent=b.label;
      btn.addEventListener('click', b.action);
      wrap.appendChild(btn);
    });
    row.appendChild(wrap); msgs.appendChild(row); scrollBottom();
  }
  function detectProductAndBrand(q){
    try {
      const low = q.toLowerCase();
      let found = null;
      for (const p of PRODUCTS){
        const name = `${p.name||''}`.toLowerCase();
        if (name && (low.includes(name) || name.split(/\s+/).some(w => w.length>3 && low.includes(w)))) { found = p; break; }
      }
      if (found){
        CHAT_MEMORY.lastProduct = found;
        CHAT_MEMORY.lastBrand = (typeof brandFromProduct === 'function') ? brandFromProduct(found) : null;
      } else {
        const brands = ['xbox','playstation','steam','valorant','fortnite'];
        const b = brands.find(b => low.includes(b));
        CHAT_MEMORY.lastBrand = b || CHAT_MEMORY.lastBrand;
      }
    } catch(_) {}
  }

  function scrollBottom() { msgs?.lastElementChild?.scrollIntoView({ block: 'end' }); }
  function addMsg(text, who='bot') {
    const div = document.createElement('div');
    div.className = who;
    div.textContent = text;
    msgs.appendChild(div);
    scrollBottom();
    // If bot replies while panel is closed, show ping on the toggle button
    if (who === 'bot' && panel?.hasAttribute('hidden')) {
      if (ping) ping.style.display = '';
    }
  }
  function typing(on=true){
    if (!msgs) return;
    let tip = msgs.querySelector('.typing');
    if (on && !tip){
      tip = document.createElement('div');
      tip.className = 'bot typing';
      tip.textContent = 'Sta scrivendo…';
      msgs.appendChild(tip);
      scrollBottom();
    } else if (!on && tip){ tip.remove(); }
  }
  function greet(){
    const h = new Date().getHours();
    const when = h<12 ? 'Buongiorno' : (h<18 ? 'Buon pomeriggio' : 'Buonasera');
    // Mix saluto orario con variante greet
    return `${when}! ${pick('greet')}`;
  }
  async function getUserName(){
    try { const s=await getSettings(); const n=(s?.name||'').trim(); if (n) return n.split(' ')[0]; }catch(_){}
    const e = (getSessionUser()?.email || (await getSettings())?.email) || '';
    return e ? e.split('@')[0] : '';
  }
  function addSuggestions(keys=[]){
    if (!keys.length) return;
    const row = document.createElement('div');
    row.className = 'bot';
    const wrap = document.createElement('div');
    wrap.style.display='flex'; wrap.style.flexWrap='wrap'; wrap.style.gap='6px';
    shuffle(keys).forEach(k=>{
      const b = document.createElement('button');
      b.type='button'; b.className='btn ghost'; b.textContent=k;
      b.addEventListener('click', ()=>{
        input.value=k; form.dispatchEvent(new Event('submit'));
      });
      wrap.appendChild(b);
    });
    row.appendChild(wrap); msgs.appendChild(row); scrollBottom();
  }
  function supportActionButtons(){
    const row = document.createElement('div');
    row.className = 'bot';
    const wrap = document.createElement('div');
    wrap.style.display='flex'; wrap.style.flexWrap='wrap'; wrap.style.gap='6px';
    const contact = document.createElement('button');
    contact.type='button'; contact.className='btn ghost'; contact.textContent='Contatta assistenza';
    contact.addEventListener('click', ()=>{
      if (SUPPORT_EMAIL) {
        const sub = encodeURIComponent('Assistenza Iany – supporto ordine');
        const body = encodeURIComponent('Ciao Iany, avrei bisogno di aiuto per il mio acquisto.\n\nDettagli:');
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${sub}&body=${body}`;
      } else {
        location.hash = '#contattaci';
      }
    });
    wrap.appendChild(contact);
    const goContact = document.createElement('button');
    goContact.type='button'; goContact.className='btn ghost'; goContact.textContent='Vai a Contattaci';
    goContact.addEventListener('click', ()=>{ location.hash = '#contattaci'; });
    wrap.appendChild(goContact);
    row.appendChild(wrap); msgs.appendChild(row); scrollBottom();
  }
  function replyFor(t){
    const q = (t||'').toLowerCase();
    // Update memory with potential product/brand from the user text
    detectProductAndBrand(q);
    // Try KB first
    const kb = kbAnswer(q);
    if (kb) { lastIntent='kb'; CHAT_MEMORY.lastTopic='kb'; return kb; }
    // small talk
    if (/^(c|sc)iao|hey|buon(giorno|asera)|salve/.test(q)) { lastIntent='greet'; return greet(); }
    if (q.includes('grazie')) { lastIntent='thanks'; return pick('thanks'); }
    if (q.includes('ciao') && (q.includes('dopo')||q.includes('arrivederci'))) { lastIntent='bye'; return pick('bye'); }
    // intents
    if (q.includes('carta') || q.includes('gift') || q.includes('codice')) { lastIntent='gift'; return pick('gift'); }
    if (q.includes('valorant')||q.includes('v-bucks')||q.includes('fortnite')||q.includes('xbox')||q.includes('playstation')||q.includes('steam')) { lastIntent='brand'; return pick('brand'); }
    if (q.includes('spedizion') || q.includes('consegna') || q.includes('spedizione gratuita')) { lastIntent='ship'; return pick('ship'); }
    if (q.includes('coupon') || q.includes('sconto') || q.includes('buoni sconto') || q.includes('promo') || q.includes('freeship') || q.includes('free ship')) { lastIntent='coupon'; return pick('coupon'); }
    if (q.includes('pagament') || q.includes('paypal') || q.includes('carta')) { lastIntent='pay'; return pick('pay'); }
    if (q.includes('reso') || q.includes('rimbor')) { lastIntent='return'; return pick('return'); }
    if (q.includes('disponibil') || q.includes('stock')) { lastIntent='stock'; return pick('stock'); }
    if (q.includes('aiuto') || q.includes('support') || q.includes('assistenza')) { lastIntent='support'; return pick('support'); }
    if (q.includes('prezzo') || q.includes('costa') || q.includes('quanto') || q.includes('euro') || q.includes('dollari') || q.includes('valuta')) { lastIntent='price'; return (RESPONSES.price[Math.floor(Math.random()*RESPONSES.price.length)])(); }
    if (q.includes('valuta') || q.includes('cambio') || q.includes('convert')) { lastIntent='currency'; return (RESPONSES.currency[Math.floor(Math.random()*RESPONSES.currency.length)])(); }
    if (q.includes('ordine') || q.includes('checkout') || q.includes('acquisto')) { lastIntent='order'; return pick('order'); }
    if ((q.includes('coupon') || q.includes('codice')) && (q.includes('non funziona') || q.includes('errore') || q.includes('problema'))) { lastIntent='coupon_help'; return pick('coupon_help'); }
    if (q.includes('orari') || q.includes('apertura') || q.includes('quando siete') || q.includes('tempi')) { lastIntent='hours'; return pick('hours'); }
    if (q.includes('garanzia') || q.includes('warranty')) { lastIntent='warranty'; return pick('warranty'); }
    if (q.includes('newsletter') || q.includes('iscrizione')) { lastIntent='newsletter'; return pick('newsletter'); }
    if (q.includes('account') || q.includes('login') || q.includes('registr')) { lastIntent='account'; return pick('account'); }
    if (q.includes('termini') || q.includes('condizioni') || q.includes('privacy')) { lastIntent='terms'; return pick('terms'); }
    if (q.includes('sicurezz') || q.includes('privacy') || q.includes('dati')) { lastIntent='security'; return pick('security'); }
    if (q.includes('stato ordine') || q.includes('tracking')) { lastIntent='order_status'; return pick('order_status'); }
    lastIntent='unknown';
    return '';
  }
  function escalate(){
    addMsg('Non voglio farti perdere tempo: se preferisci, ti metto in contatto con la nostra assistenza. Rispondiamo via e‑mail molto rapidamente.');
    supportActionButtons();
  }

  toggle?.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden','');
    // When opening, hide the ping indicator
    if (open && ping) ping.style.display = 'none';
    if (!open) {
      input?.focus();
      if (!welcomed) {
        welcomed = true;
        // small delayed welcome to feel natural
        typing(true);
        setTimeout(async ()=>{
          typing(false);
          let msg = greet();
          const name = await (async ()=>{ try{ const s=await getSettings(); return (s?.name||'').split(' ')[0]||''; }catch(_){return ''} })();
          if (name) msg = msg.replace('Sono l’assistente Iany','Sono l’assistente Iany, piacere ' + name);
          addMsg(msg,'bot');
          addSuggestions(['Carte regalo','Spedizione gratuita','Coupon','Pagamenti']);
        }, rand(300,700));
      }
    }
  });
  closeBtn?.addEventListener('click', () => panel.setAttribute('hidden',''));
  resetBtn?.addEventListener('click', () => {
    if (!msgs) return;
    msgs.innerHTML = '';
    unknownCount = 0;
    lastIntent = '';
    welcomed = false;
    addMsg('Chat resettata.','bot');
    input?.focus();
  });
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (input.value||'').trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    // bot typing simulation
    typing(true);
    setTimeout(async () => {
      typing(false);
      let ans = replyFor(text);
      if (!ans){
        unknownCount++;
        const politely = ['Capito, non vorrei darti una risposta imprecisa.','Mh, non sono sicuro di aver capito bene.','Buona domanda, ma non vorrei dirti una cosa errata.'];
        ans = politely[Math.floor(Math.random()*politely.length)] + ' Se vuoi, prova a riformulare; altrimenti posso metterti in contatto con l’assistenza via e‑mail.';
        if (unknownCount>=2) { addMsg(ans,'bot'); escalate(); unknownCount=0; return; }
      } else {
        unknownCount=0;
      }
      // personalize greeting occasionally
      if (lastIntent==='greet'){
        const name = await getUserName();
        if (name) ans = ans.replace('Sono l’assistente Iany','Sono l’assistente Iany, piacere ' + name);
        addMsg(ans,'bot');
        addSuggestions(['Carte regalo','Spedizione','Coupon','Pagamenti']);
        addCTAButtons([
          { label: 'Vai allo Shop', action: ()=>{ location.hash = '#shop'; } },
          { label: 'Vedi Offerte', action: ()=>{ location.hash = '#prodotti'; } },
        ]);
        return;
      }
      // Occasionally add a gentle follow-up to keep conversation lively
      const followUps = [
        'Vuoi che ti aiuti a trovare l’articolo giusto?',
        'Preferisci che ti guidi nel checkout?',
        'Se vuoi posso consigliarti in base al tuo budget.'
      ];
      if (Math.random() < 0.28) ans += ' ' + followUps[Math.floor(Math.random()*followUps.length)];
      // Contextual nudge based on memory
      if (CHAT_MEMORY.lastProduct && (lastIntent==='gift' || lastIntent==='brand' || lastIntent==='stock')){
        ans += ` Se vuoi, posso mostrarti più dettagli su “${CHAT_MEMORY.lastProduct.name}”.`;
      } else if (CHAT_MEMORY.lastBrand && (lastIntent==='gift' || lastIntent==='brand')){
        ans += ` Preferisci vedere le carte di ${CHAT_MEMORY.lastBrand.charAt(0).toUpperCase()+CHAT_MEMORY.lastBrand.slice(1)}?`;
      }
      addMsg(ans,'bot');
      // contextual suggestions
      if (lastIntent==='gift') addSuggestions(['Xbox','PlayStation','Steam','Valorant','Fortnite']);
      if (lastIntent==='coupon') addSuggestions(['Dove inserisco il coupon?','Il mio codice non funziona']);
      if (lastIntent==='ship') addSuggestions(['Tempi di consegna','Spedizione gratuita']);
      if (lastIntent==='price' || lastIntent==='currency') addSuggestions([`Mostra in ${APP_CURRENCY}`, 'Vedi offerte', 'Vai allo Shop']);
      if (lastIntent==='order') addCTAButtons([
        { label: 'Vai al Checkout', action: ()=>{ location.hash = '#checkout'; } },
        { label: 'Apri Carrello', action: ()=>{ location.hash = '#checkout'; } }
      ]);
      if (lastIntent==='account') addCTAButtons([
        { label: 'Accedi / Registrati', action: ()=>{ location.href = 'auth.html'; } },
        { label: 'Vai a Termini', action: ()=>{ location.hash = '#termini'; } }
      ]);
      if (lastIntent==='order_status') addCTAButtons([
        { label: 'Apri Account', action: ()=>{ location.hash = '#account'; } },
        { label: 'Contatta assistenza', action: ()=>{ location.hash = '#contattaci'; } }
      ]);
    }, rand(380,900));
  });
}
function offerCard(p, favsSet = new Set()) {
  const heart = favsSet.has(p.id) ? '❤️' : '🤍';
  const old = p.old ? `<span class="old">${formatEUR(p.old)}</span>` : '';
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-media">
        <img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/giftcard.png'">
      </div>
      <div class="product-body">
        <h3 class="product-title">${p.name}</h3>
        <div class="price">${formatEUR(p.price)} ${old}</div>
      </div>
      <div class="product-actions">
        <button class="btn primary" data-add="${p.id}">Aggiungi al carrello</button>
        <button class="fav-btn" data-fav="${p.id}" aria-label="Aggiungi ai preferiti">${heart}</button>
      </div>
    </div>`;
}

// Shop filters & search
let SHOP_FILTER = 'all';
let GIFT_FILTER = 'all';
let SHOP_SEARCH = '';
let SHOP_SORT = 'none'; // none | price_asc | price_desc | discount | reviews

function brandFromProduct(p) {
  const s = `${p.id || ''} ${p.name || ''}`.toLowerCase();
  if (s.includes('xbox')) return 'xbox';
  if (s.includes('playstation') || s.includes('ps ' ) || s.includes(' ps')) return 'playstation';
  if (s.includes('steam')) return 'steam';
  if (s.includes('valorant')) return 'valorant';
  if (s.includes('v-bucks') || s.includes('vbucks') || s.includes('fortnite')) return 'fortnite';
  return 'other';
}

function setupShopFilters() {
  const bar = document.getElementById('shopFilters');
  const giftBar = document.getElementById('giftFilters');
  const searchInput = document.getElementById('shopSearch');
  const sortSel = document.getElementById('shopSort');
  if (!bar) return;
  // Avoid attaching twice
  if (bar.dataset.wired === '1') return;
  bar.dataset.wired = '1';
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    SHOP_FILTER = btn.getAttribute('data-cat') || 'all';
    // Update active styles
    bar.querySelectorAll('button[data-cat]').forEach(b => b.classList.toggle('active', b === btn));
    // Reset brand filter and search when category changes
    GIFT_FILTER = 'all';
    const giftBar = document.getElementById('giftFilters');
    giftBar?.querySelectorAll('button[data-brand]')?.forEach(b => b.classList.toggle('active', b.getAttribute('data-brand') === 'all'));
    // Toggle visibility of gift brand filters immediately
    if (giftBar) giftBar.hidden = (SHOP_FILTER !== 'console');
    // Toggle CSS gift-mode on shop section
    const shopSec = document.getElementById('shop');
    if (shopSec) shopSec.classList.toggle('gift-mode', SHOP_FILTER === 'console');
    if (searchInput) {
      SHOP_SEARCH = '';
      searchInput.value = '';
    }
    renderShop();
  });
  // Set default active
  const def = bar.querySelector('button[data-cat="all"]');
  if (def) def.classList.add('active');

  // Gift brand bar listeners
  if (giftBar && giftBar.dataset.wired !== '1') {
    giftBar.dataset.wired = '1';
    // Ensure correct initial visibility on setup
    giftBar.hidden = (SHOP_FILTER !== 'console');
    const shopSec = document.getElementById('shop');
    if (shopSec) shopSec.classList.toggle('gift-mode', SHOP_FILTER === 'console');
    giftBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-brand]');
      if (!btn) return;
      GIFT_FILTER = btn.getAttribute('data-brand') || 'all';
      giftBar.querySelectorAll('button[data-brand]').forEach(b => b.classList.toggle('active', b === btn));
      renderShop();
    });
    const defBrand = giftBar.querySelector('button[data-brand="all"]');
    if (defBrand) defBrand.classList.add('active');
  }

  // Search input
  if (searchInput && searchInput.dataset.wired !== '1') {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', (e) => {
      SHOP_SEARCH = (e.target.value || '').toString().trim().toLowerCase();
      renderShop();
    });
  }
  // Sort select
  if (sortSel && sortSel.dataset.wired !== '1') {
    sortSel.dataset.wired = '1';
    sortSel.addEventListener('change', (e) => {
      SHOP_SORT = e.target.value || 'none';
      renderShop();
    });
  }
}

async function renderShop() {
  const grid = $('#shopGrid');
  const giftBar = document.getElementById('giftFilters');
  const favs = new Set(await favsDB());
  // Base by category
  let items = SHOP_FILTER === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.tag === SHOP_FILTER);
  // Toggle gift brand filters when on gift cards
  if (giftBar) giftBar.hidden = (SHOP_FILTER !== 'console');
  // Brand filter (only for gift cards)
  if (SHOP_FILTER === 'console' && GIFT_FILTER !== 'all') {
    items = items.filter(p => brandFromProduct(p) === GIFT_FILTER);
  }
  // Text search
  if (SHOP_SEARCH) {
    items = items.filter(p => `${p.name}`.toLowerCase().includes(SHOP_SEARCH));
  }
  // Prefetch review stats if sorting by reviews
  if (SHOP_SORT === 'reviews') {
    await Promise.all(items.map(p => getReviewStats(p.id)));
  }
  // Sorting
  if (SHOP_SORT === 'price_asc') items = items.slice().sort((a,b)=>a.price-b.price);
  if (SHOP_SORT === 'price_desc') items = items.slice().sort((a,b)=>b.price-a.price);
  if (SHOP_SORT === 'discount') items = items.slice().sort((a,b)=>{
    const oa = getOldPrice(a); const ob = getOldPrice(b);
    const da = (oa ? oa - a.price : 0);
    const db = (ob ? ob - b.price : 0);
    return db - da;
  });
  if (SHOP_SORT === 'reviews') items = items.slice().sort((a,b)=>{
    const sa = REVIEW_STATS.get(a.id) || { avg:0, count:0 };
    const sb = REVIEW_STATS.get(b.id) || { avg:0, count:0 };
    return (sb.count - sa.count) || (sb.avg - sa.avg);
  });
  grid.innerHTML = items.map(p => productCard(p, favs)).join('');
  // Initialize interactive effects for freshly rendered cards
  try { setupCardTilt(grid); } catch(_) {}
  // hydrate rating placeholders
  try {
    await Promise.all(items.map(p => getReviewStats(p.id)));
    items.forEach(p => {
      const stats = REVIEW_STATS.get(p.id);
      const el = document.querySelector(`[data-rating="${CSS.escape(p.id)}"]`);
      if (el) el.textContent = (stats && stats.count) ? `⭐ ${stats.avg.toFixed(1)} (${stats.count})` : '';
      // Reveal Best Seller badge if product qualifies
      const best = document.querySelector(`[data-id="${CSS.escape(p.id)}"] .badge.best`);
      if (best && stats) {
        const qualifies = (stats.count >= 40 && stats.avg >= 4.5) || stats.count >= 100;
        if (qualifies) best.hidden = false;
      }
    });
  } catch(_) {}
}
async function renderOffers() {
  const grid = $('#offersGrid');
  const favs = new Set(await favsDB());
  grid.innerHTML = OFFERS.map(p => offerCard(p, favs)).join('');
  try { setupCardTilt(grid); } catch(_) {}
}
async function renderFavs() {
  const favIds = new Set(await favsDB());
  const items = [...PRODUCTS, ...OFFERS].filter(p => favIds.has(p.id));
  const grid = $('#favGrid');
  grid.innerHTML = items.length ? items.map(p => (p.old ? offerCard(p, favIds) : productCard(p, favIds))).join('') : '<p class="muted">Nessun preferito al momento.</p>';
  try { setupCardTilt(grid); } catch(_) {}
}
async function renderFavsIconStates() {
  const favs = await favsDB();
  $$('[data-fav]').forEach(btn => {
    const id = btn.getAttribute('data-fav');
    const isFav = favs.includes(id);
    btn.textContent = isFav ? '❤️' : '🤍';
  });

  // Account: save profile
  const accSaveProfile = document.getElementById('accSaveProfile');
  if (accSaveProfile) accSaveProfile.addEventListener('click', async () => {
    const s = await getSettings();
    const name = ($('#accName')?.value || '').trim();
    const phone = ($('#accPhone')?.value || '').trim();
    await setSettings({ ...s, name, phone });
    showToast('Profilo aggiornato', 'success');
  });
  // Account: save preferences/addresses
  const accSavePrefs = document.getElementById('accSavePrefs');
  if (accSavePrefs) accSavePrefs.addEventListener('click', async () => {
    const address = ($('#accShipAddr')?.value || '').trim();
    const billingName = ($('#accBillName')?.value || '').trim();
    const billingAddress = ($('#accBillAddr')?.value || '').trim();
    const billingTax = ($('#accBillTax')?.value || '').trim();
    const emailNotifs = !!$('#accNewsletter')?.checked;
    await setSettings({ address, billingName, billingAddress, billingTax, emailNotifs });
    showToast('Impostazioni salvate', 'success');
  });
  // Account: export data
  const accExport = document.getElementById('accExportData');
  if (accExport) accExport.addEventListener('click', async () => {
    const data = {
      settings: await getSettings(),
      orders: readLS('iany_orders', []),
      cart: await cartDB(),
      favorites: await favsDB()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iany_data_export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

}

// Render: Cart sidebar
async function renderCart() {
  const wrap = $('#cartItems');
  const cart = await cartDB();
  const allP = [...PRODUCTS, ...OFFERS];
  const ids = Object.keys(cart);
  if (!ids.length) {
    wrap.innerHTML = '<p class="muted">Il carrello è vuoto.</p>';
  } else {
    wrap.innerHTML = ids.map(id => {
      const p = allP.find(x => x.id === id) || {};
      const qty = cart[id];
      const price = Number(p.price || 0);
      const old = Number(p.old || 0);
      const hasOld = old && old > price;
      const line = price * qty;
      return `
        <div class="cart-item" data-id="${id}">
          <div class="ci-thumb"><img src="${p.img || ''}" alt="${p.name || ''}"></div>
          <div class="ci-info">
            <div class="ci-title">${p.name || 'Prodotto'}</div>
            <div class="ci-meta">
              <span class="now">${formatEUR(price)}</span>
              ${hasOld ? `<span class="old">${formatEUR(old)}</span>` : ''}
            </div>
            <div class="qty" role="group" aria-label="Quantità">
              <button data-dec="${id}">−</button>
              <span>${qty}</span>
              <button data-inc="${id}">+</button>
            </div>
          </div>
          <div class="ci-actions">
            <div class="ci-line-total">${formatEUR(line)}</div>
            <button class="as-link" data-remove="${id}">Rimuovi</button>
          </div>
        </div>`;
    }).join('');
  }
  // Breakdown
  const subtotal = ids.reduce((acc, id) => {
    const p = allP.find(x => x.id === id) || {}; return acc + (Number(p.price||0) * Number(cart[id]||0));
  }, 0);
  const savings = ids.reduce((acc, id) => {
    const p = allP.find(x => x.id === id) || {}; const price = Number(p.price||0), old = Number(p.old||0), q = Number(cart[id]||0);
    return acc + (old > price ? (old - price) * q : 0);
  }, 0);
  const breakdown = $('#cartBreakdown');
  if (breakdown) {
    breakdown.innerHTML = `
      <div class="cart-breakdown">
        <div class="row"><span>Subtotale</span><strong>${formatEUR(subtotal)}</strong></div>
        ${savings > 0 ? `<div class="row savings"><span>Risparmi</span><strong>− ${formatEUR(savings)}</strong></div>` : ''}
      </div>`;
  }
  $('#cartTotal').textContent = formatEUR(await cartTotal());
  // Update free shipping progress (if container exists)
  try { await updateFreeShipProgress('#cartProgress'); } catch(_) {}
}
async function renderCartBadge() { $('#cartCount').textContent = await cartCount(); }

// Checkout state & helpers
// Supabase-backed coupons
async function getCouponUsage() {
  // Returns a map { CODE: count } for the authenticated user via Supabase
  try {
    if (!(supaReady && supaReady())) return {};
    const u = await sbCurrentUser();
    if (!u?.id) return {};
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .select('code')
      .eq('user_id', u.id);
    if (error) throw error;
    const usage = {};
    for (const r of (data || [])) {
      const k = String(r.code || '').toUpperCase();
      usage[k] = (usage[k] || 0) + 1;
    }
    return usage;
  } catch (_) { return {}; }
}
async function incCouponUsage(code, orderId) {
  // Insert redemption row in Supabase (idempotent thanks to unique(user_id,code))
  try {
    if (!(supaReady && supaReady())) return;
    const u = await sbCurrentUser();
    if (!u?.id) return;
    const payload = { user_id: u.id, code: String(code || '').toUpperCase(), redeemed_at: new Date().toISOString() };
    if (orderId) payload.order_id = orderId;
    const { error } = await supabase.from('coupon_redemptions').insert(payload);
    // ignore unique violation silently (already redeemed)
    if (error && !String(error.message||'').toLowerCase().includes('duplicate')) {
      console.warn('[coupon] redemption insert failed', error);
    }
  } catch (e) {
    console.warn('[coupon] redemption error', e);
  }
}
async function getAppliedCoupon() {
  const s = await getSettings();
  return s.appliedCoupon || null;
}
async function setAppliedCoupon(code) {
  const s = await getSettings();
  s.appliedCoupon = code || '';
  await setSettings(s);
}
async function validateCoupon(code) {
  if (!code) return { ok: false, reason: 'Nessun codice' };
  if (!(supaReady && supaReady())) return { ok: false, reason: 'Servizio coupon non disponibile' };
  const u = await sbCurrentUser();
  if (!u?.id) return { ok: false, reason: 'Accedi per usare i codici sconto' };
  const c = String(code).trim().toUpperCase();
  // Fetch definition
  try {
    const { data: rows, error } = await supabase
      .from('coupons')
      .select('code, type, value, active, expires_at')
      .eq('code', c)
      .eq('active', true)
      .limit(1);
    if (error) throw error;
    const defRow = (rows && rows[0]) || null;
    if (!defRow) return { ok: false, reason: 'Codice non valido' };
    if (defRow.expires_at && new Date(defRow.expires_at) < new Date()) {
      return { ok: false, reason: 'Codice scaduto' };
    }
    // One-time per account check
    const { count, error: err2 } = await supabase
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .eq('code', c);
    if (err2) throw err2;
    if ((count || 0) > 0) return { ok: false, reason: 'Codice già usato' };
    // Build def compatible with pricing logic
    const def = { type: defRow.type, value: Number(defRow.value) || 0 };
    return { ok: true, def };
  } catch (e) {
    console.warn('[coupon] validate error', e);
    return { ok: false, reason: 'Errore validazione coupon' };
  }
}
async function getShipMethod() {
  const s = await getSettings();
  return s.shipMethod || 'standard';
}
async function setShipMethod(method) {
  const s = await getSettings();
  s.shipMethod = method || 'standard';
  await setSettings(s);
}
async function computeTotals() {
  const subtotal = await cartTotal();
  const sel = document.getElementById('coShip');
  const fallback = await getShipMethod();
  const shipMethod = sel?.value || fallback || 'standard';
  let shipping = 0;
  if (subtotal > 0) {
    shipping = shipMethod === 'express' ? 9.99 : 4.99;
    if (subtotal >= 59) shipping = 0; // free over threshold (default €59)
    // If cart is only digital gift cards, shipping is always free
    try {
      const cart = await cartDB();
      const ids = Object.keys(cart);
      if (ids.length) {
        const productMap = new Map(PRODUCTS.map(p => [p.id, p]));
        const allDigitalGifts = ids.every(id => (productMap.get(id)?.tag === 'console'));
        if (allDigitalGifts) shipping = 0;
      }
    } catch (_) {}
  }
  const code = await getAppliedCoupon();
  let def = null;
  if (code) {
    const v = await validateCoupon(code);
    if (v.ok) def = v.def; // apply only if valid for this user
  }
  let discount = 0;
  if (def) {
    if (def.type === 'percent') discount = Math.min(subtotal * (def.value/100), subtotal);
    if (def.type === 'fixed') discount = Math.min(def.value, subtotal);
    if (def.type === 'ship') shipping = 0;
  }
  const total = Math.max(0, subtotal - discount) + shipping;
  return { subtotal, shipping, discount, total, code: code || '' };
}
async function renderCheckout() {
  const wrap = $('#coItems');
  const cart = await cartDB();
  const ids = Object.keys(cart);
  const allP = [...PRODUCTS, ...OFFERS];
  if (!ids.length) {
    wrap.innerHTML = '<p class="muted">Il carrello è vuoto.</p>';
  } else {
    wrap.innerHTML = ids.map(id => {
      const p = allP.find(x => x.id === id);
      const qty = cart[id];
      const line = (p?.price || 0) * qty;
      return `<div class="co-item"><div class="co-item-main"><img src="${p?.img || ''}" alt="${p?.name || ''}"><div><div class="co-title">${p?.name || 'Prodotto'}</div><div class="muted">${formatEUR(p?.price || 0)} × ${qty}</div></div></div><div class="co-line">${formatEUR(line)}</div></div>`;
    }).join('');
  }
  const t = await computeTotals();
  $('#coSubtotal').textContent = formatEUR(t.subtotal);
  $('#coShipping').textContent = formatEUR(t.shipping);
  $('#coTotal').textContent = formatEUR(t.total);
  const discRow = $('#coDiscountRow');
  if (t.discount > 0) {
    discRow.classList.remove('hide');
    $('#coDiscount').textContent = `−${formatEUR(t.discount)}`;
  } else {
    discRow.classList.add('hide');
  }
  try { await updateFreeShipProgress('#coProgress'); } catch(_) {}
  // Prefill from settings
  const s = await getSettings();
  if (s?.address) $('#coAddress').value = s.address;
  // Prefill name/email from account if logged in and hide fields
  try {
    const emailFromSession = (getSessionUser()?.email || '').trim();
    const loggedIn = !!emailFromSession;
    const prof = readProfile();
    const nameFromAcc = (s?.name || prof?.name || '').trim();
    const emailFromAcc = emailFromSession || (prof?.email || '').trim();
    const nameInput = document.getElementById('coName');
    const emailInput = document.getElementById('coEmail');
    const nameRow = nameInput?.closest('.form-row');
    const emailRow = emailInput?.closest('.form-row');
    if (loggedIn) {
      if (nameInput) { nameInput.value = nameFromAcc; nameInput.setAttribute('disabled','true'); }
      if (emailInput) { emailInput.value = emailFromAcc; emailInput.setAttribute('disabled','true'); }
      nameRow?.classList.add('hide');
      emailRow?.classList.add('hide');
    } else {
      // Ensure visible/editable for guests
      nameInput?.removeAttribute('disabled');
      emailInput?.removeAttribute('disabled');
      nameRow?.classList.remove('hide');
      emailRow?.classList.remove('hide');
    }
  } catch(_) {}
  // No account: do not prefill email from session
  // Pre-fill coupon field
  $('#couponCode').value = (await getAppliedCoupon()) || '';
  // Coupon UI state: require login to use coupons
  try {
    const loggedIn = !!(getSessionUser()?.email);
    const codeInput = document.getElementById('couponCode');
    const form = document.getElementById('couponForm');
    const applyBtn = form?.querySelector("button[type='submit']");
    const msg = document.getElementById('couponMsg');
    if (!loggedIn) {
      // Disable and hint
      codeInput?.setAttribute('disabled', 'true');
      applyBtn?.setAttribute('disabled', 'true');
      if (msg) msg.textContent = 'Accedi per usare i codici sconto';
    } else {
      codeInput?.removeAttribute('disabled');
      applyBtn?.removeAttribute('disabled');
      if (msg && (!msg.textContent || msg.textContent === 'Accedi per usare i codici sconto')) msg.textContent = '';
    }
  } catch(_) {}
  // Ensure listeners for dynamic elements
  const shipSel = $('#coShip');
  const savedShip = await getShipMethod();
  if (shipSel && shipSel.value !== savedShip) shipSel.value = savedShip;
  shipSel.addEventListener('change', async (e) => { await setShipMethod(e.currentTarget.value); await renderCheckout(); });
  // If cart is only digital gift cards, hide shipping selector
  try {
    const c = await cartDB();
    const ids2 = Object.keys(c);
    const productMap2 = new Map(PRODUCTS.map(p => [p.id, p]));
    const allDigitalGifts = ids2.length > 0 && ids2.every(id => (productMap2.get(id)?.tag === 'console'));
    const shipRow = shipSel?.closest('.form-row');
    if (shipRow) shipRow.classList.toggle('hide', !!allDigitalGifts);
  } catch(_) {}
  $('#coBillingDiff').addEventListener('change', (e) => {
    $('#billingFields').classList.toggle('hide', !e.currentTarget.checked);
  });
  // Prefill billing if previously saved
  if (s?.billingAddress || s?.billingName || s?.billingTax) {
    $('#coBillingDiff').checked = true;
    $('#billingFields').classList.remove('hide');
    if (s.billingName) $('#billName').value = s.billingName;
    if (s.billingAddress) $('#billAddress').value = s.billingAddress;
    if (s.billingTax) $('#billTax').value = s.billingTax;
  }
}

// UI: Sidebar & overlay
function openCart() { $('#cartSidebar').classList.add('show'); $('#overlay').classList.add('show'); }
function closeCart() { $('#cartSidebar').classList.remove('show'); $('#overlay').classList.remove('show'); }

// Handle product detail button clicks
document.addEventListener('click', (e) => {
  const detailBtn = e.target.closest('[data-detail]');
  if (detailBtn) {
    e.preventDefault();
    const productId = detailBtn.getAttribute('data-detail');
    openProductModal(productId);
  }
});

// Also open modal when clicking the product image or title
document.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;
  const hit = e.target.closest('.product-media, .product-title');
  if (hit) {
    e.preventDefault();
    const id = card.getAttribute('data-id');
    if (id) openProductModal(id);
  }
});

// UI: Profile dropdown
function toggleProfileDropdown(show) {
  const dd = $('#profileDropdown');
  const isOpen = show ?? !dd.classList.contains('show');
  if (isOpen) { $('#mobileDrawer').classList.remove('show'); }
  dd.classList.toggle('show', isOpen);
  $('#profileBtn').setAttribute('aria-expanded', String(isOpen));
}
async function renderUser() {
  // Prefer real Supabase session when available
  let email = '';
  try {
    const u = await currentUser();
    email = (u?.email || '').trim();
  } catch(_) {
    email = getSessionUser()?.email || '';
  }
  $('#userGreeting').textContent = email || 'Ospite';
  const accEmail = document.getElementById('accEmail');
  if (accEmail) accEmail.value = email || '';
  // Toggle dropdown items based on auth
  const dd = document.getElementById('profileDropdown');
  const isLogged = !!email;
  if (dd) {
    const btnLogin = dd.querySelector('[data-action="login"]');
    const btnRegister = dd.querySelector('[data-action="register"]');
    if (btnLogin) btnLogin.style.display = isLogged ? 'none' : 'block';
    if (btnRegister) btnRegister.style.display = isLogged ? 'none' : 'block';
  }
  // Mobile drawer
  const md = document.getElementById('mobileDrawer');
  if (md) {
    const mLogin = md.querySelector('[data-action="login"]');
    const mRegister = md.querySelector('[data-action="register"]');
    if (mLogin) mLogin.style.display = isLogged ? 'none' : 'inline-block';
    if (mRegister) mRegister.style.display = isLogged ? 'none' : 'inline-block';
  }
}

// Account page: render details & orders
async function renderAccount() {
  const s = await getSettings();
  const prof = readProfile();
  // Current values (settings as source of truth for text fields)
  const email = getSessionUser()?.email || prof.email || '';
  const name = s.name || prof.name || '';
  const phone = s.phone || prof.phone || '';
  const shipAddr = s.address || prof.ship_addr || '';
  const billName = s.billingName || prof.bill_name || '';
  const billAddr = s.billingAddress || prof.bill_addr || '';
  const billTax = s.billingTax || prof.bill_tax || '';
  const newsletter = !!(s.emailNotifs ?? prof.newsletter);
  $('#accEmail') && ($('#accEmail').value = email);
  $('#accName') && ($('#accName').value = name);
  $('#accPhone') && ($('#accPhone').value = phone);
  $('#accShipAddr') && ($('#accShipAddr').value = shipAddr);
  $('#accBillName') && ($('#accBillName').value = billName);
  $('#accBillAddr') && ($('#accBillAddr').value = billAddr);
  $('#accBillTax') && ($('#accBillTax').value = billTax);
  $('#accNewsletter') && ($('#accNewsletter').checked = newsletter);

  // Session UI (email + buttons visibility)
  const sesEmail = $('#accSessionEmail');
  if (sesEmail) sesEmail.textContent = email || 'Ospite';
  const btnSignIn = $('#accSignIn');
  const btnSwitch = $('#accSwitch');
  const btnLogout = $('#accLogout');
  const isLogged = !!email;
  btnSignIn && (btnSignIn.style.display = isLogged ? 'none' : 'inline-flex');
  btnSwitch && (btnSwitch.style.display = isLogged ? 'inline-flex' : 'none');
  btnLogout && (btnLogout.style.display = isLogged ? 'inline-flex' : 'none');

  // Avatar
  const avatarImg = $('#accAvatarImg');
  if (avatarImg) {
    const seed = (name || email || 'U');
    avatarImg.src = prof.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
  }

  // Logout
  const logoutBtn = $('#accLogout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      setSessionUser(null);
      try { renderUser(); } catch(_) {}
      navigate('#home');
      showToast?.('Sei uscito dall\'account', 'info');
    };
  }

  // Sign-in (add account)
  if (btnSignIn) {
    btnSignIn.onclick = async () => {
      // Open account auth modal (navbar dropdown remains unchanged)
      location.href = 'auth.html?mode=login';
    };
  }

  // Switch account: logout then prompt sign-in
  if (btnSwitch) {
    btnSwitch.onclick = async () => {
      await logoutAll();
      try { await renderUser(); } catch(_) {}
      // After sign-out, open modal to log into another account
      location.href = 'auth.html?mode=login';
    };
  }

  // Orders
  const orders = readLS('iany_orders', []).slice().reverse();
  const wrap = $('#accOrders');
  if (!wrap) return;
  if (!orders.length) {
    wrap.innerHTML = '<p class="muted">Nessun ordine effettuato al momento.</p>';
  } else {
    const allP = [...PRODUCTS, ...OFFERS];
    // Orders toolbar controls
    const searchEl = document.getElementById('ordersSearch');
    const sortEl = document.getElementById('ordersSort');

    // Read orders and apply filter/sort
    let list = Array.isArray(orders) ? [...orders] : [];
    const q = (searchEl?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(o => {
        const id = String(o.id || '').toLowerCase();
        const code = String(o.orderCode || '').toLowerCase();
        return id.includes(q) || code.includes(q);
      });
    }

    const sortVal = sortEl?.value || 'date_desc';
    const byDate = (o) => new Date(o.ts || o.id).getTime();
    const byTotal = (o) => Number(o?.totals?.total || 0);
    const byCount = (o) => Object.values(o.items || {}).reduce((a,b)=>a+Number(b||0),0);
    list.sort((a,b) => {
      switch (sortVal) {
        case 'date_asc': return byDate(a) - byDate(b);
        case 'total_desc': return byTotal(b) - byTotal(a);
        case 'total_asc': return byTotal(a) - byTotal(b);
        case 'items_desc': return byCount(b) - byCount(a);
        case 'items_asc': return byCount(a) - byCount(b);
        case 'date_desc':
        default: return byDate(b) - byDate(a);
      }
    });

    // Render list
    wrap.innerHTML = list.map(o => {
      const itemsCount = Object.values(o.items || {}).reduce((a,b)=>a+Number(b||0),0);
      const total = o?.totals?.total ?? 0;
      const date = new Date(o.ts || o.id).toLocaleString(APP_LOCALE);
      const code = o.orderCode ? ` · <span class="muted">${o.orderCode}</span>` : '';
      return `
        <div class="cart-item" data-oid="${o.id}">
          <div>
            <div><strong>Ordine #${o.id}</strong>${code}</div>
            <div class="muted">${date} • ${itemsCount} articoli</div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;">
            <div><strong>${formatEUR(Number(total))}</strong></div>
            <a href="#ordine-dettaglio" class="btn-link" data-order-detail="${o.id}">Dettagli</a>
          </div>
        </div>`;
    }).join('');

    // Bind once: search/sort events trigger rerender
    if (searchEl && !searchEl.__bound) {
      searchEl.addEventListener('input', () => { try { renderAccount(); } catch(_) {} });
      searchEl.__bound = true;
    }
    if (sortEl && !sortEl.__bound) {
      sortEl.addEventListener('change', () => { try { renderAccount(); } catch(_) {} });
      sortEl.__bound = true;
    }

    // Delegate click on details to set selected order before routing
    wrap.querySelectorAll('[data-order-detail]').forEach(a => {
      if (a.__bound) return;
      a.addEventListener('click', (e) => {
        const oid = e.currentTarget.getAttribute('data-order-detail');
        try { sessionStorage.setItem('iany.selected_order', String(oid)); } catch(_) {}
        // navigation via href hash proceeds normally
      });
      a.__bound = true;
    });
  }
}

// Settings: single source of truth via SETTINGS_KEY
function migrateOldSettingsToNewStore() {
  try {
    const legacy = readLS(LS_KEYS?.settings || 'iany_settings', null);
    const already = localStorage.getItem(SETTINGS_KEY);
    if (legacy && !already) {
      // Merge legacy fields into new schema without dropping defaults
      const cur = readSettings();
      const merged = { ...cur, ...legacy };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      // Optionally clean old key
      try { writeLS(LS_KEYS.settings, merged); } catch(_) {}
    }
  } catch(_) {}
}
async function getSettings() {
  // Expose a unified shape combining UI store and account prefs
  const s = readSettings();
  return {
    // Visual/UI
    theme: s.theme,
    currency: s.currency,
    // Legacy compatibility fields
    emailNotifs: !!s.emailNotifs,
    address: s.address || '',
    name: s.name || '',
    phone: s.phone || '',
    billingName: s.billingName || '',
    billingAddress: s.billingAddress || '',
    billingTax: s.billingTax || '',
    compact: s.density === 'compact',
    appliedCoupon: s.appliedCoupon || ''
  };
}
async function setSettings(next) {
  // Map legacy flags into the UI store and persist under SETTINGS_KEY
  const patch = { ...next };
  if (typeof next.compact === 'boolean') patch.density = next.compact ? 'compact' : 'comfortable';
  if (next.theme) patch.theme = next.theme;
  if (next.currency) patch.currency = next.currency;
  // Pass-through account prefs
  if ('emailNotifs' in next) patch.emailNotifs = !!next.emailNotifs;
  if ('address' in next) patch.address = next.address || '';
  if ('name' in next) patch.name = next.name || '';
  if ('phone' in next) patch.phone = next.phone || '';
  if ('billingName' in next) patch.billingName = next.billingName || '';
  if ('billingAddress' in next) patch.billingAddress = next.billingAddress || '';
  if ('billingTax' in next) patch.billingTax = next.billingTax || '';
  if ('appliedCoupon' in next) patch.appliedCoupon = next.appliedCoupon || '';
  const saved = writeSettings(patch);
  // Re-apply to DOM when visual prefs changed
  try { applySettingsFromStore(); } catch(_) {}
  return saved;
}
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
  }
}
function applyCompact(compact) {
  document.body.classList.toggle('compact', !!compact);
}
async function openSettings() {
  const s = await getSettings();
  $('#themeToggle').checked = s.theme === 'light';
  $('#emailNotifs').checked = !!s.emailNotifs;
  $('#addressField').value = s.address || '';
  // Prefill default shipping selection
  try {
    const shipSel = document.getElementById('settingsShip');
    if (shipSel) shipSel.value = await getShipMethod();
  } catch (_) {}
  // Extended settings
  // Language selector removed: force Italian, language selector removed
  const curSel = document.getElementById('currencySelect');
  if (curSel) curSel.value = s.currency || 'EUR';
  const compact = document.getElementById('compactToggle');
  if (compact) compact.checked = !!s.compact;
  $('#settingsModal').showModal();
}
function closeSettings() { $('#settingsModal').close(); }

// Auth UI helpers
// (Removed duplicate openAuth/closeAuth; initial implementation near top is authoritative)

// Contact form -> Supabase (fallback to LocalStorage)
async function saveContact(data) {
  const payload = {
    name: (data?.name || '').toString(),
    email: (data?.email || '').toString(),
    message: (data?.message || '').toString(),
    created_at: new Date().toISOString(),
  };
  if (supaReady()) {
    try {
      const { error } = await supabase.from('contact_messages').insert(payload);
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('[Supabase] saveContact failed, using LocalStorage fallback:', e);
    }
  }
  const list = readLS(LS_KEYS.contact, []);
  list.push({ ...payload, ts: Date.now() });
  writeLS(LS_KEYS.contact, list);
}

// UI Effects: 3D tilt for product/offer cards
function setupCardTilt(container = document) {
  const cards = container.querySelectorAll('.product-card');
  if (!cards.length) return;
  cards.forEach(card => {
    if (card.dataset.tilt === '1') return;
    card.dataset.tilt = '1';
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / (r.width / 2);
        const dy = (e.clientY - cy) / (r.height / 2);
        const max = 6;
        const rx = (+dy) * max;
        const ry = (-dx) * max;
        card.style.transform = `translateY(-4px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });
    };
    const onLeave = () => { card.style.transform = ''; };
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
    card.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove(t); }, { passive: true });
    card.addEventListener('touchend', onLeave);
  });
}

// Event Listeners
window.addEventListener('DOMContentLoaded', () => {
  // Init user (guest mode)
  (async () => { await renderUser(); })();
  // Year
  $('#year').textContent = new Date().getFullYear();

  // Initial renders
  (async () => { await renderCartBadge(); await renderUser(); })();
  // Wire chatbot widget
  initChatbot();

  // Routing
  navigate(location.hash || '#home');
  const onRouteChange = async () => {
    const h = location.hash || '#home';
    // Show the target route section first
    navigate(h);
    if (h === '#pay-card' || h === '#pay-amex' || h === '#pay-paypal') {
      await renderPaymentRoute(h);
    } else if (h === '#ordine-completato') {
      await renderOrderCompletedRoute();
    } else if (h === '#ordine-dettaglio') {
      await renderOrderDetailRoute();
    } else if (h === '#checkout') {
      try { await renderCheckout(); } catch(_) {}
    } else if (h === '#preferiti') {
      try { await renderFavs(); } catch(_) {}
    } else if (h === '#home' || h === '#shop') {
      try { await renderShop(); } catch(_) {}
      try { await renderOffers(); } catch(_) {}
    } else if (h === '#account') {
      try { await renderAccount(); } catch(_) {}
      // If a pending auth mode is set, open the auth dialog accordingly
      try {
        const mode = sessionStorage.getItem('iany.nextAuthMode');
        if (mode === 'login' || mode === 'register') {
          sessionStorage.removeItem('iany.nextAuthMode');
          location.href = `auth.html?mode=${mode}`;
        }
      } catch(_) {}
    }
  };
  window.addEventListener('hashchange', onRouteChange);
  // Run once on load for deep links
  onRouteChange();

  // Maintenance Popup
  const maintenancePopup = document.getElementById('maintenancePopup');
  const closeMaintenanceBtn = document.getElementById('closeMaintenance');
  
  // Check if maintenance mode is active (you can set this to false when maintenance is done)
  const isMaintenanceMode = true; // Set to false to disable maintenance mode
  
  // Show maintenance popup if in maintenance mode and not already shown in this session
  if (isMaintenanceMode && !sessionStorage.getItem('maintenanceShown')) {
    maintenancePopup.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scrolling when popup is open
    sessionStorage.setItem('maintenanceShown', 'true');
  }
  
  // Close button handler
  if (closeMaintenanceBtn) {
    closeMaintenanceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      maintenancePopup.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        maintenancePopup.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
      }, 300);
    });
  }

  // Nav link SPA behavior for mobile drawer
  $$('#mobileDrawer [data-link]').forEach(a => a.addEventListener('click', () => {
    $('#mobileDrawer').classList.remove('show');
  }));

  // Mobile menu
  $('#mobileMenuToggle').addEventListener('click', () => { $('#mobileDrawer').classList.add('show'); toggleProfileDropdown(false); });
  $('#overlay').addEventListener('click', () => { closeCart(); toggleProfileDropdown(false); });

  // ESC handler for overlays retained only for cart/profile dropdown handled elsewhere

  // Removed auth dialog resize recenter handler (no modal)

  // Close dropdown on scroll to avoid floating menu lingering
  window.addEventListener('scroll', () => toggleProfileDropdown(false), { passive: true });

  // Profile dropdown
  $('#profileBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleProfileDropdown(); });
  document.addEventListener('click', (e) => {
    if (!$('#profileDropdown').contains(e.target) && e.target !== $('#profileBtn')) toggleProfileDropdown(false);
  });
  // Open settings from dropdown or mobile drawer
  $$("[data-action='settings']").forEach(b => b.addEventListener('click', () => { toggleProfileDropdown(false); openSettings(); }));

  // Account navigation
  $$("[data-action='account']").forEach(b => b.addEventListener('click', () => { toggleProfileDropdown(false); location.hash = '#account'; }));
  // Login/Register open: navigate to Account and open desired mode
  $$("[data-action='login']").forEach(b => b.addEventListener('click', () => {
    toggleProfileDropdown(false);
    // Go directly to auth page in login mode
    location.href = 'auth.html?mode=login';
  }));
  $$("[data-action='register']").forEach(b => b.addEventListener('click', () => {
    toggleProfileDropdown(false);
    // Go directly to auth page in register mode
    location.href = 'auth.html?mode=register';
  }));
  // Logout
  $$("[data-action='logout']").forEach(b => b.addEventListener('click', async () => {
    toggleProfileDropdown(false);
    await logoutAll();
    showToast('Disconnesso');
    await renderUser();
    location.hash = '#home';
  }));
  // Account page logout
  const accLogout = document.getElementById('accLogout');
  if (accLogout) accLogout.addEventListener('click', async () => {
    await logoutAll();
    showToast('Disconnesso');
    await renderUser();
    location.hash = '#home';
  });
  // Account page switch (fallback binding in case renderAccount hasn't attached yet)
  const accSwitch = document.getElementById('accSwitch');
  if (accSwitch) accSwitch.addEventListener('click', async () => {
    await logoutAll();
    try { await renderUser(); } catch(_) {}
    location.href = 'auth.html?mode=login';
  });

  // Auth state changes handled locally. Render user on load/explicit actions.

  // Account page: clear favorites
  const accClearFavs = document.getElementById('accClearFavs');
  if (accClearFavs) accClearFavs.addEventListener('click', async () => {
    writeLS(LS_KEYS.favs, []);
    await renderFavsIconStates();
    await renderFavs(); // Re-render the favorites page if visible
    showToast('Preferiti svuotati', 'success');
  });

  // Settings modal events (guard if settings UI is not present)
  const closeSettingsBtn = document.getElementById('closeSettings');
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
  const settingsCancelBtn = document.getElementById('settingsCancel');
  if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', closeSettings);
  const settingsSaveBtn = document.getElementById('settingsSave');
  const settingsForm = settingsSaveBtn?.closest('form');
  if (settingsForm) settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const theme = $('#themeToggle').checked ? 'light' : 'dark';
    const emailNotifs = $('#emailNotifs').checked;
    const address = $('#addressField').value.trim();
    const language = 'it'; // force Italian, language selector removed
    const currency = ($('#currencySelect')?.value) || 'EUR';
    const compact = $('#compactToggle')?.checked || false;
    const next = { theme, emailNotifs, address, language, currency, compact };
    try {
      // Save general settings
      await setSettings(next);
      // Save shipping preference
      const shipSel = document.getElementById('settingsShip');
      if (shipSel) await setShipMethod(shipSel.value);
      // Apply UI prefs immediately
      applyTheme(theme);
      applyCompact(compact);
      // Update runtime locale/currency (force Italian)
      APP_LOCALE = 'it-IT';
      APP_CURRENCY = currency || 'EUR';
      applyLanguage('it');
      closeSettings();
      showToast('Impostazioni salvate', 'success');
      // Re-render current route minimal without navigation
      rerenderCurrentRoute();
    } catch (err) {
      console.error(err);
      showToast('Errore salvataggio impostazioni', 'error');
    }
  });
  // Removed auth-related buttons

  // Removed auth modals and handlers

  // Cart open/close
  $('#cartBtn').addEventListener('click', async () => { await renderCart(); openCart(); });
  $('#closeCart').addEventListener('click', closeCart);
  // Go to checkout
  $('#checkoutBtn').addEventListener('click', async () => {
    closeCart();
    if ((await cartCount()) === 0) { alert('Il carrello è vuoto.'); return; }
    location.hash = '#checkout';
  });

  // Navbar Favorites button: vai alla sezione preferiti
  $('#favBtn').addEventListener('click', () => {
    $('#mobileDrawer').classList.remove('show');
    if (location.hash !== '#preferiti') {
      location.hash = '#preferiti';
    } else {
      renderFavs();
    }
  });

  // Global delegation for product actions (robust to non-Element targets)
  document.addEventListener('click', async (e) => {
    const base = e.target;
    const root = base instanceof Element ? base : (base?.parentElement || document.body);
    const addId = root.closest('[data-add]')?.getAttribute?.('data-add');
    const favId = root.closest('[data-fav]')?.getAttribute?.('data-fav');
    const detId = root.closest('[data-detail]')?.getAttribute?.('data-detail');
    const cardEl = root.closest('.product-card');
    const cardId = cardEl?.getAttribute?.('data-id');
    const inc = root.closest('[data-inc]')?.getAttribute?.('data-inc');
    const dec = root.closest('[data-dec]')?.getAttribute?.('data-dec');
    const rem = root.closest('[data-remove]')?.getAttribute?.('data-remove');

    if (addId) { await addToCart(addId, 1); }
    if (favId) {
      await toggleFav(favId);
      await renderFavsIconStates();
      // Apri automaticamente la sezione Preferiti
      if (location.hash !== '#preferiti') {
        location.hash = '#preferiti';
      } else {
        await renderFavs();
      }
    }
    // Open product details via explicit button
    if (detId) {
      try { openProductModal(detId); } catch (err) { console.error('Errore apertura prodotto', err); showToast?.('Errore nell\'apertura del prodotto', 'error'); }
      return;
    }
    // Open product details when clicking a card (but not when pressing action buttons)
    if (cardId && !addId && !favId) {
      try {
        openProductModal(cardId);
      } catch (err) {
        console.error('Errore apertura prodotto', err);
        showToast?.('Errore nell\'apertura del prodotto', 'error');
      }
    }
    if (inc) { const cart = await cartDB(); await setQty(inc, (cart[inc] || 0) + 1); }
    if (dec) { const cart = await cartDB(); await setQty(dec, (cart[dec] || 0) - 1); }
    if (rem) { await removeFromCart(rem); }
  });

  // Contact form
  $('#contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    await saveContact(data);
    e.currentTarget.reset();
    $('#contactStatus').textContent = 'Messaggio inviato!';
    setTimeout(() => $('#contactStatus').textContent = '', 3000);
  });

  // Apply saved settings at startup (auto-detect system theme on first visit)
  (async () => {
    const s = await getSettings();
    let startTheme = s.theme;
    if (!startTheme) {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      startTheme = prefersLight ? 'light' : 'dark';
    }
    // Apply UI from settings
    APP_LOCALE = 'it-IT';
    APP_CURRENCY = s.currency || 'EUR';
    applyTheme(startTheme);
    applyLanguage('it');
    applyCompact(!!s.compact);
  })();

  // Product modal events
  $('#pmClose')?.addEventListener('click', closeProductModal);
  const pmDialog = document.getElementById('productModal');
  // Close on backdrop click
  if (pmDialog) {
    pmDialog.addEventListener('click', (e) => { if (e.target === pmDialog) closeProductModal(); });
  }
  // Close on Escape
  if (pmDialog) {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pmDialog.open) closeProductModal(); });
  }
  // Switch main image by thumb
  $('#pmThumbs')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idx]');
    if (!b) return;
    const idx = Number(b.getAttribute('data-idx'));
    const details = PRODUCT_DETAILS[CURRENT_PM_ID] || {};
    const item = getItemById(CURRENT_PM_ID);
    const imgs = (details.images && details.images.length ? details.images : [item?.img]).filter(Boolean);
    if (imgs[idx]) {
      $('#pmImgMain').src = imgs[idx];
      $$('#pmThumbs button').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
    }
  });
  // Add to cart from modal
  $('#pmAddBtn').addEventListener('click', async () => { if (CURRENT_PM_ID) await addToCart(CURRENT_PM_ID, 1); });
  // Toggle fav from modal
  $('#pmFavBtn').addEventListener('click', async () => {
    if (!CURRENT_PM_ID) return;
    await toggleFav(CURRENT_PM_ID);
    const isFav = (await favsDB()).includes(CURRENT_PM_ID);
    $('#pmFavBtn').textContent = isFav ? '❤️' : '🤍';
    await renderFavsIconStates();
  });

  // Coupon apply
  $('#couponForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Require login
    const eSess = (getSessionUser()?.email || '').trim();
    if (!eSess) { $('#couponMsg').textContent = 'Devi accedere per usare un codice sconto.'; location.href = 'auth.html?mode=login'; return; }
    const code = ($('#couponCode').value || '').trim().toUpperCase();
    if (!code) { await setAppliedCoupon(null); $('#couponMsg').textContent = 'Codice rimosso'; await renderCheckout(); return; }
    const v = await validateCoupon(code);
    if (!v.ok) { $('#couponMsg').textContent = v.reason; return; }
    await setAppliedCoupon(code);
    $('#couponMsg').textContent = `Codice applicato: ${code}`;
    await renderCheckout();
  });

  // Live: show if code is already used by this account while typing
  const couponCodeEl = document.getElementById('couponCode');
  if (couponCodeEl) {
    let couponTypeTimer;
    couponCodeEl.addEventListener('input', async () => {
      clearTimeout(couponTypeTimer);
      const el = couponCodeEl;
      const val = (el.value || '').trim().toUpperCase();
      const msg = document.getElementById('couponMsg');
      couponTypeTimer = setTimeout(async () => {
        if (!val) { if (msg) msg.textContent = ''; el.classList.remove('invalid'); return; }
        const eSess = (getSessionUser()?.email || '').trim();
        if (!eSess) { if (msg) msg.textContent = 'Accedi per usare i codici sconto'; el.classList.add('invalid'); return; }
        const usage = await getCouponUsage();
        const used = usage[val] || 0;
        if (used >= 1) { if (msg) msg.textContent = 'Codice già usato su questo account'; el.classList.add('invalid'); }
        else { if (msg && msg.textContent === 'Codice già usato su questo account') msg.textContent = ''; el.classList.remove('invalid'); }
      }, 250);
    });
  }

  // Checkout submit -> create pending order and redirect to chosen payment page
  $('#paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ((await cartCount()) === 0) { alert('Il carrello è vuoto.'); return; }
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('coName') || $('#coName')?.value || '').toString().trim();
    const email = (fd.get('coEmail') || $('#coEmail')?.value || '').toString().trim();
    const address = (fd.get('coAddress') || $('#coAddress')?.value || '').toString().trim();
    const terms = $('#coTerms')?.checked;
    if (!terms) { $('#paymentMsg').textContent = 'Devi accettare i termini e condizioni.'; return; }
    if (!name || !email || !address) { $('#paymentMsg').textContent = 'Compila tutti i campi richiesti.'; return; }
    const payMethod = ($("input[name='pay']:checked")?.value) || 'card';
    const shipMethod = $('#coShip')?.value || 'standard';
    const totals = await computeTotals();
    const pending = {
      id: Date.now(),
      items: await cartDB(),
      totals,
      ts: new Date().toISOString(),
      name, email, address,
      billing: $('#coBillingDiff')?.checked ? {
        name: ($('#billName')?.value || '').trim(),
        address: ($('#billAddress')?.value || '').trim(),
        tax: ($('#billTax')?.value || '').trim(),
      } : null,
      payMethod,
      shipMethod,
      coupon: (await getAppliedCoupon()) || null,
    };
    writeLS(LS_KEYS.pending_order, pending);
    // Go to the dedicated payment page
    if (payMethod === 'paypal') location.hash = '#pay-paypal';
    else if (payMethod === 'amex') location.hash = '#pay-amex';
    else location.hash = '#pay-card';
  });
});

// Orders -> Supabase (fallback to LocalStorage)
async function placeOrder(order) {
  const toSave = { ...order };
  let serverOrderId = null;
  if (supaReady()) {
    try {
      // Flatten items/totals for storage while keeping JSON columns if your table supports it
      const row = {
        id_client: String(order.id),
        order_code: String(order.orderCode || ''),
        email: String(order.email || ''),
        name: String(order.name || ''),
        address: String(order.address || ''),
        billing: order.billing || null,
        items: order.items || {},
        totals: order.totals || {},
        pay_method: String(order.payMethod || ''),
        ship_method: String(order.shipMethod || ''),
        coupon: order.coupon || null,
        pay_result: order.payResult || null,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('orders')
        .insert(row)
        .select('id')
        .single();
      if (error) throw error;
      serverOrderId = data?.id || null;
      toSave.serverId = serverOrderId;
    } catch (e) {
      console.warn('[Supabase] placeOrder failed, using LocalStorage fallback:', e);
    }
  }
  // Always keep a local copy for UI continuity
  writeLS(LS_KEYS.last_order, toSave);
  const orders = readLS('iany_orders', []);
  orders.push(toSave);
  writeLS('iany_orders', orders);
  return serverOrderId;
}

// ---- Payment route handlers & order finalization ----
async function renderPaymentRoute(hash) {
  const pending = readLS(LS_KEYS.pending_order, null);
  const totals = pending?.totals || (await computeTotals());
  // Fill amounts
  try { const el = document.getElementById('cardAmount'); if (el) el.textContent = formatEUR(Number(totals.total||0)); } catch(_) {}
  try { const el = document.getElementById('amexAmount'); if (el) el.textContent = formatEUR(Number(totals.total||0)); } catch(_) {}
  try { const el = document.getElementById('ppAmount'); if (el) el.textContent = formatEUR(Number(totals.total||0)); } catch(_) {}

  // Attach submit handlers once
  const once = (el, type, handler) => { if (!el) return; const key = '__bound_'+type; if (el[key]) return; el.addEventListener(type, handler); el[key] = true; };

  once(document.getElementById('cardPayForm'), 'submit', async (e) => {
    e.preventDefault();
    await finalizeOrderFromPending({ gateway: 'card', ok: true });
  });
  once(document.getElementById('amexPayForm'), 'submit', async (e) => {
    e.preventDefault();
    await finalizeOrderFromPending({ gateway: 'amex', ok: true });
  });
  once(document.getElementById('paypalPayForm'), 'submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ppMsg'); if (msg) msg.textContent = 'Reindirizzamento a PayPal sandbox...';
    setTimeout(async () => { await finalizeOrderFromPending({ gateway: 'paypal', ok: true }); }, 900);
  });
}

async function finalizeOrderFromPending(result) {
  const pending = readLS(LS_KEYS.pending_order, null);
  if (!pending) { showToast('Sessione pagamento scaduta', 'error'); location.hash = '#checkout'; return; }
  // Create human-friendly order code (prefix + last 8 digits of epoch id)
  const orderCode = 'IANY-' + String(pending.id).slice(-8).padStart(8,'0');
  const order = { ...pending, payResult: result, orderCode };
  // Persist addresses into settings
  try {
    const cur = await getSettings();
    const next = { ...cur, address: pending.address };
    if (pending.billing) {
      next.billingName = pending.billing.name || '';
      next.billingAddress = pending.billing.address || '';
      next.billingTax = pending.billing.tax || '';
    } else {
      next.billingName = '';
      next.billingAddress = '';
      next.billingTax = '';
    }
    await setSettings(next);
  } catch(_) {}
  // Persist order
  const orderId = await placeOrder(order);
  // Count coupon usage on success, link to order if available
  if (order.coupon) { try { await incCouponUsage(order.coupon, orderId || undefined); } catch(_) {} }
  // Clear cart, coupon, pending
  writeLS(LS_KEYS.cart, {});
  await setAppliedCoupon(null);
  writeLS(LS_KEYS.pending_order, null);
  await renderCartBadge();
  // Go to order complete
  location.hash = '#ordine-completato';
}

async function renderOrderCompletedRoute() {
  const o = readLS(LS_KEYS.last_order, null);
  if (!o) return;
  // Fill summary
  const t = o.totals || { subtotal:0, shipping:0, discount:0, total:0 };
  const ocId = document.getElementById('ocId'); if (ocId) ocId.textContent = String(o.orderCode || o.id);
  const ocSubtotal = document.getElementById('ocSubtotal'); if (ocSubtotal) ocSubtotal.textContent = formatEUR(Number(t.subtotal||0));
  const ocShipping = document.getElementById('ocShipping'); if (ocShipping) ocShipping.textContent = formatEUR(Number(t.shipping||0));
  const ocDiscount = document.getElementById('ocDiscount'); const ocDiscountRow = document.getElementById('ocDiscountRow');
  if (Number(t.discount||0) > 0) { if (ocDiscountRow) ocDiscountRow.classList.remove('hide'); if (ocDiscount) ocDiscount.textContent = '−'+formatEUR(Number(t.discount||0)); }
  const ocTotal = document.getElementById('ocTotal'); if (ocTotal) ocTotal.textContent = formatEUR(Number(t.total||0));
  // Items
  const wrap = document.getElementById('ocItems');
  if (wrap) {
    const all = [...PRODUCTS, ...OFFERS];
    const ids = Object.keys(o.items||{});
    wrap.innerHTML = ids.map(id => {
      const p = all.find(x=>x.id===id) || {}; const qty = o.items[id]; const line = (p.price||0)*qty;
      return `<div class="co-item"><div class="co-item-main"><img src="${p.img||''}" alt="${p.name||''}" loading="lazy" decoding="async"><div><div class="co-title">${p.name||id}</div><div class="muted">${formatEUR(p.price||0)} × ${qty}</div></div></div><div class="co-line">${formatEUR(line)}</div></div>`;
    }).join('');
  }
  // Tracking: show only if order has any non-gift item
  try {
    const productMap = new Map(PRODUCTS.map(p => [p.id, p]));
    const ids = Object.keys(o.items||{});
    const hasShippable = ids.some(id => (productMap.get(id)?.tag !== 'console'));
    const trackHost = document.getElementById('ocTracking');
    if (trackHost) {
      if (hasShippable) {
        const prog = mockTrackingProgress(o);
        trackHost.innerHTML = `
          <h3>Tracking spedizione</h3>
          <p class="muted">Stato: <strong>${prog.status}</strong></p>
          <p class="muted">Tracking: <strong>${prog.tracking}</strong></p>
          <div class="progress-wrap">${prog.bar}</div>
        `;
        trackHost.classList.remove('hide');
      } else {
        trackHost.innerHTML = '';
        trackHost.classList.add('hide');
      }
    }
  } catch(_) {}
}

async function renderOrderDetailRoute() {
  const form = document.getElementById('odLookupForm');
  const view = document.getElementById('odView');
  if (!form || !view) return;
  // Bind once
  if (!form.__bound_submit) {
    form.addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('odLookupId')?.value.trim(); loadOrderIntoView(id || null); });
    form.__bound_submit = true;
  }
  // If coming from account list, prefer selected order once
  let sel = null;
  try { sel = sessionStorage.getItem('iany.selected_order'); } catch(_) {}
  if (sel) {
    await loadOrderIntoView(sel);
    try { sessionStorage.removeItem('iany.selected_order'); } catch(_) {}
  } else {
    // Load last order by default
    await loadOrderIntoView(null);
  }
}

async function loadOrderIntoView(orderId) {
  const view = document.getElementById('odView'); if (!view) return;
  const orders = readLS('iany_orders', []);
  let order = null;
  if (orderId) order = orders.find(o => String(o.id) === String(orderId) || String(o.orderCode) === String(orderId));
  if (!order) order = readLS(LS_KEYS.last_order, null);
  if (!order) { view.innerHTML = '<p class="muted">Nessun ordine trovato.</p>'; return; }
  const t = order.totals || {};
  // Determine if tracking should be shown
  const productMap = new Map(PRODUCTS.map(p => [p.id, p]));
  const ids = Object.keys(order.items||{});
  const hasShippable = ids.some(id => (productMap.get(id)?.tag !== 'console'));
  const progress = hasShippable ? mockTrackingProgress(order) : null;
  const itemsHtml = Object.entries(order.items||{}).map(([id,qty]) => {
    const p = getItemById(id) || { name: id, price: 0, img: '' };
    const line = (p.price||0) * Number(qty||0);
    return `<div class="co-item"><div class="co-item-main"><img src="${p.img||''}" alt="${p.name||''}" loading="lazy" decoding="async"><div><div class="co-title">${p.name}</div><div class="muted">${formatEUR(p.price||0)} × ${qty}</div></div></div><div class="co-line">${formatEUR(line)}</div></div>`;
  }).join('');
  const trackingHtml = hasShippable ? `
      <div class="checkout-payment">
        <h3>Tracking spedizione</h3>
        <p class="muted">Stato: <strong>${progress.status}</strong></p>
        <p class="muted">Tracking: <strong>${progress.tracking}</strong></p>
        <div class="progress-wrap">${progress.bar}</div>
        <a href="#home" class="btn">Torna alla Home</a>
      </div>` : `
      <div class="checkout-payment">
        <a href="#home" class="btn">Torna alla Home</a>
      </div>`;
  view.innerHTML = `
    <div class="checkout-grid">
      <div class="checkout-summary">
        <h3>Riepilogo ordine #${order.orderCode || order.id}</h3>
        <div class="co-items">${itemsHtml}</div>
        <div class="co-totals">
          <div class="row"><span>Subtotale</span><strong>${formatEUR(Number(t.subtotal||0))}</strong></div>
          <div class="row"><span>Spedizione</span><strong>${formatEUR(Number(t.shipping||0))}</strong></div>
          ${Number(t.discount||0)>0 ? `<div class=\"row\"><span>Sconto</span><strong>−${formatEUR(Number(t.discount||0))}</strong></div>` : ''}
          <div class="row grand"><span>Totale</span><strong>${formatEUR(Number(t.total||0))}</strong></div>
        </div>
      </div>
      ${trackingHtml}
    </div>`;
}

function mockTrackingProgress(order) {
  // Simple deterministic mock based on ID time
  const now = Date.now();
  const age = Math.max(0, now - Number(order.id||now));
  const steps = [ 'Ricevuto', 'In preparazione', 'Spedito', 'In consegna', 'Consegnato' ];
  const idx = Math.min(steps.length-1, Math.floor(age / (12*60*60*1000))); // advance every 12h
  const status = steps[idx];
  const pct = Math.round((idx / (steps.length-1)) * 100);
  const bar = `<div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>`;
  const tracking = 'IANY' + String(order.id).slice(-8).padStart(8,'0');
  return { status, tracking, bar };
}

// (Removed duplicate openProductModal override; the primary implementation above handles full content)

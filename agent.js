// ═══════════════════════════════════════════════════════════════
//  AGENT v2 — Veille emploi médico-social Arras
//  Améliorations : offres FT temps réel uniquement + liens
//  de recherche pré-paramétrés pour toutes les sources
// ═══════════════════════════════════════════════════════════════

// ── État global ───────────────────────────────────────────────
let oauthToken  = null;
let lastOffers  = [];
let activeFilters = { ft:true, fp:true, una:true, apei:true, cdg:true, fehap:true };

// ── Mots-clés par poste et secteur ───────────────────────────
const KW_POSTE = {
  directeur:   ['directeur médico-social', 'directrice adjointe'],
  chef:        ['chef de service', 'responsable de service'],
  coordo:      ['coordinateur projet social', 'coordinatrice médico-social'],
  responsable: ['responsable développement offre', 'responsable offre service'],
  charge:      ['chargé de mission social', 'conseiller territorial action sociale'],
  all:         ['cadre dirigeant médico-social', 'directeur chef de service'],
};

const KW_SECTEUR = {
  ms:   ['médico-social ESMS autonomie', 'association aide soins'],
  dom:  ['aide à domicile SAAD SAD services autonomie'],
  hand: ['handicap inclusion ESAT MAS FAM SAMSAH'],
  prev: ['prévention santé promotion santé IREPS'],
  ehp:  ['EHPAD résidence personnes âgées gériatrie'],
  col:  ['CCAS collectivité action sociale intercommunalité'],
};

// ── Liens de recherche pré-paramétrés par source ─────────────
// Chaque lien pointe sur une recherche active avec mots-clés
// et localisation déjà renseignés — l'utilisateur arrive
// directement sur les résultats filtrés.
const SOURCES_LIENS = {
  fp: {
    label: 'Place de l\'emploi public',
    desc:  'Fonction publique d\'État, territoriale, hospitalière',
    liens: [
      { txt: 'Chef de service médico-social', url: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=chef+de+service+m%C3%A9dico-social&localisation=62' },
      { txt: 'Directeur association sociale',  url: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=directeur+association+sociale&localisation=62' },
      { txt: 'Chargé de mission prévention santé', url: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=pr%C3%A9vention+sant%C3%A9&localisation=62' },
      { txt: 'Responsable développement social', url: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=responsable+d%C3%A9veloppement+social&localisation=62' },
    ]
  },
  una: {
    label: 'Réseau UNA',
    desc:  'Aide et soins à domicile — postes cadres',
    liens: [
      { txt: 'Offres cadres UNA nationales', url: 'https://www.una.fr/offres-d-emploi?type=cadre' },
      { txt: 'Recherche Indeed UNA Arras',   url: 'https://fr.indeed.com/jobs?q=chef+de+service+aide+domicile+UNA&l=Arras%2C+62&radius=40' },
      { txt: 'Recherche FT aide domicile',   url: 'https://candidat.francetravail.fr/offres/recherche?motsCles=chef+service+aide+domicile&lieux=62&rayonRecherche=40&typeContrat=CDI' },
    ]
  },
  apei: {
    label: 'UNAPEI / APEI',
    desc:  'Handicap — structures locales Pas-de-Calais',
    liens: [
      { txt: 'Offres UNAPEI nationales',         url: 'https://www.unapei.org/nos-offres-demploi/' },
      { txt: 'APEI Arras — site local',           url: 'https://www.apei-arras.fr' },
      { txt: 'Recherche FT handicap Arras',       url: 'https://candidat.francetravail.fr/offres/recherche?motsCles=chef+service+handicap&lieux=62&rayonRecherche=40&typeContrat=CDI' },
      { txt: 'Indeed cadre handicap Arras 40km',  url: 'https://fr.indeed.com/jobs?q=chef+de+service+handicap&l=Arras%2C+62&radius=40' },
    ]
  },
  cdg: {
    label: 'CDG62 — Collectivités',
    desc:  'Centre de gestion Pas-de-Calais — CCAS, mairies, interco',
    liens: [
      { txt: 'Toutes offres CDG62',             url: 'https://www.cdg62.fr/offres-demploi' },
      { txt: 'Directeur CCAS — CDG62',          url: 'https://www.cdg62.fr/offres-demploi?search=directeur+CCAS' },
      { txt: 'Responsable action sociale — CDG62', url: 'https://www.cdg62.fr/offres-demploi?search=action+sociale' },
      { txt: 'Place emploi public — FPT 62',    url: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=action+sociale&localisation=62&versant=FPT' },
    ]
  },
  fehap: {
    label: 'FEHAP / NEXEM',
    desc:  'Fédérations associatives médico-sociales',
    liens: [
      { txt: 'Offres NEXEM',                      url: 'https://www.nexem.fr/offres-emploi' },
      { txt: 'Indeed FEHAP Arras',                url: 'https://fr.indeed.com/jobs?q=chef+de+service+FEHAP&l=Arras%2C+62&radius=40' },
      { txt: 'Recherche FT convention FEHAP',     url: 'https://candidat.francetravail.fr/offres/recherche?motsCles=directeur+association+medico-sociale&lieux=62&rayonRecherche=40' },
    ]
  },
};

// ── Initialisation filtres ────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    const k = this.dataset.k;
    activeFilters[k] = !activeFilters[k];
    this.classList.toggle('on');
  });
});

// ── Navigation ────────────────────────────────────────────────
function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ── Statut ────────────────────────────────────────────────────
function setStatus(suffix, msg, state) {
  const dot  = document.getElementById('dot'   + suffix);
  const txt  = document.getElementById('stext' + suffix);
  const spin = document.getElementById('spin'  + suffix);
  if (!dot) return;
  dot.className = 'dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
  txt.textContent = msg;
  if (spin) spin.style.display = state === 'loading' ? 'inline-block' : 'none';
}

function showAlert(html, type) {
  const box = document.getElementById('alertBox');
  if (box) box.innerHTML = `<div class="alert ${type === 'warn' ? 'aw' : 'ai'}">${html}</div>`;
}

// ── OAuth France Travail ──────────────────────────────────────
async function getToken() {
  if (oauthToken && oauthToken.expires > Date.now()) return oauthToken.value;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CONFIG.FT_CLIENT_ID,
    client_secret: CONFIG.FT_CLIENT_SECRET,
    scope:         'o2dsoffre',
  });
  try {
    const r = await fetch(CONFIG.FT_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error('Token HTTP ' + r.status);
    const d = await r.json();
    oauthToken = { value: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return oauthToken.value;
  } catch (e) {
    console.error('Erreur token FT :', e);
    return null;
  }
}

// ── Score de compatibilité ────────────────────────────────────
function scoreMatch(text, poste, secteur) {
  if (!text) return 55;
  const t = text.toLowerCase();
  let s = 55;
  const kws = [
    ...(KW_POSTE[poste]    || KW_POSTE.chef),
    ...(KW_SECTEUR[secteur] || KW_SECTEUR.ms),
    'arras', 'arrageois', 'pas-de-calais', 'association', '62', 'autonomie', 'médico', 'social',
  ];
  kws.forEach(k => { if (t.includes(k.toLowerCase())) s += 7; });
  return Math.min(s, 99);
}

// ── Lancer la recherche ───────────────────────────────────────
async function lancerRecherche() {
  const poste   = document.getElementById('selPoste').value;
  const secteur = document.getElementById('selSecteur').value;

  setStatus('', 'Authentification OAuth France Travail en cours…', 'loading');
  document.getElementById('btnLancer').disabled = true;
  document.getElementById('alertBox').innerHTML = '';

  const token = await getToken();
  let ftOffers = [];

  if (token && activeFilters.ft) {
    setStatus('', 'Interrogation de l\'API France Travail — offres en temps réel…', 'loading');

    // Plusieurs requêtes avec des mots-clés variés pour maximiser les résultats
    const requetes = [
      (KW_POSTE[poste]    || KW_POSTE.chef)[0]    + ' ' + (KW_SECTEUR[secteur] || KW_SECTEUR.ms)[0],
      (KW_POSTE[poste]    || KW_POSTE.chef)[0],
      (KW_SECTEUR[secteur] || KW_SECTEUR.ms)[0],
    ];

    for (const mots of requetes) {
      try {
        const url = `${CONFIG.FT_API_URL}?motsCles=${encodeURIComponent(mots)}&commune=${CONFIG.COMMUNE_INSEE}&distance=${CONFIG.RAYON_KM}&nbResultats=${CONFIG.NB_RESULTATS}`;
        const r   = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
        if (r.ok) {
          const d = await r.json();
          const nouvelles = (d.resultats || [])
            .filter(o => !ftOffers.find(x => x.id === o.id)) // dédoublonnage
            .map(o => ({
              id:      o.id,
              titre:   o.intitule || 'Poste non renseigné',
              org:     o.entreprise?.nom || 'Non précisé',
              lieu:    o.lieuTravail?.libelle || 'Non précisé',
              contrat: o.typeContrat || '',
              date:    o.dateCreation?.substring(0, 10) || '',
              desc:    (o.description || '').substring(0, 280) + '…',
              salaire: o.salaire?.libelle || '',
              src:     'ft',
              // Lien direct vers l'annonce individuelle
              lien:    `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
              match:   scoreMatch(o.intitule + ' ' + (o.description || ''), poste, secteur),
            }));
          ftOffers = [...ftOffers, ...nouvelles];
        }
      } catch (e) { console.error('Erreur API FT :', e); }
    }
  }

  // Tri par score décroissant
  ftOffers.sort((a, b) => b.match - a.match);
  lastOffers = ftOffers;

  // Statistiques
  const cdi  = ftOffers.filter(o => (o.contrat || '').toUpperCase().includes('CDI')).length;
  const haut = ftOffers.filter(o => o.match >= 75).length;
  const srcs = Object.values(activeFilters).filter(Boolean).length;
  document.getElementById('stTotal').textContent = ftOffers.length;
  document.getElementById('stHaut').textContent  = haut;
  document.getElementById('stCDI').textContent   = cdi;
  document.getElementById('stSrc').textContent   = srcs;
  document.getElementById('statsRow').style.display = 'grid';

  if (ftOffers.length >= 1) {
    showAlert(
      `<i class="ti ti-check"></i> ${ftOffers.length} offre(s) réelle(s) chargée(s) depuis France Travail. Chaque lien pointe directement sur l'annonce officielle.`,
      'info'
    );
    renderOffers(ftOffers);
    setStatus('', `${ftOffers.length} offre(s) en temps réel · ${new Date().toLocaleString('fr-FR')}`, 'ok');
  } else {
    showAlert(
      `<i class="ti ti-info-circle"></i> Aucune offre France Travail trouvée pour ce périmètre exact. Utilisez les liens de recherche dans l'onglet "Sources" pour consulter directement chaque base.`,
      'warn'
    );
    renderOffers([]);
    setStatus('', 'Aucune offre FT — consultez les sources directes ci-dessous.', 'ok');
  }

  // Afficher automatiquement les sources si peu de résultats FT
  if (ftOffers.length < 3) renderSourcesPanel();

  document.getElementById('btnLancer').disabled = false;
}

// ── Affichage des offres France Travail ───────────────────────
function renderOffers(offers) {
  const c = document.getElementById('results');

  if (!offers.length) {
    c.innerHTML = `
      <div class="empty">
        <i class="ti ti-search-off"></i>
        <p>Aucune offre France Travail trouvée pour ces critères.</p>
        <p style="margin-top:8px">Consultez les <strong>liens de recherche directe</strong> dans l'onglet <strong>Sources</strong> pour accéder aux offres UNA, UNAPEI, CDG62 et FEHAP.</p>
      </div>`;
    return;
  }

  let html = `<div class="rh"><h2>Offres France Travail — temps réel</h2><span class="badge">${offers.length} offre${offers.length > 1 ? 's' : ''}</span></div>`;

  offers.forEach(o => {
    const hi = o.match >= 75;
    html += `
      <div class="card${hi ? ' hi' : ''}">
        <div class="ct">
          <span class="ctitle">${o.titre}</span>
          <span class="src src-ft">France Travail</span>
        </div>
        <div class="org">
          <i class="ti ti-building"></i> ${o.org}
          &nbsp;·&nbsp;
          <i class="ti ti-map-pin"></i> ${o.lieu}
        </div>
        <div class="metas">
          ${o.contrat ? `<span class="mt">${o.contrat}</span>` : ''}
          ${o.date    ? `<span class="mt">${o.date}</span>` : ''}
          ${o.salaire ? `<span class="mt"><i class="ti ti-currency-euro"></i> ${o.salaire}</span>` : ''}
          <span class="ms ${o.match >= 75 ? 'ms-h' : 'ms-m'}">Compatibilité ${Math.round(o.match)} %</span>
        </div>
        <div class="desc">${o.desc}</div>
        <a class="clink" href="${o.lien}" target="_blank" rel="noopener">
          <i class="ti ti-external-link"></i> Voir l'annonce officielle sur France Travail
        </a>
      </div>`;
  });

  // Rappel sources complémentaires
  html += `
    <div class="info-box" style="margin-top:1rem">
      <i class="ti ti-bulb" style="margin-right:6px"></i>
      <strong>Autres sources :</strong> consultez l'onglet <strong>Sources</strong> pour accéder aux recherches pré-paramétrées sur UNA, UNAPEI, CDG62, FEHAP et la Place de l'emploi public.
    </div>`;

  c.innerHTML = html;
}

// ── Rendu du panneau Sources avec liens actifs ────────────────
function renderSourcesPanel() {
  const poste   = document.getElementById('selPoste')?.value   || 'chef';
  const secteur = document.getElementById('selSecteur')?.value || 'ms';
  const motFT   = encodeURIComponent((KW_POSTE[poste] || KW_POSTE.chef)[0] + ' ' + (KW_SECTEUR[secteur] || KW_SECTEUR.ms)[0]);

  // Lien FT direct mis à jour avec les critères courants
  const lienFTDirect = `https://candidat.francetravail.fr/offres/recherche?motsCles=${motFT}&lieux=62&rayonRecherche=40&typeContrat=CDI,CDD`;

  const container = document.getElementById('sourcesContainer');
  if (!container) return;

  let html = `
    <div class="sc" style="border-left:3px solid var(--teal-brd)">
      <div class="sn"><i class="ti ti-building-community"></i> France Travail (API directe)</div>
      <div class="sd">Recherche avec vos critères actuels — résultats temps réel</div>
      <a class="sl" href="${lienFTDirect}" target="_blank" rel="noopener">
        Ouvrir la recherche filtrée <i class="ti ti-external-link"></i>
      </a>
    </div>`;

  // Sources complémentaires avec leurs liens multiples
  ['fp', 'una', 'apei', 'cdg', 'fehap'].forEach(key => {
    const src = SOURCES_LIENS[key];
    html += `
      <div class="sc">
        <div class="sn"><i class="ti ti-link"></i> ${src.label}</div>
        <div class="sd">${src.desc}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
          ${src.liens.map(l => `<a class="sl" href="${l.url}" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> ${l.txt}</a>`).join('')}
        </div>
      </div>`;
  });

  // Sources agrégateurs
  html += `
    <div class="sc">
      <div class="sn"><i class="ti ti-brand-linkedin"></i> LinkedIn Jobs</div>
      <div class="sd">Recherche filtrée secteur · Arras 40 km</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
        <a class="sl" href="https://www.linkedin.com/jobs/search/?keywords=chef+de+service+m%C3%A9dico-social&location=Arras%2C+Hauts-de-France&distance=40" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Chef de service médico-social</a>
        <a class="sl" href="https://www.linkedin.com/jobs/search/?keywords=directeur+association+m%C3%A9dico-sociale&location=Arras%2C+Hauts-de-France&distance=40" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Directeur association médico-sociale</a>
        <a class="sl" href="https://www.linkedin.com/jobs/search/?keywords=responsable+d%C3%A9veloppement+m%C3%A9dico-social&location=Arras%2C+Hauts-de-France&distance=40" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Responsable développement</a>
      </div>
    </div>
    <div class="sc">
      <div class="sn"><i class="ti ti-network"></i> Indeed</div>
      <div class="sd">Agrégateur multi-sources · Arras 40 km</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
        <a class="sl" href="https://fr.indeed.com/jobs?q=chef+de+service+medico+social&l=Arras%2C+62&radius=40&jt=fulltime" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Chef de service médico-social</a>
        <a class="sl" href="https://fr.indeed.com/jobs?q=directeur+adjoint+association&l=Arras%2C+62&radius=40&jt=fulltime" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Directeur adjoint association</a>
        <a class="sl" href="https://fr.indeed.com/jobs?q=charg%C3%A9+de+mission+pr%C3%A9vention+sant%C3%A9&l=Arras%2C+62&radius=40" target="_blank" rel="noopener"><i class="ti ti-external-link" style="font-size:10px"></i> Chargé de mission prévention santé</a>
      </div>
    </div>`;

  container.innerHTML = html;
}

// ── Export synthèse ───────────────────────────────────────────
function exportSynthese() {
  if (!lastOffers.length) { alert('Lancez d\'abord la veille pour charger des offres.'); return; }
  const lines = lastOffers.slice(0, 6).map((o, i) =>
    `${i + 1}. ${o.titre} — ${o.org} (${o.lieu}) — ${o.contrat} — Compatibilité : ${Math.round(o.match)} %`
  ).join('\n');
  const txt = `Sur la base des offres suivantes (rayon 40 km autour d'Arras) :\n\n${lines}\n\nGénère une synthèse stratégique : tendances du marché médico-social local, postes prioritaires, niveaux de rémunération (BAD/FEHAP/FPT), recommandations de démarche proactive et réseaux clés à activer dans le Pas-de-Calais.`;
  navigator.clipboard.writeText(txt).then(() => alert('Synthèse copiée — collez-la dans Claude.ai pour l\'analyse.'));
}

// ── Génération lettre via Claude API ─────────────────────────
async function genLettre() {
  const poste   = document.getElementById('lPoste').value   || 'Chef de service médico-social';
  const org     = document.getElementById('lOrg').value     || 'Association médico-sociale';
  const lieu    = document.getElementById('lLieu').value    || 'Arras (62)';
  const contrat = document.getElementById('lContrat').value;
  const notes   = document.getElementById('lNotes').value;
  const out     = document.getElementById('outLettre');

  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY === 'VOTRE_CLE_ANTHROPIC_ICI') {
    out.textContent = '⚠️ Clé API Anthropic non configurée. Ouvrez config.js et remplacez VOTRE_CLE_ANTHROPIC_ICI par votre clé (console.anthropic.com → API Keys).';
    return;
  }

  setStatus('2', 'Génération de la lettre en cours…', 'loading');
  document.getElementById('btnLettre').disabled = true;
  out.textContent = 'Génération en cours…';

  const prompt = `Rédige une lettre de motivation professionnelle, formelle et personnalisée pour le poste de "${poste}" (${contrat}) au sein de "${org}" à ${lieu}.

Profil du candidat : cadre dirigeant du secteur médico-social, ex-directeur d'UNARTOIS Aide et Soins (SAD mixte/SSIAD, Arrageois-Ternois), expertise en pilotage stratégique, développement de l'offre de services, gouvernance associative, management participatif de chefs de service, dialogue avec ARS/CD/CNSA, prévention et promotion de la santé, droit du travail et des associations, coordination territoriale (CPTS Grand Arras, partenariats institutionnels), habitat inclusif (Down Up).

Ancrage territorial : Arrageois-Ternois, Pas-de-Calais.
${notes ? `\nÉléments complémentaires à valoriser : ${notes}\n` : ''}
Ton : formel, précis, engagé. Structure : accroche sectorielle forte → adéquation profil/poste → valeur ajoutée apportée à la structure → conclusion motivée. Longueur : 400 à 500 mots.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });
    const d   = await r.json();
    const txt = d.content?.[0]?.text || 'Erreur : réponse inattendue.';
    out.textContent = txt;
    setStatus('2', 'Lettre générée avec succès.', 'ok');
  } catch (e) {
    out.textContent = 'Erreur : ' + e.message;
    setStatus('2', 'Erreur lors de la génération.', 'error');
  }
  document.getElementById('btnLettre').disabled = false;
}

// ── Génération CV via Claude API ──────────────────────────────
async function genCV() {
  const poste   = document.getElementById('cvPoste').value;
  const secteur = document.getElementById('cvSecteur').value;
  const conv    = document.getElementById('cvConv').value;
  const notes   = document.getElementById('cvNotes').value;
  const out     = document.getElementById('outCV');

  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY === 'VOTRE_CLE_ANTHROPIC_ICI') {
    out.textContent = '⚠️ Clé API Anthropic non configurée. Ouvrez config.js et renseignez votre clé.';
    return;
  }

  setStatus('3', 'Génération des recommandations CV en cours…', 'loading');
  document.getElementById('btnCV').disabled = true;
  out.textContent = 'Génération en cours…';

  const prompt = `Aide-moi à adapter mon CV pour le poste de "${poste}" dans le secteur "${secteur}" (convention : ${conv}) dans un rayon de 40 km autour d'Arras.

Mon profil : ex-directeur d'UNARTOIS Aide et Soins (groupe associatif SAD mixte/SSIAD), management de 7 chefs de service, gouvernance GCSMS, développement de l'offre (habitat inclusif, prévention, numérique), expertise CPOM/SERAFIN-PH/ARS/CD62, coordination CPTS Grand Arras, formation UNAFORM'ARTOIS, droit du travail et des associations.
${notes ? `\nCompétences à valoriser : ${notes}\n` : ''}
Fournis :
1. Structure de CV recommandée avec rubriques et ordre optimal
2. Formulations percutantes pour chaque section
3. Mots-clés ATS à intégrer pour ce secteur et cette convention
4. Points de différenciation à mettre en avant face à la concurrence`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    const d   = await r.json();
    const txt = d.content?.[0]?.text || 'Erreur : réponse inattendue.';
    out.textContent = txt;
    setStatus('3', 'Recommandations générées avec succès.', 'ok');
  } catch (e) {
    out.textContent = 'Erreur : ' + e.message;
    setStatus('3', 'Erreur lors de la génération.', 'error');
  }
  document.getElementById('btnCV').disabled = false;
}

// ── Utilitaires ───────────────────────────────────────────────
function copier(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent)
    .then(() => alert('Contenu copié dans le presse-papiers.'))
    .catch(() => alert('Sélectionnez le texte manuellement puis copiez-le.'));
}

function telecharger(id, nom) {
  const el = document.getElementById(id);
  if (!el) return;
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([el.textContent], { type: 'text/plain;charset=utf-8' }));
  a.download = nom;
  a.click();
}

// ── Initialisation du panneau Sources au chargement ───────────
document.addEventListener('DOMContentLoaded', renderSourcesPanel);

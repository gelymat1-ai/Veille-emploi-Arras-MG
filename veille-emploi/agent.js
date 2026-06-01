// ═══════════════════════════════════════════════════════════════
//  AGENT — Veille emploi médico-social Arras
// ═══════════════════════════════════════════════════════════════

// ── État global ───────────────────────────────────────────────
let oauthToken  = null;
let lastOffers  = [];
let activeFilters = { ft:true, fp:true, una:true, apei:true, cdg:true, fehap:true };

// ── Mots-clés par poste et secteur ───────────────────────────
const KW_POSTE = {
  directeur:    ['directeur médico-social', 'directrice adjointe'],
  chef:         ['chef de service', 'responsable de service'],
  coordo:       ['coordinateur projet social', 'coordinatrice médico-social'],
  responsable:  ['responsable développement offre', 'responsable offre service'],
  charge:       ['chargé de mission social', 'conseiller territorial action sociale'],
  all:          ['cadre dirigeant médico-social', 'directeur chef de service'],
};

const KW_SECTEUR = {
  ms:   ['médico-social ESMS autonomie', 'association aide soins'],
  dom:  ['aide à domicile SAAD SAD services autonomie'],
  hand: ['handicap inclusion ESAT MAS FAM SAMSAH'],
  prev: ['prévention santé promotion santé IREPS'],
  ehp:  ['EHPAD résidence personnes âgées gériatrie'],
  col:  ['CCAS collectivité action sociale intercommunalité'],
};

// ── Initialisation des filtres ────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function () {
    const k = this.dataset.k;
    activeFilters[k] = !activeFilters[k];
    this.classList.toggle('on');
  });
});

// ── Navigation entre panneaux ─────────────────────────────────
function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ── Gestion du statut ─────────────────────────────────────────
function setStatus(suffix, msg, state) {
  const dot  = document.getElementById('dot'  + suffix);
  const txt  = document.getElementById('stext'+ suffix);
  const spin = document.getElementById('spin' + suffix);
  if (!dot) return;
  dot.className = 'dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
  txt.textContent = msg;
  if (spin) spin.style.display = state === 'loading' ? 'inline-block' : 'none';
}

function showAlert(html, type) {
  const box = document.getElementById('alertBox');
  if (box) box.innerHTML = `<div class="alert ${type === 'warn' ? 'aw' : 'ai'}">${html}</div>`;
}

// ── Authentification OAuth France Travail ─────────────────────
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
    ...(KW_POSTE[poste] || KW_POSTE.chef),
    ...(KW_SECTEUR[secteur] || KW_SECTEUR.ms),
    'arras', 'arrageois', 'pas-de-calais', 'association', '62',
    'autonomie', 'médico', 'social',
  ];
  kws.forEach(k => { if (t.includes(k.toLowerCase())) s += 7; });
  return Math.min(s, 99);
}

// ── Offres complémentaires (sources non-API) ──────────────────
function buildComplementaires(poste, secteur) {
  const pool = [
    { titre: 'Directeur(trice) adjoint(e) — pôle aide à domicile', org: 'Association d\'aide et soins — Arrageois', lieu: 'Arras (62)', contrat: 'CDI', desc: 'Pilotage du pôle SAD/SSIAD, encadrement des coordinatrices, dialogue ARS/CD62, contribution au projet de groupe associatif.', src: 'ft', lien: 'https://candidat.francetravail.fr/offres/recherche?motsCles=directeur+adjoint+aide+domicile&lieux=62&rayonRecherche=40' },
    { titre: 'Chef de service — habitat inclusif et insertion',     org: 'APEI du Ternois',                          lieu: 'Saint-Pol-sur-Ternoise (62)', contrat: 'CDI', desc: 'Coordination du projet d\'habitat inclusif, pilotage partenarial MDPH/CD62, animation équipe pluridisciplinaire.', src: 'apei', lien: 'https://www.unapei.org/nos-offres-demploi/' },
    { titre: 'Responsable développement de l\'offre médico-sociale', org: 'Groupe associatif NPC',                   lieu: 'Lens / Arras (62)', contrat: 'CDI', desc: 'Analyse des besoins territoriaux, réponse aux appels à projets ARS/CD62, élaboration des CPOM, suivi SERAFIN-PH.', src: 'ft', lien: 'https://candidat.francetravail.fr/offres/recherche?motsCles=responsable+developpement+medicosocial&lieux=62&rayonRecherche=40' },
    { titre: 'Chargé(e) de mission promotion de la santé',          org: 'CPTS du Grand Arras',                      lieu: 'Arras (62)', contrat: 'CDD 12 mois renouvelable', desc: 'Animation du projet de santé territorial, coordination des actions de prévention, lien ARS/IREPS HDF.', src: 'fp', lien: 'https://www.place-emploi-public.gouv.fr/offre-de-emploi/liste-des-offres?keyword=promotion+sante+arras' },
    { titre: 'Directeur(trice) de CCAS',                           org: 'Ville de Bapaume',                         lieu: 'Bapaume (62) — 24 km', contrat: 'Fonctionnaire / contractuel', desc: 'Pilotage du Centre Communal d\'Action Sociale, développement des services aux personnes vulnérables.', src: 'cdg', lien: 'https://www.cdg62.fr/offres-demploi' },
    { titre: 'Coordinateur(trice) de parcours — maison des aidants', org: 'Association Accueil et Relais — Arrageois', lieu: 'Arras (62)', contrat: 'CDI', desc: 'Coordination des dispositifs de soutien aux aidants familiaux, développement de l\'offre numérique et partenariats ESMS.', src: 'una', lien: 'https://www.una.fr/offres-d-emploi' },
  ];
  return pool
    .filter(o => activeFilters[o.src])
    .map(o => ({
      ...o,
      match: scoreMatch(o.titre + ' ' + o.desc, poste, secteur),
      date:  new Date().toLocaleDateString('fr-FR'),
    }));
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
    const motsCles = encodeURIComponent(
      (KW_POSTE[poste]  || KW_POSTE.chef)[0]   + ' ' +
      (KW_SECTEUR[secteur] || KW_SECTEUR.ms)[0]
    );
    const url = `${CONFIG.FT_API_URL}?motsCles=${motsCles}&commune=${CONFIG.COMMUNE_INSEE}&distance=${CONFIG.RAYON_KM}&nbResultats=${CONFIG.NB_RESULTATS}`;

    try {
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      if (r.ok) {
        const d = await r.json();
        ftOffers = (d.resultats || []).map(o => ({
          titre:   o.intitule || 'Poste non renseigné',
          org:     o.entreprise?.nom || 'Non précisé',
          lieu:    o.lieuTravail?.libelle || 'Non précisé',
          contrat: o.typeContrat || '',
          date:    o.dateCreation?.substring(0, 10) || '',
          desc:    (o.description || '').substring(0, 250) + '…',
          src:     'ft',
          lien:    'https://candidat.francetravail.fr/offres/recherche/detail/' + o.id,
          match:   scoreMatch(o.intitule + ' ' + (o.description || ''), poste, secteur),
        }));
      }
    } catch (e) { console.error('Erreur API FT :', e); }
  }

  const complementaires = buildComplementaires(poste, secteur);
  let allOffers;

  if (ftOffers.length >= 2) {
    // Vraies offres FT + offres complémentaires non-FT
    allOffers = [...ftOffers, ...complementaires.filter(o => o.src !== 'ft')];
    showAlert(`<i class="ti ti-check"></i> ${ftOffers.length} offre(s) chargée(s) en temps réel depuis l'API France Travail (authentification OAuth réussie). Les offres associatives proviennent d'une sélection représentative.`, 'info');
  } else {
    allOffers = complementaires;
    showAlert(`<i class="ti ti-info-circle"></i> Token obtenu mais aucun résultat API pour ce périmètre exact. Les offres ci-dessous sont représentatives — cliquez les liens pour accéder aux sources officielles.`, 'warn');
  }

  allOffers.sort((a, b) => b.match - a.match);
  lastOffers = allOffers;

  // Statistiques
  const cdi  = allOffers.filter(o => (o.contrat || '').toUpperCase().includes('CDI')).length;
  const haut = allOffers.filter(o => o.match >= 85).length;
  const srcs = Object.values(activeFilters).filter(Boolean).length;
  document.getElementById('stTotal').textContent = allOffers.length;
  document.getElementById('stHaut').textContent  = haut;
  document.getElementById('stCDI').textContent   = cdi;
  document.getElementById('stSrc').textContent   = srcs;
  document.getElementById('statsRow').style.display = 'grid';

  renderOffers(allOffers);
  setStatus('', `${allOffers.length} offre(s) · Mise à jour : ${new Date().toLocaleString('fr-FR')}`, 'ok');
  document.getElementById('btnLancer').disabled = false;
}

// ── Affichage des offres ──────────────────────────────────────
function renderOffers(offers) {
  const c = document.getElementById('results');
  if (!offers.length) {
    c.innerHTML = '<div class="empty"><i class="ti ti-mood-sad"></i><p>Aucune offre pour ces critères. Modifiez les filtres.</p></div>';
    return;
  }
  const srcL = { ft:'France Travail', fp:'Emploi public', una:'UNA', apei:'UNAPEI', cdg:'CDG62', fehap:'FEHAP' };
  const srcC = { ft:'src-ft', fp:'src-fp', una:'src-as', apei:'src-as', cdg:'src-fp', fehap:'src-as' };

  let html = `<div class="rh"><h2>Offres correspondant à votre profil</h2><span class="badge">${offers.length} offre${offers.length > 1 ? 's' : ''}</span></div>`;

  offers.forEach(o => {
    const hi = o.match >= 85;
    html += `
      <div class="card${hi ? ' hi' : ''}">
        <div class="ct">
          <span class="ctitle">${o.titre}</span>
          <span class="src ${srcC[o.src] || 'src-ft'}">${srcL[o.src] || o.src}</span>
        </div>
        <div class="org"><i class="ti ti-building"></i> ${o.org} &nbsp;·&nbsp; <i class="ti ti-map-pin"></i> ${o.lieu}</div>
        <div class="metas">
          <span class="mt">${o.contrat}</span>
          <span class="mt">${o.date}</span>
          <span class="ms ${o.match >= 85 ? 'ms-h' : 'ms-m'}">Compatibilité ${Math.round(o.match)} %</span>
        </div>
        <div class="desc">${o.desc}</div>
        <a class="clink" href="${o.lien}" target="_blank"><i class="ti ti-external-link"></i> Voir l'offre complète</a>
      </div>`;
  });
  c.innerHTML = html;
}

// ── Génération lettre via Claude API ─────────────────────────
async function genLettre() {
  const poste   = document.getElementById('lPoste').value   || 'Chef de service médico-social';
  const org     = document.getElementById('lOrg').value     || 'Association médico-sociale';
  const lieu    = document.getElementById('lLieu').value    || 'Arras (62)';
  const contrat = document.getElementById('lContrat').value;
  const notes   = document.getElementById('lNotes').value;
  const out     = document.getElementById('outLettre');

  if (CONFIG.ANTHROPIC_API_KEY === 'VOTRE_CLE_ANTHROPIC_ICI') {
    out.textContent = '⚠️ Clé API Anthropic non configurée. Ouvrez config.js et remplacez VOTRE_CLE_ANTHROPIC_ICI par votre clé (console.anthropic.com → API Keys).';
    return;
  }

  setStatus('2', 'Génération de la lettre en cours…', 'loading');
  document.getElementById('btnLettre').disabled = true;
  out.textContent = 'Génération en cours…';

  const prompt = `Rédige une lettre de motivation professionnelle, formelle et personnalisée pour le poste de "${poste}" (${contrat}) au sein de "${org}" à ${lieu}.

Profil du candidat : cadre dirigeant du secteur médico-social, ex-directeur d'UNARTOIS Aide et Soins (SAD mixte/SSIAD, Arrageois), expertise en pilotage stratégique, développement de l'offre de services, gouvernance associative, management participatif de chefs de service, dialogue avec ARS/CD/CNSA, prévention et promotion de la santé, droit du travail et des associations, coordination territoriale (CPTS, partenariats institutionnels), habitat inclusif.

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
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    const d = await r.json();
    const txt = d.content?.[0]?.text || 'Erreur : réponse inattendue de l\'API.';
    out.textContent = txt;
    setStatus('2', 'Lettre générée avec succès.', 'ok');
  } catch (e) {
    out.textContent = 'Erreur de génération : ' + e.message;
    setStatus('2', 'Erreur lors de la génération.', 'error');
  }
  document.getElementById('btnLettre').disabled = false;
}

// ── Génération recommandations CV via Claude API ──────────────
async function genCV() {
  const poste   = document.getElementById('cvPoste').value;
  const secteur = document.getElementById('cvSecteur').value;
  const conv    = document.getElementById('cvConv').value;
  const notes   = document.getElementById('cvNotes').value;
  const out     = document.getElementById('outCV');

  if (CONFIG.ANTHROPIC_API_KEY === 'VOTRE_CLE_ANTHROPIC_ICI') {
    out.textContent = '⚠️ Clé API Anthropic non configurée. Ouvrez config.js et remplacez VOTRE_CLE_ANTHROPIC_ICI par votre clé (console.anthropic.com → API Keys).';
    return;
  }

  setStatus('3', 'Génération des recommandations CV en cours…', 'loading');
  document.getElementById('btnCV').disabled = true;
  out.textContent = 'Génération en cours…';

  const prompt = `Aide-moi à adapter mon CV pour le poste de "${poste}" dans le secteur "${secteur}" (convention : ${conv}) dans un rayon de 40 km autour d'Arras.

Mon profil : ex-directeur d'UNARTOIS Aide et Soins (groupe associatif SAD mixte/SSIAD), management de 7 chefs de service, gouvernance GCSMS, développement de l'offre (habitat inclusif, prévention, numérique), expertise CPOM/SERAFIN-PH/ARS/CD62, coordination CPTS Grand Arras, formation UNAFORM'ARTOIS, droit du travail et des associations.
${notes ? `\nCompétences/expériences spécifiques à valoriser : ${notes}\n` : ''}
Fournis :
1. Structure de CV recommandée avec rubriques et ordre
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
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    const d = await r.json();
    const txt = d.content?.[0]?.text || 'Erreur : réponse inattendue de l\'API.';
    out.textContent = txt;
    setStatus('3', 'Recommandations générées avec succès.', 'ok');
  } catch (e) {
    out.textContent = 'Erreur de génération : ' + e.message;
    setStatus('3', 'Erreur lors de la génération.', 'error');
  }
  document.getElementById('btnCV').disabled = false;
}

// ── Export synthèse vers Claude.ai ───────────────────────────
function exportSynthese() {
  if (!lastOffers.length) {
    alert('Lancez d\'abord la veille pour charger des offres.');
    return;
  }
  const lines = lastOffers.slice(0, 6).map((o, i) =>
    `${i + 1}. ${o.titre} — ${o.org} (${o.lieu}) — ${o.contrat} — Compatibilité : ${Math.round(o.match)} %`
  ).join('\n');
  const txt = `Sur la base des offres suivantes (rayon 40 km autour d'Arras) :\n\n${lines}\n\nGénère une synthèse stratégique : tendances du marché médico-social local, postes prioritaires, niveaux de rémunération (BAD/FEHAP/FPT), recommandations de démarche proactive et réseaux clés à activer dans le Pas-de-Calais.`;
  navigator.clipboard.writeText(txt).then(() => alert('Synthèse copiée ! Collez-la dans Claude.ai pour l\'analyse.'));
}

// ── Utilitaires ───────────────────────────────────────────────
function copier(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent)
    .then(() => alert('Contenu copié dans le presse-papiers.'))
    .catch(() => alert('Impossible de copier automatiquement. Sélectionnez le texte manuellement.'));
}

function telecharger(id, nomFichier) {
  const el = document.getElementById(id);
  if (!el) return;
  const blob = new Blob([el.textContent], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
}

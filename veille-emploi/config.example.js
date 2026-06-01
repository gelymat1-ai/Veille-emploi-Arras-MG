// ═══════════════════════════════════════════════════════════════
//  CONFIG EXEMPLE — copiez ce fichier en "config.js"
//  puis renseignez vos vraies clés API
// ═══════════════════════════════════════════════════════════════

const CONFIG = {

  // ── France Travail API ────────────────────────────────────────
  // Créez vos clés sur https://francetravail.io/data
  FT_CLIENT_ID:     'PAR_votre_app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  FT_CLIENT_SECRET: 'votre_client_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  FT_TOKEN_URL:     'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
  FT_API_URL:       'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',

  // ── Anthropic Claude API ──────────────────────────────────────
  // Créez votre clé sur https://console.anthropic.com → API Keys
  ANTHROPIC_API_KEY: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

  // ── Paramètres de recherche ───────────────────────────────────
  COMMUNE_INSEE:  '62041',   // Code INSEE d'Arras
  RAYON_KM:       40,
  NB_RESULTATS:   20,

};

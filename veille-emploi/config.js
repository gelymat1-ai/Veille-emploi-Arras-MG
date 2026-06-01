// ═══════════════════════════════════════════════════════════════
//  CONFIG — Veille emploi médico-social Arras
//  Modifiez uniquement ce fichier pour mettre à jour vos clés API
// ═══════════════════════════════════════════════════════════════

const CONFIG = {

  // ── France Travail API ────────────────────────────────────────
  FT_CLIENT_ID:     'PAR_veilleemploimgarrageo_d553882ecc6db1378aa2368acc02bef173181e035457959eff4352c91b60d671',
  FT_CLIENT_SECRET: '974f1d7847c0f8d7bd40c4075fff573069f36e294d7a5dff64e5c7a79e86b257',
  FT_TOKEN_URL:     'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
  FT_API_URL:       'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',

  // ── Anthropic Claude API (pour génération lettre et CV) ───────
  // Créez une clé sur https://console.anthropic.com → API Keys
  ANTHROPIC_API_KEY: 'VOTRE_CLE_ANTHROPIC_ICI',

  // ── Paramètres de recherche ───────────────────────────────────
  COMMUNE_INSEE:  '62041',   // Code INSEE d'Arras
  RAYON_KM:       40,
  NB_RESULTATS:   20,

};

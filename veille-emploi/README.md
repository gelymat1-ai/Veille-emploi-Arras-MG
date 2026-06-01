# Veille emploi médico-social — Arras 40 km

Agent de veille des offres d'emploi pour cadre dirigeant du secteur médico-social,
localisées dans un rayon de 40 km autour d'Arras.

## Fonctionnalités

- Interrogation de l'API France Travail en temps réel (OAuth 2.0)
- Score de compatibilité calculé sur votre profil cadre
- Liens directs vers les offres (Emploi public, UNA, UNAPEI, CDG62, FEHAP)
- Génération de lettre de motivation via Claude (Anthropic API)
- Recommandations d'adaptation de CV avec mots-clés ATS
- Mode sombre automatique

## Installation locale

1. Téléchargez ou clonez ce dépôt
2. Copiez `config.example.js` en `config.js`
3. Renseignez vos clés dans `config.js`
4. Ouvrez `index.html` dans votre navigateur

## Clés API nécessaires

### France Travail
- Créez un compte sur https://francetravail.io/data
- Créez une application → souscrivez à l'API "Offres d'emploi v2"
- Récupérez `client_id` et `client_secret`

### Anthropic (pour la génération de lettre et CV)
- Créez un compte sur https://console.anthropic.com
- Allez dans "API Keys" → "Create Key"
- Copiez la clé dans `config.js`

## Déploiement GitHub Pages

Voir le guide détaillé dans la conversation Claude.

## Sécurité

Le fichier `config.js` est listé dans `.gitignore` et ne sera jamais
publié sur GitHub. Vos clés API restent sur votre machine.

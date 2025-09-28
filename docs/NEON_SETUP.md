# Configuration Neon Database

Ce guide vous accompagne dans la configuration complète de votre base de données Neon pour l'application ZOLL TAX FOREX Management.

## 🚀 Démarrage Rapide

### 1. Créer un Projet Neon

1. Allez sur [Neon Console](https://console.neon.tech)
2. Créez un nouveau projet
3. Choisissez la région la plus proche
4. Notez votre `DATABASE_URL`

### 2. Configuration Environnement

\`\`\`bash
# Copier le fichier d'exemple
cp .env.example .env.local

# Éditer avec votre DATABASE_URL
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"
\`\`\`

### 3. Initialisation

\`\`\`bash
# Installer les dépendances
npm install

# Initialiser la base de données
npm run db:init

# Vérifier la connexion
npm run db:check
\`\`\`

## 📊 Schéma de Base de Données

### Tables Principales

#### `users` - Comptes Utilisateurs
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate')),
  agency TEXT NOT NULL DEFAULT 'Non assigné',
  password_hash TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### `agencies` - Agences Financières
\`\`\`sql
CREATE TABLE agencies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive')),
  users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### `user_agencies` - Relations Utilisateur-Agence
\`\`\`sql
CREATE TABLE user_agencies (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, agency_id)
);
\`\`\`

#### `settings` - Paramètres Globaux
\`\`\`sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  usd NUMERIC NOT NULL DEFAULT 1.0,
  eur NUMERIC NOT NULL DEFAULT 0.85,
  gbp NUMERIC NOT NULL DEFAULT 0.75,
  transfer_limit BIGINT NOT NULL DEFAULT 10000,
  daily_limit BIGINT NOT NULL DEFAULT 50000,
  card_limit BIGINT NOT NULL DEFAULT 5000,
  commission NUMERIC NOT NULL DEFAULT 0.02,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\`\`\`

#### `agency_limits` - Limites par Agence
\`\`\`sql
CREATE TABLE agency_limits (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  daily_limit BIGINT,
  transfer_limit BIGINT,
  card_limit BIGINT,
  commission NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\`\`\`

#### `settings_history` - Historique des Changements
\`\`\`sql
CREATE TABLE settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usd NUMERIC NOT NULL,
  eur NUMERIC NOT NULL,
  gbp NUMERIC NOT NULL,
  transfer_limit BIGINT NOT NULL,
  daily_limit BIGINT NOT NULL,
  card_limit BIGINT NOT NULL,
  commission NUMERIC NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\`\`\`

## 👥 Comptes de Test

Le script d'initialisation crée automatiquement 6 comptes de test :

| Rôle | Email | Mot de passe | Agence |
|------|-------|--------------|---------|
| **Super Admin** | admin@test.com | password123 | Administration |
| **Directeur** | directeur@test.com | password123 | Direction Générale |
| **Comptable** | comptable@test.com | password123 | Service Comptabilité |
| **Caissier** | caissier@test.com | password123 | Agence Centrale |
| **Auditeur** | auditeur@test.com | password123 | Service Audit |
| **Délégué** | delegue@test.com | password123 | Agence Régionale |

## 🏢 Agences par Défaut

4 agences sont créées automatiquement :

1. **Agence Centrale** - Paris, France
2. **Agence Lyon** - Lyon, France  
3. **Agence Marseille** - Marseille, France
4. **Agence Toulouse** - Toulouse, France

## 🔧 Scripts Disponibles

\`\`\`bash
# Initialisation complète (tables + données)
npm run db:init

# Vérification de connexion et statut
npm run db:check

# Seeding de données supplémentaires
npm run db:seed

# Migrations personnalisées
npm run db:migrate
\`\`\`

## 🖥️ Interfaces de Monitoring

### Dashboard de Statut : `/dev/db-status`
- Statut de connexion en temps réel
- Informations serveur (version, utilisateur, base)
- Liste des tables avec compteurs de lignes
- Statistiques rapides (utilisateurs, agences, etc.)

### API de Statut : `/api/dev/db-status`
- Test de connexion automatique
- Métadonnées de base (nom, version, utilisateur)
- Comptage des tables avec gestion d'erreurs
- Format JSON pour intégration

## 🔐 Sécurité et Bonnes Pratiques

### Variables d'Environnement
- ✅ Utilisez des secrets forts pour `JWT_SECRET`
- ✅ Configurez `NEXTAUTH_SECRET` unique
- ✅ Activez SSL avec `sslmode=require`
- ✅ Limitez les permissions de base de données

### Authentification
- ✅ Mots de passe hashés avec bcrypt
- ✅ Sessions sécurisées avec cookies HTTP-only
- ✅ Expiration automatique des sessions
- ✅ Validation des rôles et permissions

### Audit et Monitoring
- ✅ Historique des changements de paramètres
- ✅ Logs de connexion utilisateur
- ✅ Monitoring des performances
- ✅ Alertes de sécurité

## 🚀 Déploiement en Production

### Checklist Pré-Déploiement

- [ ] **Base de données configurée** avec SSL
- [ ] **Variables d'environnement** sécurisées
- [ ] **Comptes de test supprimés** ou désactivés
- [ ] **Mots de passe admin** changés
- [ ] **Monitoring activé** (Sentry, logs)
- [ ] **Sauvegardes configurées** (Neon auto-backup)
- [ ] **Limites de taux** activées
- [ ] **HTTPS forcé** en production

### Configuration Production

\`\`\`bash
# Variables d'environnement production
NODE_ENV="production"
ALLOW_DEV_LOGIN="false"
ENABLE_RATE_LIMITING="true"
LOG_LEVEL="warn"
\`\`\`

### Monitoring Neon

1. **Métriques de Performance** : CPU, RAM, connexions
2. **Alertes Automatiques** : Erreurs, latence, disponibilité
3. **Sauvegardes** : Point-in-time recovery activé
4. **Scaling** : Auto-scaling selon la charge

## 🛠️ Dépannage

### Problèmes Courants

#### Erreur de Connexion
\`\`\`
Error: connect ECONNREFUSED
\`\`\`
**Solution** : Vérifiez votre `DATABASE_URL` et la connectivité réseau.

#### Erreur de Permissions
\`\`\`
Error: permission denied for table users
\`\`\`
**Solution** : Vérifiez les permissions de votre utilisateur Neon.

#### Tables Manquantes
\`\`\`
Error: relation "users" does not exist
\`\`\`
**Solution** : Exécutez `npm run db:init` pour créer les tables.

#### Données de Test Manquantes
\`\`\`
Error: No test users found
\`\`\`
**Solution** : Exécutez `npm run db:seed` pour insérer les données.

### Commandes de Diagnostic

\`\`\`bash
# Test de connexion basique
npm run db:check

# Vérification complète du schéma
node -e "require('./lib/db').testConnection()"

# Reset complet (ATTENTION: supprime toutes les données)
# Uniquement en développement !
\`\`\`

### Support et Ressources

- **Documentation Neon** : [docs.neon.tech](https://docs.neon.tech)
- **Console Neon** : [console.neon.tech](https://console.neon.tech)
- **Support Technique** : Via la console Neon
- **Communauté** : Discord Neon

## 📈 Optimisation des Performances

### Index Recommandés

\`\`\`sql
-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_user_agencies_user_id ON user_agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_history_created_at ON settings_history(created_at);
\`\`\`

### Requêtes Optimisées

- Utilisez des requêtes préparées (déjà implémenté avec Neon)
- Limitez les résultats avec `LIMIT` et `OFFSET`
- Utilisez des jointures efficaces
- Évitez les `SELECT *` inutiles

### Monitoring des Performances

- Surveillez les requêtes lentes dans la console Neon
- Utilisez `EXPLAIN ANALYZE` pour optimiser
- Configurez des alertes de performance
- Surveillez l'utilisation des connexions

---

**🎉 Votre base de données Neon est maintenant prête pour la production !**

Pour toute question ou problème, consultez la documentation ou contactez le support technique.

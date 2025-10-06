# 🚀 Configuration Base de Données Production

## Configuration Rapide

### 1. Créer un fichier `.env.local`

```bash
# Copiez ce contenu dans .env.local
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"
NODE_ENV="production"
NEXTAUTH_SECRET="your-nextauth-secret-here"
JWT_SECRET="your-jwt-secret-here"
```

### 2. Obtenir votre DATABASE_URL

1. Allez sur [Neon Console](https://console.neon.tech)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Copiez la `DATABASE_URL` depuis l'onglet "Connection Details"

### 3. Tester la connexion

```bash
node scripts/test-db-connection.mjs
```

### 4. Initialiser la base de données

```bash
node scripts/setup-production-db.mjs
```

### 5. Démarrer l'application

```bash
npm run dev
```

## ✅ Vérifications

Après configuration, vous devriez voir :
- ✅ Connexion à la base de données réussie
- ✅ Tables créées avec les nouvelles colonnes
- ✅ Comptes utilisateurs de test
- ✅ Données réelles au lieu des données mockées

## 🔐 Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@test.com | [mot-de-passe-test] |
| Directeur | directeur@test.com | [mot-de-passe-test] |
| Comptable | comptable@test.com | [mot-de-passe-test] |
| Caissier | caissier@test.com | [mot-de-passe-test] |
| Auditeur | auditeur@test.com | [mot-de-passe-test] |
| Délégué | delegue@test.com | [mot-de-passe-test] |

## ⚠️ Important

- Changez les mots de passe en production
- Supprimez les comptes de test en production
- Configurez les vraies adresses email
- Activez les notifications email

## 🆘 Dépannage

Si vous rencontrez des erreurs :

1. **"DATABASE_URL not defined"** → Créez le fichier `.env.local`
2. **"Connection failed"** → Vérifiez votre DATABASE_URL
3. **"Table does not exist"** → Exécutez `setup-production-db.mjs`
4. **"Column does not exist"** → La migration n'a pas été appliquée

## 📚 Documentation Complète

Consultez `docs/NEON_SETUP.md` pour plus de détails.

# 🔒 Guide de Sécurité - ZOLL TAX FOREX

## ⚠️ Règles de Sécurité Importantes

### 1. **JAMAIS de Secrets dans le Code**
- ❌ Ne jamais commiter de mots de passe, clés API, ou tokens
- ❌ Ne jamais mettre de secrets dans la documentation
- ❌ Ne jamais utiliser de vraies données de production dans les exemples

### 2. **Utilisation des Variables d'Environnement**
- ✅ Toujours utiliser des variables d'environnement pour les secrets
- ✅ Utiliser des fichiers `.env.local` pour le développement local
- ✅ Utiliser des placeholders dans la documentation

### 3. **Exemples Sécurisés**
```bash
# ✅ CORRECT - Utiliser des placeholders
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app

# ❌ INCORRECT - Utiliser de vraies données
SMTP_USER=mbamaexcel@gmail.com
SMTP_PASS=cfxvilwkafdjmrjj
```

### 4. **Fichiers à Surveiller**
- `.env*` - Déjà dans .gitignore ✅
- `docs/` - Vérifier qu'aucun secret n'y est exposé
- `scripts/` - Vérifier les scripts de test
- `lib/` - Vérifier les fichiers de configuration

### 5. **Actions Immédiates en Cas de Fuite**
1. **Changer immédiatement** le mot de passe/clé exposé
2. **Supprimer** le secret du code/documentation
3. **Revoguer** l'accès si nécessaire
4. **Auditer** l'historique Git pour d'autres fuites

### 6. **Outils de Détection**
- GitGuardian (déjà configuré) ✅
- GitHub Secret Scanning ✅
- Pre-commit hooks (recommandé)

## 🚨 Fuite de Secret Détectée et Corrigée

**Date:** 6 octobre 2025  
**Problème:** Mot de passe email exposé dans `docs/EMAIL_SETUP.md`  
**Action:** Secret supprimé et remplacé par un placeholder  
**Statut:** ✅ Corrigé

## 📋 Checklist de Sécurité

Avant chaque commit :
- [ ] Aucun mot de passe en dur dans le code
- [ ] Aucun secret dans la documentation
- [ ] Variables d'environnement utilisées correctement
- [ ] Fichiers `.env*` dans `.gitignore`
- [ ] Tests avec des données factices uniquement

## 🔧 Configuration Recommandée

### Variables d'Environnement Requises
```bash
# Base de données
DATABASE_URL=postgresql://username:password@hostname/database

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app

# Configuration
FROM_NAME="ZOLL TAX FOREX"
FROM_EMAIL=noreply@zolltaxforex.com
NODE_ENV=development
```

### Fichiers de Configuration
- `email-config.example` - Template sécurisé ✅
- `.env.local` - Variables locales (ignoré par Git) ✅
- `.gitignore` - Configuration correcte ✅

## 📞 Contact Sécurité

En cas de problème de sécurité :
1. Corriger immédiatement
2. Notifier l'équipe
3. Documenter l'incident
4. Mettre à jour ce guide si nécessaire

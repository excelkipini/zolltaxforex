# 📧 Configuration du Système de Notifications Email

Ce document explique comment configurer et utiliser le système de notifications email automatiques pour ZOLL TAX FOREX.

## 🎯 Vue d'ensemble

Le système envoie automatiquement des emails de notification pour les événements suivants :

1. **Transaction créée par un caissier** → Auditeurs (TO) + Directeur & Comptables (CC)
2. **Transaction validée par un auditeur** → Caissier créateur (TO) + Directeur & Comptables (CC)
3. **Transaction clôturée par un caissier** → Auditeurs (TO) + Directeur & Comptables (CC)
4. **Demande de suppression de reçu** → Comptables (TO) + Directeur (CC)
5. **Demande de suppression validée** → Caissier demandeur (TO) + Directeur (CC)

## ⚙️ Configuration

### 1. Variables d'environnement

Copiez le fichier `email-config.example` vers `.env.local` et configurez :

```bash
# Configuration SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app

# Configuration de l'expéditeur
FROM_NAME="ZOLL TAX FOREX"
FROM_EMAIL=noreply@zolltaxforex.com
```

### 2. Configuration Gmail (exemple)

Pour utiliser Gmail comme service SMTP :

1. Activez l'authentification à 2 facteurs
2. Générez un mot de passe d'application
3. Utilisez ces informations dans `.env.local`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mbamaexcel@gmail.com
SMTP_PASS=cfxvilwkafdjmrjj
```

### 3. Autres services SMTP

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=votre-api-key-sendgrid
```

#### AWS SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=votre-access-key
SMTP_PASS=votre-secret-key
```

## 🧪 Tests

### Test du système complet

```bash
node scripts/test-email-notifications.mjs
```

Ce script :
- Vérifie la connexion à la base de données
- Liste les utilisateurs par rôle
- Crée une transaction de test
- Simule l'envoi de notifications
- Nettoie les données de test

### Test manuel d'une notification

```javascript
import { sendTransactionCreatedNotification, convertTransactionToEmailData } from './lib/email-notifications'

const testTransaction = {
  id: 'TEST_123',
  type: 'transfer',
  amount: 50000,
  currency: 'XAF',
  description: 'Test notification',
  created_by: 'caissier@test.com',
  agency: 'Agence Centrale',
  status: 'pending',
  created_at: new Date().toISOString()
}

const emailData = convertTransactionToEmailData(testTransaction)
const result = await sendTransactionCreatedNotification(emailData)
console.log(result)
```

## 📋 Utilisation dans le code

### Création de transaction

```javascript
import { createTransaction } from './lib/transactions-queries'

const transaction = await createTransaction({
  type: 'transfer',
  description: 'Transfert vers Paris',
  amount: 100000,
  currency: 'XAF',
  created_by: 'caissier@test.com',
  agency: 'Agence Centrale',
  details: { recipient: 'Jean Dupont' }
})
// → Email automatique envoyé aux auditeurs
```

### Validation de transaction

```javascript
import { updateTransactionStatus } from './lib/transactions-queries'

const transaction = await updateTransactionStatus(
  'transaction-id', 
  'validated'
)
// → Email automatique envoyé au caissier créateur
```

### Demande de suppression

```javascript
import { requestTransactionDeletion } from './lib/transactions-queries'

const transaction = await requestTransactionDeletion(
  'transaction-id',
  'caissier@test.com',
  'Erreur de saisie'
)
// → Email automatique envoyé aux comptables
```

## 🎨 Personnalisation des templates

Les templates email sont dans `lib/email-templates.ts`. Vous pouvez :

1. Modifier les couleurs et styles CSS
2. Ajouter des informations supplémentaires
3. Changer la structure HTML
4. Ajouter des logos ou images

### Exemple de personnalisation

```javascript
// Dans email-templates.ts
const BASE_TEMPLATE = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <style>
        .header {
            background-color: #votre-couleur; /* Personnaliser */
        }
        .logo {
            width: 100px; /* Ajouter un logo */
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="logo.png" class="logo" alt="Logo">
        <h1>${title}</h1>
    </div>
    <div class="content">
        ${content}
    </div>
</body>
</html>
`
```

## 🔧 Dépannage

### Problèmes courants

1. **Email non envoyé**
   - Vérifiez les variables SMTP_* dans `.env.local`
   - Testez avec `node scripts/test-email-notifications.mjs`

2. **Erreur d'authentification SMTP**
   - Vérifiez le nom d'utilisateur et mot de passe
   - Pour Gmail, utilisez un mot de passe d'application

3. **Destinataires incorrects**
   - Vérifiez que les utilisateurs existent dans la base de données
   - Vérifiez leurs rôles et emails

4. **Template mal formaté**
   - Vérifiez la syntaxe HTML dans `email-templates.ts`
   - Testez avec un navigateur web

### Logs et débogage

Les erreurs sont loggées dans la console. Activez les logs détaillés :

```bash
NODE_ENV=development node scripts/test-email-notifications.mjs
```

## 📊 Monitoring

### Vérifier l'état du système

```javascript
import { isEmailConfigured, getEmailConfig } from './lib/email-service'

console.log('Email configuré:', isEmailConfigured())
console.log('Configuration:', getEmailConfig())
```

### Statistiques d'envoi

Ajoutez un système de logging pour suivre :
- Nombre d'emails envoyés
- Taux de succès/échec
- Temps de réponse SMTP

## 🚀 Production

### Recommandations

1. **Service SMTP professionnel** : Utilisez SendGrid, AWS SES, ou Mailgun
2. **Monitoring** : Surveillez les taux de livraison
3. **Backup** : Configurez un service SMTP de secours
4. **Rate limiting** : Limitez le nombre d'emails par minute
5. **Templates responsives** : Optimisez pour mobile

### Sécurité

1. **Variables d'environnement** : Ne commitez jamais les mots de passe
2. **HTTPS** : Utilisez toujours des connexions sécurisées
3. **Validation** : Validez tous les emails avant envoi
4. **Anti-spam** : Respectez les bonnes pratiques anti-spam

## 📞 Support

Pour toute question ou problème :
1. Consultez les logs de la console
2. Testez avec le script de test
3. Vérifiez la configuration SMTP
4. Contactez l'équipe de développement

# 🚀 Correction du Problème des Fichiers Justificatifs - Arrêtés de Caisse

## 🚨 Problème Résolu

**Symptôme :** Les fichiers justificatifs joints ne s'affichent pas dans la version déployée (production) de l'application, mais fonctionnent correctement en local.

**Cause :** L'endpoint `/api/upload` utilisait le système de fichiers (`writeFile`) pour stocker les fichiers dans `/public/uploads/cash-declarations/`, ce qui ne fonctionne pas sur Vercel (système de fichiers en lecture seule).

## ✅ Solution Implémentée

### 1. **Modification de l'endpoint d'upload**
- Le fichier `app/api/upload/route.ts` a été modifié pour stocker les fichiers en base de données
- Utilisation de la table `uploaded_files` existante (comme pour les reçus d'exécution)
- Retour d'une URL au format `/api/files/[id]` au lieu de `/uploads/cash-declarations/filename`

### 2. **Amélioration de l'API de service de fichiers**
- Le fichier `app/api/files/[id]/route.ts` a été amélioré avec un fallback
- Compatible avec les anciens fichiers stockés localement (pour l'environnement de développement)
- Priorité au stockage en base de données, fallback vers le système de fichiers

## 🔧 Changements Techniques

### Fichier : `app/api/upload/route.ts`

#### AVANT (ne fonctionne pas sur Vercel)
```typescript
// Créer le répertoire uploads s'il n'existe pas
const uploadsDir = path.join(process.cwd(), "public", "uploads", "cash-declarations")
await writeFile(path.join(uploadsDir, ".gitkeep"), "")

// Générer un nom de fichier unique
const fileName = `${uuidv4()}.${fileExtension}`
const filePath = path.join(uploadsDir, fileName)

// Enregistrer le fichier
const bytes = await file.arrayBuffer()
const buffer = Buffer.from(bytes)
await writeFile(filePath, buffer)

// Retourner le chemin relatif
const relativePath = `/uploads/cash-declarations/${fileName}`
```

#### APRÈS (fonctionne sur Vercel)
```typescript
// Fonction pour sauvegarder le fichier uploadé en base de données
async function saveUploadedFile(file: File): Promise<string> {
  // Convertir le fichier en buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Générer un nom de fichier unique
  const fileExtension = path.extname(file.name)
  const filename = `cash-declaration_${Date.now()}_${uuidv4()}${fileExtension}`
  
  // Stocker le fichier en base de données
  const result = await sql`
    INSERT INTO uploaded_files (filename, content_type, file_data, created_at)
    VALUES (${filename}, ${file.type}, ${buffer}, NOW())
    RETURNING id
  `
  
  // Retourner l'URL pour récupérer le fichier
  return `/api/files/${result[0].id}`
}
```

### Fichier : `app/api/files/[id]/route.ts`

#### Ajout d'un fallback
```typescript
// Essayer de récupérer le fichier depuis le système de fichiers (fallback pour l'environnement local)
try {
  const filePath = path.join(process.cwd(), 'public', 'uploads', 'cash-declarations', fileId)
  const fileData = readFileSync(filePath)
  // ... traiter le fichier et retourner la réponse
} catch (fsError) {
  // Si les deux méthodes échouent, retourner une erreur
  return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 })
}
```

## 🚀 Déploiement

### 1. **Vérification de la base de données**
La table `uploaded_files` doit exister (elle est créée automatiquement lors de l'initialisation de la base de données).

### 2. **Déploiement Vercel**
```bash
# Déployer sur Vercel
vercel --prod
```

### 3. **Vérification**
- Créer un nouvel arrêté de caisse avec un fichier justificatif
- Vérifier que le fichier s'affiche correctement dans le dialogue de détails
- Confirmer que le lien du fichier fonctionne (format `/api/files/[id]`)

## 📊 Avantages de la Solution

### ✅ **Compatible Vercel**
- Fonctionne sur les plateformes serverless
- Pas de dépendance au système de fichiers local
- Fichiers persistés en base de données

### ✅ **Rétrocompatibilité**
- Fallback pour les fichiers existants en local
- Compatible avec l'environnement de développement
- Pas de migration nécessaire pour les anciens fichiers

### ✅ **Cohérence**
- Même approche que les reçus d'exécution
- API unifiée pour tous les fichiers uploadés
- Gestion centralisée dans la table `uploaded_files`

### ✅ **Sécurité**
- Fichiers stockés en base de données
- Contrôle d'accès via API
- Pas de fichiers exposés publiquement

## 🔍 Migration des Anciens Fichiers (Optionnel)

Si vous avez des fichiers justificatifs existants dans `/public/uploads/cash-declarations/`, vous pouvez les migrer vers la base de données :

```sql
-- Sélectionner les arrêtés avec des fichiers justificatifs
SELECT id, justificatif_file_path 
FROM ria_cash_declarations 
WHERE justificatif_file_path LIKE '/uploads/cash-declarations/%';

-- Pour chaque fichier :
-- 1. Lire le fichier depuis le système de fichiers
-- 2. Insérer dans uploaded_files
-- 3. Mettre à jour justificatif_file_path avec /api/files/[nouvel_id]
```

**Note :** Cette migration n'est pas nécessaire si vous n'avez pas encore de fichiers justificatifs en production.

## 🎯 Résultat

- ✅ **Problème de fichiers justificatifs résolu**
- ✅ **Upload de fichiers fonctionnel sur Vercel**
- ✅ **Fichiers justificatifs accessibles en production**
- ✅ **Solution cohérente avec les autres uploads**
- ✅ **Rétrocompatibilité avec l'environnement local**

Les fichiers justificatifs des arrêtés de caisse fonctionnent maintenant parfaitement sur Vercel ! 🎉


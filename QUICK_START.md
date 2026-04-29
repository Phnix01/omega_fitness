# 🚀 Guide de démarrage rapide - MA FITNESS

## Étape 1 : Configuration des formulaires (5 minutes)

### Créer un compte Web3Forms (GRATUIT)

1. Allez sur [https://web3forms.com](https://web3forms.com)
2. Cliquez sur "Get Started" / "Créer un compte"
3. Inscrivez-vous avec votre email
4. Vérifiez votre email et connectez-vous
5. Copiez votre **Access Key** (clé API)

### Configurer les formulaires

Ouvrez `index.html` et remplacez `YOUR_ACCESS_KEY_HERE` par votre clé dans 2 endroits :

**Formulaire de réservation (ligne 356)** :
```html
<input type="hidden" name="access_key" value="COLLEZ_VOTRE_CLE_ICI">
```

**Formulaire de contact (ligne 462)** :
```html
<input type="hidden" name="access_key" value="COLLEZ_VOTRE_CLE_ICI">
```

✅ C'est tout ! Les formulaires sont maintenant fonctionnels.

## Étape 2 : Tester localement (2 minutes)

### Option A : Avec VS Code (Recommandé)

1. Installez l'extension "Live Server"
2. Clic droit sur `index.html`
3. Sélectionnez "Open with Live Server"
4. Le site s'ouvre dans votre navigateur

### Option B : Double-clic

1. Double-cliquez simplement sur `index.html`
2. Le site s'ouvre dans votre navigateur par défaut

## Étape 3 : Personnaliser le contenu (10 minutes)

### Modifier les informations de contact

Dans `index.html`, cherchez et modifiez :

```html
<!-- Adresse (ligne ~418) -->
<p>Rue du Stade, Plateau<br>Niamey, Niger</p>

<!-- Email (ligne ~436) -->
<a href="mailto:contact@mafitness.ne">contact@mafitness.ne</a>

<!-- Téléphone (ligne ~437) -->
<a href="tel:+22790909090">90 90 90 90</a>
```

### Modifier les tarifs

Dans `index.html`, section pricing (lignes ~205-243) :

```html
<div class="price">25.000 <span>FCFA/mois</span></div>
```

### Changer les couleurs

Dans `style.css`, modifiez les variables CSS (lignes 1-8) :

```css
:root {
  --primary-dark: #121212;    /* Couleur de fond principale */
  --accent-red: #ff2e2e;      /* Couleur d'accentuation (rouge) */
  --text-primary: #ffffff;    /* Couleur du texte */
}
```

## Étape 4 : Déployer en ligne (10 minutes)

### Méthode 1 : Netlify (Recommandé) - GRATUIT

1. Créez un compte sur [netlify.com](https://netlify.com)
2. Cliquez sur "Add new site" → "Deploy manually"
3. Glissez-déposez le dossier du projet
4. Votre site est en ligne ! 🎉

**Bonus** : Netlify détecte automatiquement le fichier `netlify.toml` pour les optimisations.

### Méthode 2 : Vercel - GRATUIT

1. Créez un compte sur [vercel.com](https://vercel.com)
2. Cliquez sur "Add New Project"
3. Importez le dossier ou connectez GitHub
4. Cliquez sur "Deploy"

### Méthode 3 : GitHub Pages - GRATUIT

1. Créez un compte sur [github.com](https://github.com)
2. Créez un nouveau repository
3. Uploadez tous les fichiers
4. Allez dans Settings → Pages
5. Sélectionnez la branche "main"
6. Votre site est publié !

## Étape 5 : Configuration de Google Maps (Optionnel)

La carte Google Maps est déjà intégrée avec des coordonnées génériques de Niamey.

**Pour personnaliser** :

1. Allez sur [Google Maps](https://maps.google.com)
2. Trouvez votre adresse exacte
3. Cliquez sur "Partager" → "Intégrer une carte"
4. Copiez le code iframe
5. Remplacez l'iframe dans `index.html` (ligne 421)

## ✅ Checklist de lancement

- [ ] Clé Web3Forms configurée
- [ ] Informations de contact mises à jour
- [ ] Tarifs mis à jour
- [ ] Horaires d'ouverture vérifiés
- [ ] Google Maps personnalisé
- [ ] Liens réseaux sociaux mis à jour
- [ ] Test des formulaires
- [ ] Test sur mobile
- [ ] Site déployé en ligne

## 🎨 Personnalisations avancées

### Changer les images

Les images actuelles proviennent d'Unsplash. Pour les remplacer :

1. Créez un dossier `images/` dans le projet
2. Ajoutez vos images optimisées
3. Remplacez les URLs dans `index.html` :

```html
<!-- Avant -->
<img src="https://images.unsplash.com/photo-..." alt="...">

<!-- Après -->
<img src="images/votre-image.jpg" alt="...">
```

### Modifier les animations

Les animations sont gérées par GSAP dans `app.js`. Pour ajuster :

```javascript
// Ligne 182 - Durée des animations hero
duration: 1  // Augmentez ou diminuez (en secondes)

// Ligne 264 - Retard entre les animations
delay: index * 0.1  // Modifiez le multiplicateur
```

## 🆘 Problèmes courants

### Les formulaires ne fonctionnent pas
➡️ Vérifiez que vous avez bien remplacé `YOUR_ACCESS_KEY_HERE` par votre vraie clé Web3Forms.

### Les animations ne fonctionnent pas
➡️ Vérifiez que vous avez une connexion internet (GSAP est chargé depuis un CDN).

### Le menu mobile ne s'ouvre pas
➡️ Vérifiez que le fichier `app.js` est bien chargé. Ouvrez la console du navigateur (F12) pour voir les erreurs.

### Les images ne se chargent pas
➡️ Les images Unsplash nécessitent une connexion internet. Pour un site hors ligne, remplacez-les par des images locales.

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez la console du navigateur (F12) pour les erreurs
2. Lisez le fichier `README.md` pour plus de détails
3. Vérifiez que tous les fichiers sont bien présents :
   - `index.html`
   - `style.css`
   - `app.js`
   - `netlify.toml`

## 🎉 Félicitations !

Votre site MA FITNESS est maintenant configuré et prêt à transformer des vies ! 💪

---

**Temps total estimé : 30 minutes**

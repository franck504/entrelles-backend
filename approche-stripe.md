Voici la documentation technique adaptée intégrant la gestion KYC et la stratégie de paiement en deux parties :

---

## 📋 **Documentation technique : Gestion des paiements Entrelles**

### 🎯 **Architecture globale**
```mermaid
graph LR
A[Flutter App] --> B[Backend Node.js]
B --> C{Stripe API}
C --> D[KYC Conductrices]
C --> E[Paiements]
E --> F[(MongoDB Atlas)]
```

---

## 🔥 **1. Types de paiements & flux KYC**

### **A. Abonnement (3€/mois)**
```javascript
// Création de l'abonnement
await stripe.subscriptions.create({
  customer: user.stripeId,
  items: [{ price: 'price_1RYa3b4GtFeoWSgT7uK1TC0I' }],
});
```

### **B. Paiement trajet avec KYC intégré**
```mermaid
sequenceDiagram
    participant P as Passager
    participant A as Application
    participant S as Stripe
    participant C as Conductrice
    P->>A: Initie paiement
    A->>S: Crée PaymentIntent (montant total)
    S-->>P: Authentification 3D Secure
    P->>S: Paiement confirmé
    S->>A: Webhook payment_intent.succeeded
    A->>C: Vérifie statut KYC
    alt KYC validé
        A->>S: Transfert vers compte Connect (0.45€/km)
    else KYC manquant
        A->>C: Notification "Complétez KYC pour recevoir paiement"
        C->>S: Onboarding Stripe Identity
        S-->>A: Webhook account.updated
        A->>S: Transfert différé
    end
```

---

## ⚡ **2. Workflow KYC pour conductrices**

### **Processus d'onboarding**
```mermaid
graph TD
    A[Inscription conductrice] --> B{Complétion KYC?}
    B -->|Non| C[Accès limité : voir trajets mais pas recevoir paiements]
    B -->|Oui| D[Lancer Stripe Identity]
    D --> E[Capture pièce identité + selfie]
    E --> F{Vérification IA Stripe}
    F -->|Succès| G[Badge « Certifié » + Paiements activés]
    F -->|Échec| H[Revue manuelle <24h]
```

**Messages clés :**
- Avant KYC : "✅ Recevez vos paiements 2x plus vite en complétant votre vérification !"
- Après KYC : "🚀 Félicitations ! Votre profil certifié attire 40% plus de réservations"

---

## 🔧 **3. Modifications techniques**

### **Backend (Node.js/Express)**
```javascript
// Nouveau modèle User
const userSchema = new Schema({
  stripeId: String,
  kycStatus: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'incomplete'] 
  },
  stripeConnectId: String, // Pour conductrices vérifiées
  lastPayoutDate: Date
});

// Handler webhook account.updated
router.post('/webhook', async (req, res) => {
  if (req.body.type === 'account.updated') {
    const account = req.body.data.object;
    await User.updateOne(
      { stripeConnectId: account.id },
      { kycStatus: account.requirements.disabled_reason ? 'incomplete' : 'verified' }
    );
  }
});
```

### **Frontend Flutter**
```dart
// Écran de progression KYC
KyCProgressBar(
  steps: const [
    KyCStep("Identité", completed: true),
    KyCStep("Selfie", completed: true),
    KyCStep("Domicile", completed: false),
  ],
  onComplete: _enableDriverPayouts,
)
```

---

## 📊 **4. Événements Stripe étendus**

### **Nouveaux événements critiques**
```javascript
// Suivi KYC
✅ account.updated
✅ identity.verification_session.created
✅ identity.verification_session.verified

// Transferts conductrices
✅ transfer.created
✅ transfer.paid
✅ transfer.failed
```

### **Workflow de sécurité**
```mermaid
graph LR
    W[Webhook Stripe] --> V{Vérifier signature}
    V -->|Valide| T[Traitement]
    V -->|Invalide| R[Rejet immédiat]
    T --> D[(Database Update)]
    T --> N[Notification utilisatrice]
```

---

## 🚀 **Plan d'implémentation révisé**

### **Phase 1 : Abonnements + KYC Foundation**
1. Intégration Stripe Identity SDK
2. Workflow d'onboarding conductrices
3. Stockage statut KYC dans MongoDB

### **Phase 2 : Paiements trajets avec KYC intégré**
```mermaid
gantt
    title Roadmap Paiements
    dateFormat  YYYY-MM-DD
    section KYC
    Intégration Identity     :a1, 2024-06-01, 14d
    Workflow vérification    :a2, after a1, 10d
    section Paiements
    Split dynamique          :b1, 2024-06-15, 14d
    Transferts automatisés   :b2, after b1, 7d
```

### **Phase 3 : Optimisation**
1. Système de retry pour transferts échoués
2. Dashboard conductrice avec suivi paiements
3. Alertes KYC expirant (tous les 24 mois)

---

## 💡 **Bonnes pratiques recommandées**

1. **Limites sans KYC :**
   - Max 3 trajets sans vérification
   - Paiements bloqués après 30 jours
   
2. **Incentives :**
   ```javascript
   // Après complétion KYC
   await stripe.payouts.create({
     amount: 500, // 5€ bonus
     currency: 'eur',
     destination: driver.stripeConnectId
   });
   ```

3. **Monitoring :**
   ```bash
   # Logs critiques à tracker
   "KYC_FAILED"
   "TRANSFER_RETRY"
   "PAYOUT_DELAYED"
   ```

Cette documentation intègre la gestion KYC comme composant central tout en maintenant l'architecture technique existante. La séparation paiement trajet/commission est maintenue via les transferts Stripe Connect après vérification KYC.
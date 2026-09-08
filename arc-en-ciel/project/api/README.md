# Automatisation — envoi des demandes de proposition

À chaque envoi du formulaire (`/contact`), la fonction `api/lead.mjs` transmet le brief
**automatiquement**, sans action du prospect :

1. **E-mail** vers la boîte pro de la Maison, avec les photos d'inspiration en pièces jointes ;
2. **WhatsApp** vers le numéro de la Maison, sous forme de résumé court.

Tant que les clés ne sont pas renseignées, le formulaire **bascule tout seul** sur l'ouverture
du client mail (comportement précédent) — le site reste fonctionnel à tout moment.

---

## Mise en service (5 min) — Vercel → Settings → Environment Variables

### 1. E-mail (obligatoire pour l'envoi auto) — via [Resend](https://resend.com)

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | la clé API Resend (`re_...`) |
| `LEAD_TO_EMAIL` | `arcenciel.event.groupe@gmail.com` *(défaut si non défini)* |
| `LEAD_FROM_EMAIL` | `Arc en Ciel <no-reply@votre-domaine.com>` — adresse d'un **domaine vérifié** dans Resend. Pour un test rapide : `Arc en Ciel <onboarding@resend.dev>` (n'envoie qu'à l'e-mail du compte Resend). |

Resend : créer un compte gratuit → *API Keys* → *Create* → copier la clé.
Pour la production : *Domains* → ajouter votre domaine → suivre les enregistrements DNS.

### 2. WhatsApp — **une** des deux options

#### Option A · Twilio *(recommandé en production)* — [twilio.com](https://twilio.com)

| Variable | Valeur |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC...` |
| `TWILIO_AUTH_TOKEN` | jeton du compte |
| `TWILIO_WHATSAPP_FROM` | numéro WhatsApp Twilio, format `+14155238886` |
| `LEAD_WHATSAPP_TO` | numéro de la Maison, format E.164 : `+237653267335` |

#### Option B · CallMeBot *(gratuit, immédiat)* — [guide](https://www.callmebot.com/blog/free-api-whatsapp-messages/)

| Variable | Valeur |
|---|---|
| `CALLMEBOT_PHONE` | `+237653267335` |
| `CALLMEBOT_APIKEY` | clé reçue après avoir envoyé `I allow callmebot to send me messages` au numéro CallMeBot |

Si aucune variable WhatsApp n'est définie → seul l'e-mail part (sans erreur).

---

## Après avoir ajouté les variables

Redéployer (Vercel → *Deployments* → *Redeploy*, ou un nouveau `git push`).
Tester via le formulaire : la page de confirmation affichera
« Votre demande vient d'être transmise… par e-mail et par WhatsApp ».

## Notes

- Limite de corps de requête Vercel ≈ 4,5 Mo : les images sont compressées côté navigateur
  (~1400 px, JPEG) et plafonnées à ~3 Mo au total avant envoi.
- Anti-spam : champ leurre (honeypot) + rejet des envois en moins de 3 s.
- Aucune clé n'est exposée côté client — tout se passe dans la fonction serverless.

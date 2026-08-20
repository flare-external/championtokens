# Champion Tokens 🏆

A Fortnite wager match platform where players create and join token-based matches. Login with Discord.

---

## 🔧 Setup — Step by Step

### 1. Create a Discord Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Name it `Champion Tokens`
3. Go to **OAuth2** → **General**
4. Copy your **Client ID**
5. Copy your **Client Secret** (click Reset Secret if needed)
6. Under **Redirects**, add your callback URL:
   - For local testing: `http://localhost:5500/callback.html` (or your local server)
   - For GitHub Pages: `https://<username>.github.io/<repo>/callback.html`
   - For Firebase Hosting: `https://<your-project>.web.app/callback.html`

### 2. Set Up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Authentication** → Sign-in method → Enable **Custom** (scroll down, enable "Custom token")
3. **Firestore Database** → Create database → Test mode
4. **⚠️ Upgrade to Blaze plan** (Project Settings → Upgrade) — required for Cloud Functions to call Discord's API
5. **Project Settings** → Your apps → Add Web app → Copy the `firebaseConfig`

### 3. Fill in Your Config

**`js/firebase-config.js`**:
```js
const firebaseConfig = {
  apiKey:            "...",   // ← from Firebase Console
  authDomain:        "...",
  projectId:         "...",
  storageBucket:     "...",
  messagingSenderId: "...",
  appId:             "..."
};
const DISCORD_CLIENT_ID  = "...";   // ← from Discord Developer Portal
const CLOUD_FUNCTION_URL = "https://us-central1-YOUR_PROJECT.cloudfunctions.net/discordAuth";
```

### 4. Deploy the Cloud Function

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID

# Set your Discord Client ID as a runtime env var
firebase functions:config:set discord.client_id="YOUR_CLIENT_ID"

# Set your Discord Client Secret securely (never put this in code)
firebase functions:secrets:set DISCORD_CLIENT_SECRET
# (paste your secret when prompted)

# Install Cloud Function dependencies
cd functions && npm install && cd ..

# Deploy
firebase deploy --only functions
```

After deploying, find the function URL in **Firebase Console → Functions** and paste it into `js/firebase-config.js` as `CLOUD_FUNCTION_URL`.

### 5. Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Or paste `firestore.rules` manually in **Firebase Console → Firestore → Rules**.

### 6. Deploy to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Source: `main` branch, root `/`
4. Site will be live at `https://<username>.github.io/<repo>/`
5. Add this URL to your Discord app's **OAuth2 Redirects**

---

## 📁 File Structure

```
Champ tokens/
├── index.html              ← Landing page + Discord login
├── callback.html           ← Discord OAuth callback handler
├── dashboard.html          ← Token balance, daily claim, activity
├── matches.html            ← Browse / create / join matches
├── leaderboard.html        ← Top 10 token holders
├── shop.html               ← Token shop (coming soon)
├── profile.html            ← Stats + transaction history
├── css/
│   └── style.css           ← Full design system
├── js/
│   ├── firebase-config.js  ← ⚠️ Fill in your config here
│   ├── auth.js             ← Discord OAuth helpers
│   ├── db.js               ← All Firestore operations
│   └── nav.js              ← Shared nav + toasts + helpers
├── functions/
│   ├── index.js            ← Cloud Function: Discord → Firebase token
│   └── package.json
├── firebase.json           ← Firebase project config
├── firestore.rules         ← Security rules
├── firestore.indexes.json  ← Composite indexes
└── README.md
```

---

## 🎮 Token Economy

| Action              | Tokens  |
|---------------------|---------|
| Welcome bonus       | +500    |
| Daily claim         | +100    |
| Win a match         | +90% of prize pool |
| Match wager (entry) | −wager amount |
| Platform fee        | 10% of prize pool |

---

## ✨ Features

- 🎮 Discord Sign-In (OAuth2)
- ⚡ Firebase custom token auth
- 🎯 Create wager matches (Solo / Duos / Squads)
- 🔗 Join by 6-character match code
- 📡 Real-time match updates via Firestore
- 🏆 Global leaderboard with podium
- 🎁 Daily free token claim (100/day)
- 📊 Transaction history + match history
- 🛒 Token shop (placeholder, coming soon)

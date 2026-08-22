// ============================================================
//  CHAMPION TOKENS — Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyBfLI4n8KM6dsRWcoT2KKyAvsbMsjUut7U",
  authDomain:        "champion-tokens.firebaseapp.com",
  projectId:         "champion-tokens",
  storageBucket:     "champion-tokens.firebasestorage.app",
  messagingSenderId: "113073952486",
  appId:             "1:113073952486:web:1f4ce6c8b196aa4a044d27"
};

// ── Discord OAuth Config ──────────────────────────────────────
// Client ID is safe in the browser. Secret lives only in the Cloud Function.
const DISCORD_CLIENT_ID = "1540084692873912470";

// Direct live serverless backend endpoint (works across all hosting providers)
const CLOUD_FUNCTION_URL = "https://championtokens.netlify.app/.netlify/functions/discordAuth";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

# Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (free tier works perfectly)
- Firebase project configured

## Deploy to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"New Project"**
3. Import your `fantasy-hockey-draft` repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables (if needed):
   - Firebase config is already in your code
6. Click **Deploy**

### 3. How It Works

#### CORS Proxy
The `vercel.json` file configures Vercel to proxy NHL API requests:
- Your app requests: `/api/web/v1/roster/VAN/current`
- Vercel fetches from: `https://api-web.nhle.com/v1/roster/VAN/current`
- Returns data to your app (no CORS errors!)

#### Environment Detection
The app automatically switches between:
- **Development** (localhost): Uses Vite proxy at `/v1`
- **Production** (Vercel): Uses Vercel proxy at `/api/web/v1`

#### Firebase
Firebase works the same in both environments:
- Authentication
- Firestore database
- Real-time updates

## Testing

After deployment:
1. Visit your Vercel URL (e.g., `fantasy-hockey-draft.vercel.app`)
2. Sign in with Google
3. Browse NHL rosters (should load real data!)
4. Create/join leagues
5. Start drafting!

## Sharing with Friends

1. Send them your Vercel URL
2. They sign in with Google
3. You add their Firebase UID to your league
4. They can draft from any browser/device!

## Troubleshooting

### API not loading?
- Check Vercel deployment logs
- Verify `vercel.json` is in root directory
- Check browser console for errors

### Authentication issues?
- Verify Firebase config in `src/firebase.ts`
- Add your Vercel domain to Firebase authorized domains:
  - Firebase Console → Authentication → Settings → Authorized domains

### Database errors?
- Check Firestore rules allow authenticated access
- Verify your Firebase project is active

## Local Development

```bash
npm install
npm run dev
```

Vite proxy handles CORS locally (configured in `vite.config.ts`)

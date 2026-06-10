# Fantasy Hockey Draft

A **real-time fantasy hockey draft application** built with React, TypeScript, Firebase, and the NHL API. The app provides a complete fantasy hockey league experience including live drafting, automated daily scoring, real-time game stats, roster management, injury tracking, and league chat.

> ⚠️ **Current Status: Single-League Demo**  
> Currently, the app is hardcoded to run a single active league for demonstration purposes. Multi-tenancy (supporting multiple different leagues simultaneously) is planned for v2.

---

## 🎯 Core Features

### 1. **Snake Draft System**
- **Real-time snake draft** - picks alternate direction each round (Round 1: 1→4, Round 2: 4→1, etc.)
- **Live draft board** - visual grid showing all picks across all teams and rounds
- **Turn-based drafting** - clear indicators for whose turn it is
- **Position enforcement** - enforces roster requirements (9F, 6D, 2G, 5 reserves)
- **Draft status tracking** - real-time updates via Firestore listeners
- **Auto-complete draft** - smart AI feature to automatically fill remaining picks based on roster needs
- **Draft celebration** - confetti animation when you draft a player

### 2. **Automated Scoring Engine**
- **Scheduled backfill + scoring** - Vercel cron jobs run `/api/fetch-daily-stats` at 4:30 AM UTC and `/api/calculate-scores` at 5:00 AM UTC
- **NHL API integration** - fetches boxscores from the previous New York hockey day
- **Fantasy point calculation** - based on customizable scoring rules:
  - **Skaters**: Goals (1pt), Assists (1pt), SH Goals (+1 bonus), OT Goals (+1 bonus), Fights (2pts)
  - **Defense**: Blocked Shots (0.15pts), Hits (0.1pts)
  - **Goalies**: Wins (1pt), Shutouts (2pts), Saves (0.04pts), Assists (1pt), Goals (20pts!), Fights (5pts)
- **Team standings** - automatic calculation of total points, wins, losses
- **Player performance tracking** - stores daily stats for each player
- **Idempotent scoring** - prevents duplicate scoring for same date

### 3. **Live Stats Tracking** 
- **Real-time game stats** - Firestore-backed live stats update in the UI with manual/admin refresh support
- **Hockey day logic** - games show until 3 AM ET to ensure all games finish before day rolls over
- **Today's Matchups** - see your players' games with team logos and game times
- **Player Performance** - detailed stats table (G, A, H, BS, F, W, Sv, Pts) for all teams
- **Live game indicators** - shows which games are LIVE vs FINAL with color-coded borders
- **Auto-updating UI** - stats update automatically via Firestore real-time listeners
- **Team totals** - see each fantasy team's total points for the day

### 4. **Roster Management**
- **Active/Reserve system** - 17 active players (9F/6D/2G) + 5 reserves
- **Player swapping** - swap players between active and reserve rosters
- **Flexible forward swaps** - any forward position (C/L/R) can swap with any other forward
- **Position validation** - defensemen and goalies must swap with same position
- **Pending swap system** - swaps are scheduled for next Saturday at 5 AM
- **Swap cancellation** - cancel pending swaps before they apply
- **Visual indicators** - clear badges showing pending swaps
- **Roster lock schedule** - displays next roster lock date/time

### 5. **Injury Tracking**
- **Real-time NHL injury data** - fetches from sportsdata.io API
- **Injury status badges** - IR (Injured Reserve), DTD (Day-to-Day), O (Out), Q (Questionable)
- **Visual indicators** - color-coded injury icons throughout the app
- **Smart caching** - React Query caches injury data for 5 minutes
- **Auto-refresh** - injury data refreshes automatically in background
- **Injury details** - hover to see injury type and description

### 6. **League Chat**
- **Real-time messaging** - instant chat updates via Firestore
- **User identification** - shows sender name and timestamp
- **Auto-scroll to latest** - automatically scrolls to newest messages
- **Admin moderation** - league admins can delete messages and ban users
- **Ban management** - banned users cannot send messages
- **Emoji support** - full emoji support in messages

### 7. **Dashboard**
- **Season points display** - your total points vs league average
- **Today's live stats** - real-time points from games in progress
- **Player matchups** - see which of your players are playing today with game times
- **7-day trend chart** - visual graph of your team's performance vs league average
- **League Feed** - real-time activity feed with roster moves, injuries, and chat messages
- **Waiver Wire / Hot Pickups** - top available free agents with player headshots and team logos
- **Team Health card** - injury status for your roster with quick navigation to IR management
- **Quick actions** - "Set Lines" and "View Schedule" buttons

### 8. **Player Browsing**
- **Browse by NHL team** - dropdown selector for all 32 NHL teams
- **Position filtering** - filter by F/D/G or "All Positions"
- **Player cards** - beautiful cards with player info, position, jersey number
- **Draft status** - shows if player is already drafted (and by whom)
- **One-click drafting** - "Draft Player" button (only on your turn)
- **Best Available** - see top available players by position
- **Position Scarcity** - shows how many players left at each position
- **Player Comparison** - select multiple players and compare side-by-side

### 9. **League Settings**
- **Create/Update leagues** - admin can create new leagues or update existing ones
- **Team management** - add/remove teams, set team names and owner UIDs
- **Draft rounds configuration** - set number of draft rounds (default: 22)
- **Roster settings** - configure forwards/defense/goalies requirements
- **Start draft button** - admin can start draft when ready
- **Draft reset** - admin can reset draft and clear all picks (danger zone)
- **Test scoring button** - manually trigger scoring for testing (admin only)
- **Test live stats button** - manually update live stats (admin only)
- **Admin player management** - admin tools for managing drafted players

### 10. **Standings Page**
- **Team rankings** - sorted by total fantasy points (descending)
- **Win/Loss records** - displays each team's W-L record
- **Last updated timestamp** - shows when standings were last calculated
- **Scoring rules reference** - collapsible section showing all scoring rules
- **Player performances** - daily stats grouped by team
- **Live stats section** - embedded live game stats for all teams
- **Visual highlights** - first place (gold), last place (red) highlighting

---

## 📸 Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.png)
*Season overview with live game status, matchups, league feed, team health, and waiver wire pickups*

### NHL Rosters
![NHL Rosters](screenshots/nhl-rosters.png)
*Browse and search NHL players by team and position with real-time availability*

### Draft Board
![Draft Board](screenshots/draft-board.png)
*Visual snake draft grid showing all picks across teams and rounds*

### Standings
![Standings](screenshots/standings.png)
*League standings with real-time point totals and rankings*

### Live Stats
![Live Stats](screenshots/live-stats.png)
*Real-time game stats tracking for all your players during NHL games*

---

## 🛠️ Technical Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **React Query (TanStack Query)** - Smart data fetching and caching
- **Sonner** - Beautiful toast notifications
- **React Confetti** - Celebration effects

### Backend & Database
- **Firebase Firestore** - Real-time NoSQL database
- **Firebase Authentication** - Google sign-in
- **Firestore Security Rules** - Row-level security
- **Vercel Serverless Functions** - API endpoints
- **Vercel Cron Jobs** - Scheduled stats backfill and score calculation

### APIs
- **NHL API (api-web.nhle.com)** - Official NHL player rosters and game stats
- **SportsData.io** - NHL injury reports

### Deployment
- **Vercel** - Frontend hosting, serverless functions, cron jobs
- **Firebase Hosting** - Alternative hosting option configured
- **GitHub** - Version control

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase account
- Vercel account (for deployment)
- SportsData.io API key (for injury tracking)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fantasy-hockey-draft.git
   cd fantasy-hockey-draft
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.local.example` to `.env.local` and fill in the real values:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=
   CRON_SECRET=your_secret_string
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
   ```

   `CRON_SECRET` and `FIREBASE_SERVICE_ACCOUNT_KEY` are server-only values used by the privileged Vercel API routes. Keep `.env.local` untracked.

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open the app**
   
   Navigate to `http://localhost:5173`

---

## 📚 Documentation

- [SCORING.md](./docs/SCORING.md) - Detailed scoring system documentation
- [DRAFT_SETUP.md](./docs/DRAFT_SETUP.md) - Draft setup guide and roster requirements
- [LIVE_STATS.md](./docs/LIVE_STATS.md) - Live stats feature documentation
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment instructions

---

## 🎮 Usage

### Creating a League
1. Sign in with Google
2. Go to League Settings
3. Enter league name and configure draft rounds
4. Add teams and assign owner UIDs
5. Click "Create League"
6. Share your league ID with other players

### Starting a Draft
1. Go to League Settings (admin only)
2. Click "Start Draft"
3. League status changes to "Live"
4. Users can now draft in turn order

### Drafting Players
1. Go to "NHL Rosters" tab
2. Select an NHL team from the dropdown
3. Filter by position if desired
4. When it's your turn, click "Draft Player" on any available player
5. Player is added to your roster
6. Draft automatically advances to next pick

### Managing Your Roster
1. Go to "My Players" tab
2. View your active roster (9F/6D/2G) and reserves (5 players)
3. Click "Select to Swap" on a player
4. Click another player in the opposite roster to swap them
5. Swaps are scheduled for next Saturday at 5 AM
6. Cancel pending swaps anytime before they apply

---

## 🔐 Security

### Firestore Security Rules
- **Authentication required** - all operations require sign-in
- **League admin privileges** - only league creator can modify settings, start draft, reset
- **User isolation** - users can only modify their own league's data
- **Roster updates** - league members can swap their own players
- **Chat moderation** - admins can delete messages and ban users

See `firestore.rules` for the full security rule definitions.

---

## 🧪 Testing

### Local Verification
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm --prefix functions run build`

GitHub Actions runs the same checks on pull requests via `.github/workflows/ci.yml`.

### Admin Developer Tools (League Settings)
- **Test Scoring** - Manually trigger scoring for any date
- **Test Live Stats** - Manually update live stats
- **Draft Reset** - Clear all picks and reset draft state
- **Admin Player Management** - View and manage all drafted players
- **Auto-Complete Draft** - Fill remaining picks with AI logic

---

## 📁 Project Structure

```
fantasy-hockey-draft/
├── api/                      # Vercel serverless functions
│   ├── calculate-scores.ts   # Daily scoring cron job
│   ├── fetch-daily-stats.ts  # NHL stats backfill
│   ├── live-stats.ts         # Live game stats endpoint
│   └── nhl-schedule.ts       # NHL schedule proxy
├── src/
│   ├── components/           # React components
│   │   ├── admin/            # Admin-only components (future)
│   │   ├── draft/            # Draft-related components
│   │   ├── roster/           # Player cards and roster UI
│   │   ├── ui/               # Reusable UI components
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── LiveStats.tsx     # Live game stats
│   │   ├── Standings.tsx     # League standings
│   │   └── ...
│   ├── context/              # React contexts
│   │   ├── AuthContext.tsx   # Firebase auth
│   │   ├── DraftContext.tsx  # Draft state management
│   │   ├── LeagueContext.tsx # League data
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   │   ├── liveStats.ts      # Live stats processing
│   │   ├── nhlApi.ts         # NHL API helpers
│   │   └── ...
│   ├── types/                # TypeScript type definitions
│   └── queries/              # React Query hooks
├── firestore.rules           # Firestore security rules
├── vercel.json               # Vercel config (crons, rewrites)
└── README.md
```

---

## 📈 Performance

- **Code splitting** - Lazy loading of components with retry logic
- **React Query caching** - Automatic caching of API responses
- **Virtualized lists** - React Virtuoso for large player lists
- **Firestore listeners** - Efficient real-time subscriptions
- **Indexed queries** - Optimized Firestore queries
- **Image optimization** - NHL team logos and player headshots from CDN

---

## 🐛 Known Issues & Limitations

- **Injury data** - Depends on sportsdata.io API (requires API key)
- **NHL API rate limits** - No official rate limit, but should respect fair use
- **Firestore costs** - Free tier allows 50k reads/day, 20k writes/day

- **No trades** - Players cannot be traded between teams (future feature)
- **No waiver wire** - Cannot pick up undrafted players mid-season (future)

---

## 🔮 Future Enhancements


- [ ] Trade system between teams
- [ ] Waiver wire / free agent pickups
- [ ] Weekly head-to-head matchups
- [ ] Playoff bracket system
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] Player performance graphs
- [ ] Advanced stats
- [ ] Discord/Slack integration

---

## 🤝 Contributing

This is a personal project, but contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Built with ❤️ by Dolph

---

## 🙏 Acknowledgments

- **NHL API** - Thank you NHL for providing free access to player and game data
- **SportsData.io** - Injury data API
- **Firebase** - Backend infrastructure
- **Vercel** - Hosting and serverless functions
- **React Community** - Amazing ecosystem and tools
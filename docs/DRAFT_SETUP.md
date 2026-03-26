# Draft Setup Guide

## Roster Requirements

Your league roster settings require:
- **9 Forwards** (C, L, R positions)
- **6 Defensemen** (D position)  
- **2 Goalies** (G position)
- **5 Reserves** (any position)

**Total: 22 picks per team**

## Setting Draft Rounds

When creating a league in League Settings, set **Draft Rounds** to **22** (not 15).

This ensures each team can draft a full roster:
- Rounds 1-9: Forwards
- Rounds 10-15: Defensemen
- Rounds 16-17: Goalies
- Rounds 18-22: Reserves (any position)

## Position Limits During Draft

The app will enforce position limits during the draft:

### First 17 Picks (Required Positions)
- **Can only draft Forwards** until you have 9
- **Can only draft Defense** until you have 6  
- **Can only draft Goalies** until you have 2

### Last 5 Picks (Reserves)
- **Can draft any position** - these are your bench/reserves

## Updating Existing League

If you already created a league with 15 rounds, you need to update it:

### Option 1: Via Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Firestore Database
3. Find your league document in `leagues` collection
4. Edit the `draftRounds` field to `22`
5. Reset the draft in League Settings

### Option 2: Via Browser Console
```javascript
// Run this in browser console (F12)
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

await updateDoc(doc(db, 'leagues', 'league-1763062527074'), {
  draftRounds: 22
});
```

### Option 3: Create New League
Simply create a new league with 22 draft rounds from the start.

## Position Enforcement

The position limits are enforced in real-time:
- Your position counts update instantly after each pick
- The app shows: `F: 5/9, D: 2/6, G: 0/2`
- You'll see an error if you try to draft a full position
- Once you reach 17 picks, reserves allow any position

## Example Draft Flow (2 Teams)

**Round 1 (Pick 1-2):**  
- My Team picks Forward #1
- Friend 1 picks Forward #1

**Round 2 (Pick 3-4):**  
- Friend 1 picks Forward #2 (snake!)  
- My Team picks Forward #2

... continue until round 22 ...

**Round 22 (Pick 43-44):**
- My Team picks Reserve #5 (can be any position!)
- Friend 1 picks Reserve #5

## Troubleshooting

**"I drafted 13 forwards and only 2 defense!"**
→ Your league was set to 15 rounds instead of 22. Update to 22 rounds and redraft.

**"Position limits aren't working"**
→ Make sure your league has `scoringRules` and `rosterSettings` configured. Run:
```javascript
addScoringRulesToLeague("your-league-id")
```

**"Can I change roster settings?"**
→ Yes, but you'll need to reset the draft. Edit `rosterSettings` in Firestore.

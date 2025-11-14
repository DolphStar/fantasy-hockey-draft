# 🔒 Security Setup - CRITICAL

## Current Status: ⚠️ INSECURE

Your Firestore database is currently **wide open** without security rules. Anyone could potentially modify your data.

## What the Security Rules Do

The `firestore.rules` file I just created ensures:

✅ **Only authenticated users** can access data  
✅ **Only league admin** can modify league settings  
✅ **Only league admin** can change admin status  
✅ **Only league members** can see league data  
✅ **Only league admin** can reset drafts  
✅ **Users can't modify** drafted players after drafting  
✅ **Turn-based drafting** is enforced at database level  

## How to Deploy Security Rules

### Option 1: Firebase Console (Easiest)

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com
   - Select your project

2. **Navigate to Firestore Rules:**
   - Click **Firestore Database** in left sidebar
   - Click **Rules** tab at top

3. **Copy and Paste:**
   - Open `firestore.rules` file in your project
   - Copy ALL the content
   - Paste into Firebase Console editor
   - Click **Publish**

4. **Verify:**
   - You should see "Rules published successfully"
   - Rules take effect immediately

### Option 2: Firebase CLI (Advanced)

If you have Firebase CLI installed:

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## Testing After Deployment

### Test 1: Anonymous Access (Should Fail)
Open browser in **Incognito mode** (not signed in):
- Try to open your app
- Should NOT be able to see any league data ✅

### Test 2: Admin Access (Should Work)
As the league creator (admin):
- ✅ Can see all league data
- ✅ Can update league settings
- ✅ Can reset draft
- ✅ Can run test scoring

### Test 3: League Member Access (Limited)
As a non-admin league member:
- ✅ Can see league data
- ✅ Can draft players
- ❌ CANNOT update league settings
- ❌ CANNOT reset draft
- ❌ CANNOT change admin

### Test 4: Non-Member Access (Should Fail)
As a user NOT in the league:
- ❌ CANNOT see league data
- ❌ CANNOT draft players
- ❌ CANNOT see scores

## What Each Rule Does

### League Rules
```
- Read: Anyone authenticated (to find their league)
- Create: Anyone authenticated (becomes admin)
- Update: Only league admin
- Delete: Only league admin
```

### Drafted Players
```
- Read: Anyone authenticated
- Create: Anyone authenticated (turn checked in code)
- Update: NOBODY (drafted = final)
- Delete: Only league admin (for reset)
```

### Draft State
```
- Read: League members only
- Write: League members (to advance picks)
- Delete: Only admin (to reset)
```

### Scores & Stats
```
- Read: League members only
- Write: Admin only (for manual testing)
```

## Security Best Practices

1. **Never share your Firebase service account key**
   - Currently in environment variables (good!)
   - Don't commit to Git

2. **Keep admin UID secret**
   - Only share league join info, not admin status
   - Admin can't be changed through UI

3. **Regular audits**
   - Check Firebase Console → Authentication → Users
   - Remove any suspicious accounts

4. **Monitor usage**
   - Firebase Console → Usage tab
   - Check for unusual activity

## Emergency: If Someone Gets Unauthorized Access

1. **Immediately disable user:**
   - Firebase Console → Authentication
   - Find user → Click "..." → Disable user

2. **Check damage:**
   - Firestore Database → Data tab
   - Look for modified documents
   - Check document history if available

3. **Reset if needed:**
   - Use "Reset Draft" if draft was compromised
   - Manually fix league settings if changed
   - Restore from backup if severe

4. **Update rules:**
   - Make rules even stricter if needed
   - Add additional validation

## Current Vulnerabilities (BEFORE Deploying Rules)

❌ **Anyone can:**
- Change league admin
- Draft for any team
- Modify scores
- Delete leagues
- See all leagues

🔒 **After deploying rules:**
- ✅ All of the above are blocked
- ✅ Only authorized actions allowed
- ✅ Database is secure

## DEPLOY THESE RULES NOW!

This is **critical** for your app's security. Takes 2 minutes via Firebase Console.

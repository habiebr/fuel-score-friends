# One-Time Historical Resync - Quick Guide

## 🎯 What This Does

Adds session data (workout types, times, etc.) to **all existing Google Fit records** for **all users** in one simple run.

## ⚡ Quick Start (3 Steps)

### Step 1: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api
2. Find the **service_role** key (NOT the anon key)
3. Copy it

### Step 2: Run Setup Script

```bash
./setup-and-run-resync.sh
```

This will:
- Ask you to paste your service role key
- Save it to `.env`
- Run the resync automatically

**OR manually add to `.env`:**

```bash
echo "SUPABASE_SERVICE_ROLE_KEY=your-key-here" >> .env
```

### Step 3: Run Resync

```bash
node resync-historical-sessions.js
```

## 📊 What You'll See

```
╔════════════════════════════════════════════════════════╗
║   One-Time Historical Resync - Add Session Data       ║
╚════════════════════════════════════════════════════════╝

✅ Found 3 user(s) with Google Fit connected

[1/3] Processing user...
  ✅ 2024-10-10: Added 2 session(s)
  ✅ 2024-10-09: Added 1 session(s)
  🎯 Updated 15 days with 28 total sessions

╔════════════════════════════════════════════════════════╗
║                    RESYNC COMPLETE                     ║
╚════════════════════════════════════════════════════════╝

📊 Summary:
   • Users processed:     3
   • Sessions added:      40
```

## ✅ Verify Results

```sql
-- Check which days now have sessions
SELECT 
  date,
  jsonb_array_length(sessions) as session_count
FROM google_fit_data
WHERE user_id = 'your-user-id'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

## 🔒 Safety Features

- ✅ **Safe to run multiple times** - won't duplicate sessions
- ✅ **Only adds data** - doesn't delete anything
- ✅ **Auto-refreshes tokens** - handles expired tokens
- ✅ **Rate limited** - respects Google API limits
- ✅ **Continues on errors** - one user's error doesn't stop others

## 📝 Files

- **`resync-historical-sessions.js`** - Main script
- **`setup-and-run-resync.sh`** - Setup helper
- **`RESYNC_HISTORICAL_SESSIONS_README.md`** - Full documentation

## ⚙️ Configuration

Edit in `resync-historical-sessions.js`:

```javascript
const DAYS_BACK = 30;  // How many days to resync (default: 30)
```

## 🆘 Troubleshooting

**No users found:**
- Users need to have Google Fit connected in your app

**Token expired:**
- Script auto-refreshes, but if it fails, user needs to reconnect Google Fit

**No sessions added:**
- Normal if users didn't log workouts or already have sessions

**Missing environment variables:**
- Run `./setup-and-run-resync.sh` to add them

## 🎉 After Resync

1. ✅ Sessions added to `google_fit_data.sessions`
2. ✅ Sessions stored in `google_fit_sessions` table
3. ✅ Ready to display workout details in your app
4. ✅ Activity types available for analysis

## 📚 Full Documentation

See `RESYNC_HISTORICAL_SESSIONS_README.md` for:
- Detailed configuration
- SQL verification queries
- Performance notes
- Full troubleshooting guide

---

**Ready?** Run: `./setup-and-run-resync.sh` 🚀

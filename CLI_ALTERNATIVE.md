# 🔧 CLI Alternative: Manual Column Addition

## 🚨 **CLI Issues Summary**
The Supabase CLI is having **network connectivity issues** with your Singapore region database:
- `dial tcp: connection refused` errors
- Pooler connection failures
- Migration history sync problems

## 🎯 **Solution: Manual SQL Execution**

### **Step 1: Get Your Supabase Anon Key**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your "nutrisync" project
3. Go to **Settings** → **API**
4. Copy your **anon/public key** (starts with `eyJ...`)

### **Step 2: Run SQL in Supabase Dashboard**
1. Go to **SQL Editor** → **New Query**
2. Copy and paste this SQL:

```sql
-- Add missing columns for goals functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS fitness_level TEXT;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('target_date', 'fitness_level')
ORDER BY column_name;
```

3. Click **"Run"**

### **Step 3: Update App Environment**
Create a `.env` file in your project root:

```bash
VITE_SUPABASE_URL=https://eecdbddpzwedficnpenm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_actual_anon_key_here
```

Replace `your_actual_anon_key_here` with the key from Step 1.

### **Step 4: Test the App**
1. Run `npm run dev`
2. Go to Goals page
3. Try the two-step flow
4. Save should work now! ✅

## 🔍 **Why CLI Failed**
- **Network issues** with Singapore region pooler
- **Migration history sync** problems
- **Connection timeouts** to database

## ✅ **Manual Method Benefits**
- **Faster** (2 minutes vs debugging CLI)
- **More reliable** (direct database access)
- **Immediate results** (no network issues)
- **Safer** (won't accidentally recreate tables)

## 🎉 **Expected Result**
After running the SQL manually, your goals save functionality will work perfectly!

# Deploy Morning Reminders - Quick Setup

## ✅ Step 1: Edge Function Deployed
The Edge Function `send-morning-reminders` has been deployed successfully!

## ⏰ Step 2: Set Up Cron Schedule

You have two options:

### Option A: Supabase pg_cron (If Available)

1. **Get your Supabase anon key:**
   - Go to: Supabase Dashboard → Settings → API
   - Copy the **anon/public** key

2. **Update the SQL file:**
   - Open `SETUP_MORNING_REMINDERS_CRON.sql`
   - Replace the anon key in the Authorization header with your actual anon key

3. **Run the SQL:**
   - Go to: Supabase Dashboard → SQL Editor
   - Paste and run the contents of `SETUP_MORNING_REMINDERS_CRON.sql`
   - If you get an error about pg_cron not being available, use Option B

### Option B: External Cron Service (Recommended - More Reliable)

#### Using cron-job.org (Free):

1. **Go to:** https://cron-job.org/
2. **Sign up** for a free account
3. **Click "Create cronjob"**
4. **Fill in:**
   - **Title**: NFG Morning Reminders
   - **Address**: `https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders`
   - **Schedule**: `30 13 * * 1-5` (8:30 AM Eastern Monday-Friday)
   - **Request method**: POST
   - **Request headers**:
     ```
     Authorization: Bearer YOUR_ANON_KEY_HERE
     Content-Type: application/json
     ```
   - **Request body**: `{}`
5. **Click "Create cronjob"**

**Note:** Replace `YOUR_ANON_KEY_HERE` with your Supabase anon key from Dashboard → Settings → API

#### Timezone:
- Default: `30 13 * * 1-5` = 8:30 AM Eastern (Mon–Fri)
- PST: `30 16 * * 1-5` | CST: `30 14 * * 1-5` | UTC: `30 8 * * 1-5`

### Fix: Notifications at 3:30 AM instead of 8:30 AM?

The cron was set to 8:30 **UTC** (3:30 AM Eastern). To fix, run **`FIX_MORNING_REMINDERS_830AM.sql`** in the Supabase SQL Editor. It reschedules the job to **8:30 AM Eastern** (13:30 UTC).

## 🧪 Step 3: Test the Function

Test manually to verify it works:

```bash
curl -X POST "https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response on weekdays:**
```json
{
  "success": true,
  "message": "Morning reminders sent successfully",
  "users_notified": 5,
  "quote": "Discipline is choosing between what you want now and what you want most.",
  "day": "Monday"
}
```

**Expected response on weekends:**
```json
{
  "success": true,
  "message": "Not a weekday, no reminders sent",
  "day": "Saturday"
}
```

## ✅ Verification

After setup, check:
1. **Notifications table:** Should see new notifications with `type = 'system'` and `metadata->>'reminder_type' = 'morning_motivation'`
2. **Cron logs:** Check your cron service dashboard for execution logs
3. **Edge Function logs:** Supabase Dashboard → Edge Functions → send-morning-reminders → Logs

## 📝 Next Steps

Once the cron is set up, the system will automatically:
- Run every weekday at 8:30 AM Eastern
- Send a random motivational quote to all active users
- Create notifications that trigger your existing email/push system

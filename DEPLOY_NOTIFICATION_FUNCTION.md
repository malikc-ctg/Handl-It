# 🚀 Deploy Notification Email Function

Your `send-notification-email` function exists but needs to be deployed!

## Option 1: Deploy via Supabase CLI (Recommended)

### Step 1: Make sure you're logged in
```bash
supabase login
```

### Step 2: Link your project (if not already linked)
```bash
supabase link --project-ref zqcbldgheimqrnqmbbed
```

### Step 3: Deploy the function
```bash
cd "/Users/malikcampbell/NFG APP V3"
supabase functions deploy send-notification-email
```

---

## Option 2: Deploy via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Deploy a new function"** button (green button with + icon)
3. Choose **"Upload from file"** or **"Deploy from CLI"**
4. Or use the **"Deploy via CLI"** option which will show you the exact command

---

## Option 3: Use Supabase Dashboard UI

1. Go to **Edge Functions** → Click **"Deploy a new function"**
2. Choose **"Upload from file"**
3. Upload the `index.ts` file from: `supabase/functions/send-notification-email/index.ts`

---

## ✅ After Deployment

Once deployed, you should see:
- `send-invitation-email` (already there)
- `send-notification-email` (newly deployed) ✨

The function will automatically:
- ✅ Be triggered when notifications are created
- ✅ Check user preferences
- ✅ Send emails from `noreply@nfgone.ca` (if you set that up)
- ✅ Use your Resend API key

---

## 🧪 Test After Deployment

1. Assign a worker to a site
2. Check Resend Dashboard → Logs
3. Should see an email sent! 📧










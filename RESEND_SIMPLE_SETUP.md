# 📧 Simple Resend Setup for nfgone.ca

Let me break this down into the simplest possible steps:

---

## 🎯 What We're Doing

We want emails to come FROM: `noreply@nfgone.ca` instead of `onboarding@resend.dev`

This requires 2 things:
1. Tell Resend "I own nfgone.ca" (by adding DNS records)
2. Update Supabase to use `noreply@nfgone.ca`

---

## Step 1: Get Your Resend API Key (If You Haven't)

1. Go to: **https://resend.com**
2. Sign up or log in
3. Click **"API Keys"** on the left
4. Click **"Create API Key"**
5. Name it: `NFG App`
6. Copy the key (starts with `re_...`)

---

## Step 2: Add API Key to Supabase

1. Go to your Supabase Dashboard (where you are now)
2. In the **"ADD NEW SECRETS"** box at the top:
   - **Key:** Type `RESEND_API_KEY`
   - **Value:** Paste your API key
3. Click **"Save"** (green button)

---

## Step 3: Add Domain to Resend

1. Still in Resend (https://resend.com)
2. Click **"Domains"** on the left sidebar
3. Click the big **"+ Add Domain"** button
4. Type: `nfgone.ca`
5. Click **"Add"**

Now Resend will show you DNS records you need to add.

---

## Step 4: Add DNS Records (This is the Confusing Part)

Resend will show you 2-3 records like this:

**Record 1: SPF**
```
Type: TXT
Name: @ (or blank)
Value: v=spf1 include:resend.com ~all
```

**Record 2: DKIM**
```
Type: TXT
Name: resend._domainkey
Value: (a long string that Resend gives you)
```

### Where Do I Add These?

**Who manages your DNS for nfgone.ca?**

- Did you buy the domain from Namecheap, GoDaddy, Google Domains, etc.?
- Or is it managed by Cloudflare?
- Or somewhere else?

**Once you tell me, I'll give you exact steps!**

But here's the general process:
1. Log into wherever you manage your domain (where you bought it or where DNS is hosted)
2. Find "DNS Management" or "DNS Records" or "DNS Settings"
3. Click "Add Record"
4. Add each record exactly as Resend shows you

---

## Step 5: Wait & Verify

1. After adding DNS records, wait 15-30 minutes
2. Go back to Resend → Domains
3. Status should change from "Pending" to "Verified" ✅

---

## Step 6: Update Supabase

Once verified:

1. Go back to Supabase → Edge Functions → Secrets
2. Click "Add another" (if RESEND_FROM_EMAIL doesn't exist)
3. **Key:** `RESEND_FROM_EMAIL`
4. **Value:** `NFG <noreply@nfgone.ca>`
5. Click **"Save"**

---

## ✅ Done!

Now emails will come from `noreply@nfgone.ca`!

---

## 🤔 Which Part Are You Stuck On?

Tell me:
1. **"I don't have a Resend account yet"** → I'll guide you through signup
2. **"I don't know where my DNS is managed"** → Tell me where you bought nfgone.ca, I'll help you find it
3. **"I don't understand DNS records"** → I'll explain it super simply
4. **"Something else"** → Tell me what!










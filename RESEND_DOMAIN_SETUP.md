# 🌐 Resend Custom Domain Setup: nfgone.ca

## Step 1: Add Domain in Resend

1. Go to **https://resend.com** and log in
2. Click **"Domains"** in the left sidebar
3. Click **"Add Domain"** button
4. Enter your domain: `nfgone.ca`
5. Click **"Add Domain"**

---

## Step 2: Add DNS Records

Resend will show you DNS records that need to be added to your domain. You'll see something like:

### Required DNS Records:

**1. SPF Record (Type: TXT)**
```
Name/Host: @ (or leave blank, or nfgone.ca)
Value: v=spf1 include:resend.com ~all
TTL: 3600 (or Auto)
```

**2. DKIM Record (Type: TXT)**
```
Name/Host: resend._domainkey (or resend._domainkey.nfgone.ca)
Value: (Resend will provide a unique value - looks like: p=...)
TTL: 3600 (or Auto)
```

**3. DMARC Record (Type: TXT)** *(Optional but recommended)*
```
Name/Host: _dmarc (or _dmarc.nfgone.ca)
Value: v=DMARC1; p=none; rua=mailto:dmarc@nfgone.ca
TTL: 3600 (or Auto)
```

---

## Step 3: Add DNS Records to Your Domain

### Where to Add DNS Records:

Go to your domain registrar (where you bought `nfgone.ca`) or your DNS provider (if different):

**Common Providers:**
- **Namecheap**: Domains → Manage → Advanced DNS
- **GoDaddy**: DNS Management
- **Cloudflare**: DNS → Records
- **Google Domains**: DNS → Custom records
- **Route53**: Hosted zones → Records

### How to Add:

1. Find the DNS management section
2. Add each record exactly as Resend shows you:
   - **Type**: TXT
   - **Name/Host**: As specified (may be `@`, `resend._domainkey`, or `_dmarc`)
   - **Value**: Copy exactly from Resend (very important!)
   - **TTL**: 3600 or Auto
3. Save each record

---

## Step 4: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes** for most providers
- You can check status in Resend Dashboard → Domains

### Check DNS Propagation:

Visit: **https://mxtoolbox.com/SuperTool.aspx**
- Enter `nfgone.ca`
- Check if the records are showing up

---

## Step 5: Verify Domain in Resend

1. Go back to Resend Dashboard → Domains
2. Wait for the status to change from **"Pending"** to **"Verified"** ✅
3. This means DNS records are correct and Resend can send from your domain

---

## Step 6: Update Supabase Secret

Once your domain is verified:

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Find `RESEND_FROM_EMAIL` (or add it if it doesn't exist)
3. Update the value to:

```
NFG <noreply@nfgone.ca>
```

Or:

```
Northern Facilities Group <noreply@nfgone.ca>
```

4. Click **Save**

---

## Step 7: Test It! 🧪

After verification and updating the secret:

1. **Test email from your app:**
   - Assign a worker to a site
   - Create a booking
   - Complete a job

2. **Check the email:**
   - Open the email
   - Verify it says "From: NFG <noreply@nfgone.ca>"
   - Verify it doesn't go to spam

3. **Check Resend logs:**
   - Go to Resend Dashboard → Logs
   - See if emails are being sent successfully

---

## ✅ Setup Complete!

Your emails will now be sent from:
- **From:** `NFG <noreply@nfgone.ca>`
- **Domain:** Verified and authenticated
- **Better deliverability** than `onboarding@resend.dev`

---

## 🔧 Common Issues & Solutions

### Domain Not Verifying?

1. **Double-check DNS records:**
   - Copy the exact values from Resend (case-sensitive)
   - Make sure TTL is set (not blank)
   - Wait at least 30 minutes after adding records

2. **Check DNS propagation:**
   - Use https://mxtoolbox.com/SuperTool.aspx
   - Enter `nfgone.ca` and check TXT records
   - All records should appear

3. **Common mistakes:**
   - ❌ Wrong record name (should be exactly as Resend shows)
   - ❌ Extra spaces in the value
   - ❌ Missing quotes around the value (if your DNS provider requires them)
   - ❌ Wrong record type (must be TXT, not A, CNAME, etc.)

### Emails Still Using Old Address?

1. Make sure `RESEND_FROM_EMAIL` secret is updated in Supabase
2. The Edge Function might need to be redeployed (usually not needed)
3. Check Resend Dashboard → Logs to see what "from" address is being used

### Emails Going to Spam?

1. ✅ Use a custom domain (you're doing this!)
2. ✅ Keep email content clean and professional
3. ✅ Don't send too many emails at once
4. ✅ Ensure SPF, DKIM, and DMARC are all set up correctly

---

## 📝 Email Address Options

You can use any email address from your verified domain:

- `noreply@nfgone.ca` ✅
- `notifications@nfgone.ca` ✅
- `hello@nfgone.ca` ✅
- `support@nfgone.ca` ✅

**Recommended:** Use `noreply@nfgone.ca` or `notifications@nfgone.ca` for system emails.

---

## 🎉 You're All Set!

Once your domain is verified and the secret is updated, all notification emails will be sent from `nfgone.ca`!










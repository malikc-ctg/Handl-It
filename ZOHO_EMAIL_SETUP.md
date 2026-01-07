# 📧 Zoho Mail API Setup Guide

Perfect! Let's set up automatic email sending using your Zoho account.

---

## 🔧 Step-by-Step Setup

### Step 1: Create a Zoho API Client

1. **Go to Zoho API Console**
   - Visit: https://api-console.zoho.com/
   - Sign in with your Zoho account

2. **Create a New Client**
   - Click "Add Client"
   - Choose **"Server-based Applications"**
   - Fill in the details:
     - **Client Name**: NFG Facilities App
     - **Homepage URL**: http://localhost:5500 (or your domain)
     - **Authorized Redirect URIs**: http://localhost:5500/callback
   - Click "Create"

3. **Save Your Credentials**
   - You'll get a **Client ID** and **Client Secret**
   - Save these somewhere safe! You'll need them soon.

---

### Step 2: Generate a Refresh Token

You need to generate a refresh token that allows the app to send emails on your behalf.

1. **Get the Authorization Code**
   
   Open this URL in your browser (replace `YOUR_CLIENT_ID` with your actual Client ID):
   
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=YOUR_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=http://localhost:5500/callback
   ```
   
   - You'll be asked to authorize the app
   - After authorizing, you'll be redirected to a URL like:
     ```
     http://localhost:5500/callback?code=1000.abc123xyz...
     ```
   - **Copy the code** from the URL (everything after `code=`)

2. **Exchange Code for Refresh Token**
   
   Open Terminal and run this command (replace the values with yours):
   
   ```bash
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "code=YOUR_CODE_FROM_STEP_1" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "redirect_uri=http://localhost:5500/callback" \
     -d "grant_type=authorization_code"
   ```
   
   You'll get a response like:
   ```json
   {
     "access_token": "1000.abc...",
     "refresh_token": "1000.xyz...",
     "expires_in": 3600
   }
   ```
   
   - **Copy and save the `refresh_token`** - this is what you need!

---

### Step 3: Deploy to Supabase

Now let's set up the Edge Function in Supabase.

1. **Install Supabase CLI** (if you haven't already)
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to Your Project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Find your project ref in your Supabase dashboard URL:
   `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

4. **Set Your Zoho Credentials as Secrets**
   ```bash
   supabase secrets set ZOHO_CLIENT_ID=your_client_id_here
   supabase secrets set ZOHO_CLIENT_SECRET=your_client_secret_here
   supabase secrets set ZOHO_REFRESH_TOKEN=your_refresh_token_here
   supabase secrets set ZOHO_FROM_EMAIL=your-email@yourdomain.com
   ```
   
   Replace:
   - `your_client_id_here` with your Zoho Client ID
   - `your_client_secret_here` with your Zoho Client Secret
   - `your_refresh_token_here` with the refresh token from Step 2
   - `your-email@yourdomain.com` with your Zoho email address

5. **Deploy the Edge Function**
   ```bash
   cd "/Users/malikcampbell/NFG APP V3"
   supabase functions deploy send-invitation-email
   ```

---

### Step 4: Test It!

1. **Go to Settings** in your NFG app
2. **Click "Invite User"**
3. **Enter a test email address**
4. **Click Send**

The email should now be sent automatically via Zoho! 🎉

---

## ✅ Verification Checklist

- [ ] Created Zoho API Client
- [ ] Saved Client ID and Client Secret
- [ ] Generated Refresh Token
- [ ] Set all 4 secrets in Supabase
- [ ] Deployed Edge Function
- [ ] Tested sending an invitation

---

## 🔍 Troubleshooting

### "Failed to get Zoho access token"
- Check that your Client ID, Client Secret, and Refresh Token are correct
- Make sure you authorized the correct scopes: `ZohoMail.messages.CREATE` and `ZohoMail.accounts.READ`
- Try generating a new refresh token

### "Failed to send email"
- Verify your `ZOHO_FROM_EMAIL` matches your actual Zoho email
- Check that your Zoho account has email sending permissions
- Look at the Supabase Edge Function logs for detailed errors

### How to check Edge Function logs:
```bash
supabase functions logs send-invitation-email
```

### Email not arriving?
- Check spam folder
- Verify the recipient email is correct
- Check Zoho Mail sent items to confirm it was sent

---

## 📊 Rate Limits

Zoho Mail API limits:
- **Free tier**: ~100 emails per day
- **Paid plans**: Higher limits based on your plan

If you need to send more emails, consider upgrading your Zoho plan or using multiple Zoho accounts.

---

## 🔐 Security Notes

✅ **Good practices:**
- Secrets are stored securely in Supabase Edge Function secrets
- Refresh token is never exposed to the client
- Access tokens are generated on-demand and expire after 1 hour

⚠️ **Never:**
- Commit secrets to Git
- Share your Client Secret or Refresh Token
- Expose credentials in client-side code

---

## 💡 Quick Commands Reference

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set ZOHO_CLIENT_ID=xxx
supabase secrets set ZOHO_CLIENT_SECRET=xxx
supabase secrets set ZOHO_REFRESH_TOKEN=xxx
supabase secrets set ZOHO_FROM_EMAIL=xxx

# Deploy function
supabase functions deploy send-invitation-email

# View logs
supabase functions logs send-invitation-email

# List all secrets
supabase secrets list
```

---

## 🎨 Customizing the Email Template

The email template is in:
`supabase/functions/send-invitation-email/index.ts`

Look for the `emailHTML` variable (around line 35) to customize:
- Colors and styling
- Text content
- Company branding
- Layout

After making changes, redeploy:
```bash
supabase functions deploy send-invitation-email
```

---

## Need Help?

If you run into issues:
1. Check Supabase Edge Function logs: `supabase functions logs send-invitation-email`
2. Verify all 4 secrets are set: `supabase secrets list`
3. Test your Zoho credentials manually using curl
4. Check Zoho API Console for any restrictions on your client

---

## 🎉 Once Setup is Complete

After setup, invitations will work like this:
1. Admin clicks "Invite User"
2. Enters email and role
3. Email is **automatically sent** via Zoho (no popup, no manual steps!)
4. Recipient receives professional HTML email
5. Recipient clicks link to accept invitation
6. Done! ✅

No more copying links or opening email clients - it's fully automatic!


















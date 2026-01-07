#!/bin/bash

# Zoho Email Setup Script for NFG Facilities App
# This script helps you set up Zoho Mail API for automatic email invitations

echo "🔧 NFG Facilities - Zoho Email Setup"
echo "===================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Get Zoho credentials
echo "📋 Please enter your Zoho API credentials:"
echo "(You can get these from https://api-console.zoho.com/)"
echo ""

read -p "Zoho Client ID: " ZOHO_CLIENT_ID
read -p "Zoho Client Secret: " ZOHO_CLIENT_SECRET
read -p "Zoho Refresh Token: " ZOHO_REFRESH_TOKEN
read -p "Your Zoho Email Address: " ZOHO_FROM_EMAIL

echo ""
echo "🔐 Setting up secrets in Supabase..."
echo ""

# Set secrets
supabase secrets set ZOHO_CLIENT_ID="$ZOHO_CLIENT_ID"
supabase secrets set ZOHO_CLIENT_SECRET="$ZOHO_CLIENT_SECRET"
supabase secrets set ZOHO_REFRESH_TOKEN="$ZOHO_REFRESH_TOKEN"
supabase secrets set ZOHO_FROM_EMAIL="$ZOHO_FROM_EMAIL"

if [ $? -eq 0 ]; then
    echo "✅ Secrets set successfully!"
else
    echo "❌ Failed to set secrets. Make sure you're logged in to Supabase."
    exit 1
fi

echo ""
echo "🚀 Deploying Edge Function..."
echo ""

# Deploy function
supabase functions deploy send-invitation-email

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "Your NFG app can now send automatic invitation emails via Zoho!"
    echo ""
    echo "Next steps:"
    echo "1. Go to Settings → User Management"
    echo "2. Click 'Invite User'"
    echo "3. Enter an email and role"
    echo "4. Email will be sent automatically!"
    echo ""
    echo "To view logs: supabase functions logs send-invitation-email"
else
    echo "❌ Failed to deploy function. Check the error above."
    exit 1
fi


















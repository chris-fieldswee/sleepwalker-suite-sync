#!/bin/bash

# Supabase Migration Helper Script
# This script helps migrate your local database to Supabase cloud

echo "🚀 Supabase Cloud Migration Helper"
echo "=================================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials:"
    echo ""
    echo "VITE_SUPABASE_URL=https://your-project-id.supabase.co"
    echo "VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here"
    echo ""
    exit 1
fi

echo "✅ .env.local file found"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase!"
    echo "Please run: supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"

# Get project ID from .env.local
PROJECT_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d '=' -f2)
PROJECT_ID=$(echo $PROJECT_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Could not extract project ID from VITE_SUPABASE_URL"
    exit 1
fi

echo "📋 Project ID: $PROJECT_ID"

# Link project
echo "🔗 Linking project..."
supabase link --project-ref $PROJECT_ID

# Push migrations
echo "📤 Pushing migrations..."
supabase db push

echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Set up storage buckets (task-photos, issue-photos)"
echo "2. Create admin user or update existing user role"
echo "3. Test the application"
echo ""
echo "See SUPABASE_MIGRATION_GUIDE.md for detailed instructions"

#!/bin/bash

# Verify Supabase Setup Script
# This script verifies that your independent Supabase setup is correct

echo "🔍 Verifying Supabase Setup"
echo "=========================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials:"
    echo ""
    echo "VITE_SUPABASE_URL=https://your-project-id.supabase.co"
    echo "VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here"
    exit 1
fi

echo "✅ .env.local file found"

# Check if .env.local has required variables
if ! grep -q "VITE_SUPABASE_URL" .env.local; then
    echo "❌ VITE_SUPABASE_URL not found in .env.local"
    exit 1
fi

if ! grep -q "VITE_SUPABASE_PUBLISHABLE_KEY" .env.local; then
    echo "❌ VITE_SUPABASE_PUBLISHABLE_KEY not found in .env.local"
    exit 1
fi

echo "✅ Required environment variables present"

# Check if VITE_SUPABASE_URL has placeholder
if grep -q "your-project-id" .env.local; then
    echo "⚠️  WARNING: VITE_SUPABASE_URL still has placeholder value"
    echo "Please update .env.local with your actual Supabase project credentials"
fi

# Check if VITE_SUPABASE_PUBLISHABLE_KEY has placeholder
if grep -q "your_anon_key" .env.local; then
    echo "⚠️  WARNING: VITE_SUPABASE_PUBLISHABLE_KEY still has placeholder value"
    echo "Please update .env.local with your actual Supabase project credentials"
fi

# Check if migrations directory exists
if [ ! -d "supabase/migrations" ]; then
    echo "❌ supabase/migrations directory not found!"
    exit 1
fi

echo "✅ Migrations directory found"

# Count migration files
MIGRATION_COUNT=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "✅ Found $MIGRATION_COUNT migration files"

echo ""
echo "✅ Basic checks complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env.local has actual credentials (not placeholders)"
echo "2. Run your migrations in the Supabase SQL Editor"
echo "3. Set up storage buckets (task-photos, issue-photos)"
echo "4. Create an admin user"
echo "5. Test the application"
echo ""
echo "See INDEPENDENT_SUPABASE_SETUP.md for detailed instructions"

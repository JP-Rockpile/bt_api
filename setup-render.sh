#!/bin/bash

# Bet Think API - Render Setup Script
# This script helps you set up your .env file for Render development

set -e

echo "🚀 Bet Think API - Render Setup"
echo "================================"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Copy template to .env
if [ -f .env.template ]; then
    cp .env.template .env
    echo "✅ Created .env file from template"
else
    echo "❌ .env.template not found. Please create it first."
    exit 1
fi

echo ""
echo "📝 Now you need to fill in your credentials:"
echo ""
echo "1. RENDER DATABASE SETUP:"
echo "   - Go to https://dashboard.render.com/"
echo "   - Create a new PostgreSQL database"
echo "   - Enable pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;"
echo "   - Copy the Internal Database URL"
echo ""
echo "2. RENDER REDIS SETUP:"
echo "   - Create a new Redis instance in Render"
echo "   - Copy the connection details (host, port, password)"
echo ""
echo "3. AUTH0 SETUP:"
echo "   - Go to https://manage.auth0.com/"
echo "   - Create an API or use existing one"
echo "   - Copy domain, audience, and issuer"
echo ""
echo "4. API KEYS:"
echo "   - Unabated: https://unabated.com"
echo "   - The Odds API: https://the-odds-api.com"
echo ""

read -p "Press Enter to open .env file for editing..."

# Try to open in editor
if command -v code &> /dev/null; then
    code .env
elif command -v vim &> /dev/null; then
    vim .env
elif command -v nano &> /dev/null; then
    nano .env
else
    echo "Please edit .env file manually"
fi

echo ""
echo "📋 After configuring .env, run these commands:"
echo ""
echo "  npm install                    # Install dependencies"
echo "  npm run prisma:generate        # Generate Prisma client"
echo "  npm run prisma:migrate:dev    # Run migrations"
echo "  npm run db:seed               # Seed initial data"
echo "  npm run start:dev             # Start the API"
echo ""
echo "📚 For detailed instructions, see RENDER_SETUP.md"
echo ""


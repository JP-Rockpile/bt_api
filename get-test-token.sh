#!/bin/bash

# Quick script to get a test token from Auth0
# You need to set your CLIENT_ID and CLIENT_SECRET first

echo "🔑 Auth0 Test Token Generator"
echo "=============================="
echo ""
echo "Your Auth0 Configuration:"
echo "  Domain: dev-us8cq3deo7cm4b5h.us.auth0.com"
echo "  Audience: https://api.betthink.com"
echo ""
echo "To get a test token, you need:"
echo "  1. CLIENT_ID from your Auth0 application"
echo "  2. CLIENT_SECRET from your Auth0 application"
echo ""
echo "Then run:"
echo ""
echo "curl --request POST \\"
echo "  --url https://dev-us8cq3deo7cm4b5h.us.auth0.com/oauth/token \\"
echo "  --header 'content-type: application/json' \\"
echo "  --data '{"
echo "    \"client_id\":\"YOUR_CLIENT_ID\","
echo "    \"client_secret\":\"YOUR_CLIENT_SECRET\","
echo "    \"audience\":\"https://api.betthink.com\","
echo "    \"grant_type\":\"client_credentials\""
echo "  }' | jq -r '.access_token'"
echo ""
echo "Or get it from your mobile app logs!"


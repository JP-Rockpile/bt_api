#!/bin/bash

# Test script for fuzzy team name matching in GET /odds/tools/best-price
# Make sure to set your AUTH_TOKEN environment variable

API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${AUTH_TOKEN:-your-token-here}"

echo "🧪 Testing Fuzzy Team Name Matching for GET /odds/tools/best-price"
echo "=================================================="
echo ""

# Test 1: Full canonical name
echo "Test 1: Full canonical name - 'Milwaukee Brewers'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "Milwaukee Brewers",
    "market": "moneyline"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Partial name (common usage)
echo "Test 2: Partial name - 'Brewers'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "Brewers",
    "market": "moneyline"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Abbreviation (via alias)
echo "Test 3: Abbreviation - 'MIL'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "MIL",
    "market": "moneyline"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 4: City name only
echo "Test 4: City name - 'Milwaukee'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "Milwaukee",
    "market": "moneyline"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 5: With opponent specified
echo "Test 5: With opponent - 'Brewers' vs 'Cubs'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "Brewers",
    "opponent": "Cubs",
    "market": "spread"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 6: Different league - NBA
echo "Test 6: NBA team - 'Lakers'"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "NBA",
    "team": "Lakers",
    "market": "moneyline"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 7: NFL team with abbreviation
echo "Test 7: NFL team - 'KC' (Kansas City Chiefs)"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "NFL",
    "team": "KC",
    "market": "spread"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 8: Typo tolerance (fuzzy matching)
echo "Test 8: Typo - 'Milwakee' (should fuzzy match to Milwaukee)"
curl -s -X POST "$API_URL/odds/tools/best-price" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "league": "MLB",
    "team": "Milwakee",
    "market": "total"
  }' | jq '.'

echo ""
echo "=================================================="
echo "✅ Tests complete!"
echo ""
echo "Expected behavior:"
echo "- Tests 1-5 should find the Milwaukee Brewers vs Chicago Cubs game"
echo "- Test 6 should find the Lakers vs Celtics game"
echo "- Test 7 should find the Chiefs vs Bills game"
echo "- Test 8 should fuzzy match 'Milwakee' to 'Milwaukee Brewers'"


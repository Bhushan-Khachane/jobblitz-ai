#!/bin/bash
set -e

echo "🧪 JobBlitz Local Test Setup"
echo "=============================="

# Generate secrets if not set
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
  sed -i "s/^SECRET_KEY=$/SECRET_KEY=$SECRET_KEY/" backend/.env
  sed -i "s/^FERNET_KEY=$/FERNET_KEY=$FERNET_KEY/" backend/.env
  echo "✓ Generated SECRET_KEY and FERNET_KEY"
  echo ""
  echo "⚠️  Add your GEMINI_API_KEY to backend/.env before running:"
  echo "   GEMINI_API_KEY=your_key_here"
  echo ""
fi

if [ ! -f frontend/.env ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > frontend/.env
  echo "✓ Created frontend/.env"
fi

# Ensure NEXT_PUBLIC_API_URL is set
if ! grep -q "NEXT_PUBLIC_API_URL" frontend/.env 2>/dev/null; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" >> frontend/.env
  echo "  ✓ Set NEXT_PUBLIC_API_URL in frontend/.env"
fi

echo ""
echo "To start: ./scripts/start.sh"
echo "Then open: http://localhost:3001"
echo ""
echo "Test user flow:"
echo "  1. Register at http://localhost:3001/register"
echo "  2. Upload resume (PDF)"
echo "  3. Set job preferences"
echo "  4. Connect LinkedIn/Naukri (requires Docker + NEKO_IMAGE)"
echo "  5. Create a job search"
echo "  6. Trigger discovery manually from Searches page"
echo "  7. Review approval queue (Assisted mode)"
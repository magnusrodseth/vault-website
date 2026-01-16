#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./scripts/generate-password-hash.sh <password>"
  exit 1
fi

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

BASE64_HASH=$(node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('$1', 12).then(hash => {
  console.log(Buffer.from(hash).toString('base64'));
});
")

sed -i '' "s|^APP_PASSWORD_HASH=.*|APP_PASSWORD_HASH=$BASE64_HASH|" "$ENV_FILE"
sed -i '' "s|^APP_PASSWORD=.*|APP_PASSWORD_HASH=$BASE64_HASH|" "$ENV_FILE"

echo "Updated $ENV_FILE with new password hash"
echo "Restart your dev server for changes to take effect"

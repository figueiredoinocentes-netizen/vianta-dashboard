# Attempt to get Netlify build log
echo "=== Node version ==="
node --version
echo "=== npm version ==="
npm --version
echo "=== npm install ==="
npm install 2>&1
echo "=== npm run build ==="
npm run build 2>&1
echo "=== Exit code ==="
echo $?
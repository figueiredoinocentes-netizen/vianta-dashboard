#!/usr/bin/env python3
"""Post-build script: copy old Lovable assets + operacoes.html into dist"""
import shutil, os

PUBLIC = 'public'
DIST = 'dist'
ASSETS = os.path.join(DIST, 'assets')

# 1. Copy old Lovable bundle and CSS into dist/assets/
shutil.copy2(os.path.join(PUBLIC, 'assets', 'index-Cdosnuq2.js'), ASSETS)
shutil.copy2(os.path.join(PUBLIC, 'assets', 'index-DBm4vQ15.css'), ASSETS)

# 2. Copy old Lovable index.html (overwrites Vite's generated one)
shutil.copy2(os.path.join(PUBLIC, 'lovable-index.html'), os.path.join(DIST, 'index.html'))

# 3. Copy operacoes.html
shutil.copy2(os.path.join(PUBLIC, 'operacoes.html'), os.path.join(DIST, 'operacoes.html'))

print("Post-build: old Lovable assets + operacoes.html copied to dist/")
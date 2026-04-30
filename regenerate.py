#!/usr/bin/env python3
"""Regeneriert cube-rectification.html aus index.html + worker.js"""
import base64, re

with open('index.html') as f: idx = f.read()
with open('worker.js') as f: wrk = f.read()

# `new Worker('worker.js?v=' + Date.now())` durch Data-URL-Worker ersetzen.
# Funktioniert auch bei file://-Kontext (Safari blockt Blob-URLs dort).
# Der Worker-Code wird als <script type="text/worker"> inline eingebettet
# und beim ersten Aufruf in eine Data-URL gewrappt.
idx = idx.replace(
    "new Worker('worker.js?v=' + Date.now())",
    """(() => {
      const code = document.getElementById('worker-src').textContent;
      try {
        const url = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(code);
        return new Worker(url);
      } catch(e1) {
        try {
          const blob = new Blob([code], { type: 'application/javascript' });
          return new Worker(URL.createObjectURL(blob));
        } catch(e2) { throw new Error('Worker blocked'); }
      }
    })()"""
)

# Inline Worker-Code als <script type="text/worker">
importmap_pos = idx.find('<script type="importmap">')
idx = idx[:importmap_pos] + f'\n<script id="worker-src" type="text/worker">\n{wrk}</script>\n\n' + idx[importmap_pos:]

# Inline Favicons
with open('favicon.png', 'rb') as f: b64 = base64.b64encode(f.read()).decode()
with open('favicon-32.png', 'rb') as f: b32 = base64.b64encode(f.read()).decode()
idx = idx.replace('href="favicon-32.png"', f'href="data:image/png;base64,{b32}"')
idx = idx.replace('href="favicon.png"', f'href="data:image/png;base64,{b64}"')

# OG-Tags
if 'og:image' not in idx:
    idx = idx.replace('<meta name="viewport"',
        '<meta name="description" content="Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.">\n'
        '<meta property="og:title" content="Iterative Rektifikation eines Würfels">\n'
        '<meta property="og:description" content="Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:image" content="https://crambambuli.github.io/cube-to-sphere/og-image.jpg">\n'
        '<meta property="og:image:width" content="1920">\n'
        '<meta property="og:image:height" content="1598">\n'
        '<meta property="og:url" content="https://crambambuli.github.io/cube-to-sphere/cube-rectification.html">\n'
        '<meta name="viewport"')

with open('cube-rectification.html', 'w') as f: f.write(idx)
print("OK")

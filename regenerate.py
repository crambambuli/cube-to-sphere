#!/usr/bin/env python3
"""Regeneriert cube-rectification.html aus index.html + worker.js"""
import base64

with open('index.html') as f: idx = f.read()
with open('worker.js') as f: wrk = f.read()

# Worker: Data-URL statt file-URL (funktioniert bei file://)
idx = idx.replace(
    "worker = new Worker('worker.js?v=' + Date.now());",
    """// Worker erstellen — Data-URL funktioniert auch bei file://
const workerCode = document.getElementById('worker-src').textContent;
const dataUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(workerCode);
let worker;
try {
  worker = new Worker(dataUrl);
} catch(e) {
  // Fallback: Blob-URL (funktioniert auf manchen Servern besser)
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
  } catch(e2) {
    console.warn('Web Worker nicht verfügbar, Fallback auf Main Thread');
    worker = { _h: null, _s: null,
      set onmessage(fn) { this._h = fn; },
      get onmessage() { return this._h; },
      onerror: null,
      postMessage(data) {
        const sc = document.getElementById('worker-src');
        if (!sc) return;
        if (!this._s) {
          this._s = { postMessage: (msg) => { if (this._h) this._h({ data: msg }); }};
          const fn = new Function('self', sc.textContent + '\\nreturn self;');
          this._s = fn(this._s);
        }
        if (this._s.onmessage) this._s.onmessage({ data });
      }
    };
  }
}""")

# Inline Worker-Code als <script type="text/worker">
importmap_pos = idx.find('<script type="importmap">')
idx = idx[:importmap_pos] + f'\n<script id="worker-src" type="text/worker">\n{wrk}</script>\n\n' + idx[importmap_pos:]

# Inline Favicons
with open('favicon.png', 'rb') as f: b64 = base64.b64encode(f.read()).decode()
with open('favicon-32.png', 'rb') as f: b32 = base64.b64encode(f.read()).decode()
idx = idx.replace('href="favicon-32.png"', f'href="data:image/png;base64,{b32}"')
idx = idx.replace('href="favicon.png"', f'href="data:image/png;base64,{b64}"')

# OG-Tags mit absoluter URL (falls nicht vorhanden)
if 'og:image' not in idx:
    idx = idx.replace('<meta name="viewport"',
        '<meta name="description" content="Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.">\n'
        '<meta property="og:title" content="Iterative Rektifikation eines Würfels">\n'
        '<meta property="og:description" content="Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:image" content="https://crambambuli.github.io/cube-to-sphere/og-image.jpg">\n'
        '<meta property="og:image:width" content="2628">\n'
        '<meta property="og:image:height" content="1748">\n'
        '<meta property="og:url" content="https://crambambuli.github.io/cube-to-sphere/cube-rectification.html">\n'
        '<meta name="viewport"')

with open('cube-rectification.html', 'w') as f: f.write(idx)
print("OK")

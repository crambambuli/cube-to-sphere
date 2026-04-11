#!/usr/bin/env python3
"""Regeneriert cube-rectification.html aus index.html + worker.js"""
import base64, re

with open('index.html') as f: idx = f.read()
with open('worker.js') as f: wrk = f.read()

# Gesamten Worker-Erstellungsblock ersetzen
# Suche von "// Worker erstellen" bis "const pendingCallbacks"
idx = re.sub(
    r'// Worker erstellen.*?(?=const pendingCallbacks)',
    """// Worker erstellen — Data-URL funktioniert auch bei file://
const workerCode = document.getElementById('worker-src').textContent;
const dataUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(workerCode);
let worker;
try {
  worker = new Worker(dataUrl);
} catch(e1) {
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
  } catch(e2) {
    console.warn('Web Worker nicht verfügbar, Fallback auf Main Thread');
    worker = {
      _handler: null, _workerScope: null,
      set onmessage(fn) { this._handler = fn; },
      get onmessage() { return this._handler; },
      onerror: null,
      postMessage(data) {
        const script = document.getElementById('worker-src');
        if (!script) return;
        if (!this._workerScope) {
          this._workerScope = {};
          const scope = this._workerScope;
          scope.self = { postMessage: (msg) => {
            if (this._handler) this._handler({ data: msg });
          }};
          const fn = new Function('self', script.textContent + '\\\\nreturn self;');
          scope.self = fn(scope.self);
        }
        if (this._workerScope.self.onmessage) {
          this._workerScope.self.onmessage({ data });
        }
      }
    };
  }
}
""",
    idx, flags=re.DOTALL)

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
        '<meta property="og:image:width" content="2628">\n'
        '<meta property="og:image:height" content="1748">\n'
        '<meta property="og:url" content="https://crambambuli.github.io/cube-to-sphere/cube-rectification.html">\n'
        '<meta name="viewport"')

with open('cube-rectification.html', 'w') as f: f.write(idx)
print("OK")

# Vom Würfel zur Kugel

Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wie er zur Kugel konvergiert.

**[Live-Demo](https://crambambuli.github.io/cube-to-sphere/Wuerfel-zu-Kugel.html)**

![Vorschau](og-image.jpg)

## Das Problem

Gegeben ein Würfel. Man halbiert alle Kanten und schneidet an den Mittelpunkten die Ecken ab. Es entsteht ein neuer konvexer Körper mit mehr Flächen, Kanten und Ecken. Dieses Verfahren wiederholt man: wieder alle Kanten halbieren, wieder die Ecken abschneiden — und immer so weiter.

**Frage:** Welche Form entsteht, wenn man diesen Prozess unendlich oft wiederholt?

**Antwort:** Der Körper konvergiert gegen eine Kugel.

## Mathematischer Hintergrund

Die Operation heißt **Rektifikation** — man ersetzt jeden Vertex durch eine neue Fläche und jede Fläche durch eine kleinere Version ihrer selbst.

### Euler-Formel

Bei jeder Iteration gilt exakt (beweisbar über V - E + F = 2):

| Größe | Formel | Entwicklung |
|-------|--------|-------------|
| Ecken | V' = E | 8 → 12 → 24 → 48 → ... |
| Kanten | E' = 2E | 12 → 24 → 48 → 96 → ... |
| Flächen | F' = V + F | 6 → 14 → 26 → 50 → ... |

Die Kanten verdoppeln sich exakt bei jeder Iteration.

### Konvergenz zur Kugel

Die Konvergenz folgt aus drei Eigenschaften:

1. **Oh-Symmetrie bleibt erhalten** — der Körper hat in jeder Iteration die volle Oktaedersymmetrie (48 Symmetrieoperationen)
2. **Glättung** — Mittelwertbildung reduziert Extremwerte der Vertex-Abstände vom Zentrum
3. **Eindeutigkeit** — die einzige glatte, konvexe, Oh-symmetrische Fläche ist die Kugel

Die Konvergenzrate ist linear: die Abweichung von der Kugel halbiert sich ungefähr pro Iteration.

### Bemerkenswerte Zwischenkörper

- **Iteration 0:** Würfel (8 Ecken, 12 Kanten, 6 Flächen)
- **Iteration 1:** Kuboctaeder (12 Ecken, 24 Kanten, 14 Flächen) — ein archimedischer Körper
- **Iteration 2:** Rhombikuboctaeder-artig (24 Ecken, 48 Kanten, 26 Flächen)
- **Ab Iteration 5:** visuell kaum noch von einer Kugel zu unterscheiden

## Technische Umsetzung

- **Three.js** für 3D-Rendering (WebGL)
- **Web Worker** mit eigenem Convex-Hull-Algorithmus (Conflict-Lists, Adjazenz-BFS) für nicht-blockierende Berechnung
- **Analytische Statistiken** via Euler-Formel (exakt, keine Rundungsfehler)
- **Responsive** — funktioniert auf Desktop und Mobilgeräten (Touch-Rotation, Pinch-to-Zoom)

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `Wuerfel-zu-Kugel.html` | Standalone — eine einzige HTML-Datei, funktioniert ohne Server |
| `index.html` + `worker.js` | Zwei-Dateien-Version, braucht HTTP-Server |
| `all-in-one.html` | Standalone mit Worker als Blob-URL |

### Lokal starten

```bash
# Standalone (Doppelklick oder):
open Wuerfel-zu-Kugel.html

# Oder mit Server (für index.html + worker.js):
python3 -m http.server 8766
# → http://localhost:8766
```

## Bedienung

- **Weiter / Zurück** — nächste/vorherige Iteration (oder Pfeiltasten)
- **Auto** — automatisch durchlaufen
- **Ziehen** — Körper drehen (Touch oder Maus)
- **Pinch / Scrollrad** — Zoomen
- **R** — Reset, **A** — Auto-Modus

## Lizenz

MIT

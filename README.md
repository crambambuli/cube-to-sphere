# Vom Würfel zur Kugel?

Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.

**[Live-Demo](https://crambambuli.github.io/cube-to-sphere/cube-rectification.html)**

![Vorschau](og-image.jpg)

## Das Problem

Gegeben ein Würfel. Man halbiert alle Kanten und schneidet an den Mittelpunkten die Ecken ab. Es entsteht ein neuer konvexer Körper mit mehr Flächen, Kanten und Ecken. Dieses Verfahren wiederholt man: wieder alle Kanten halbieren, wieder die Ecken abschneiden — und immer so weiter.

**Frage:** Welche Form entsteht, wenn man diesen Prozess unendlich oft wiederholt?

**Antwort:** Nicht eine Kugel. Der Körper konvergiert gegen einen spezifischen O<sub>h</sub>-symmetrischen konvexen Körper mit ca. 14% Durchmesser-Variation — kugelähnlich, aber messbar nicht-sphärisch.

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

### Was erhalten bleibt

**O<sub>h</sub>-Symmetrie.** Der Würfel hat die Oktaedersymmetrie O<sub>h</sub> (48 Symmetrieoperationen). Die Bezeichnung stammt aus der Schoenflies-Notation: **O** steht für die Oktaeder-Drehgruppe (24 reine Drehungen), **h** für die Erweiterung um Spiegelungen. Dies ist gleichzeitig die Symmetriegruppe des Würfels und des Oktaeders, da beide duale Körper sind.

Jede Symmetrieoperation bildet Ecken auf Ecken, Kanten auf Kanten, Kantenmittelpunkte auf Kantenmittelpunkte ab. Die Menge der Mittelpunkte ist O<sub>h</sub>-invariant → die konvexe Hülle auch → jede Iteration erhält die O<sub>h</sub>-Symmetrie. ✓

### Warum der Grenzkörper keine Kugel ist

Die Vermutung liegt nahe, dass iterierte Rektifikation den Würfel zu einer Kugel glättet. Die numerische Simulation zeigt jedoch, dass die Abweichung von der best-fit Kugel gegen einen **festen Wert konvergiert**, nicht gegen null:

| Iteration | Abweichung von der Kugel |
|-----------|-------------------------|
| 5 | -6,2% .. +5,3% |
| 10 | -7,8% .. +6,6% |
| 14 | -7,8% .. +6,6% |
| 18 | -7,8% .. +6,6% |

Die Abweichung stabilisiert sich bei ca. ±7,8% — der Körper konvergiert gegen einen nicht-sphärischen Grenzkörper.

**Die Ursache: topologische Nicht-Uniformität.**

Ab Iteration 2 hat der Körper Vertices mit unterschiedlichem Grad (Anzahl angrenzender Kanten):
- Vertices an den 8 Würfelecken-Positionen: Grad 3 (Dreiecks-Vertex-Figur)
- Vertices an den 6 Flächenzentren: Grad 4 (Quadrat-Vertex-Figur)
- Weitere Vertex-Typen bei höheren Iterationen

Diese topologische Heterogenität bleibt bei jeder Iteration erhalten — sie wird nie homogen. Unterschiedliche Vertex-Grade erzeugen unterschiedliche lokale Geometrien, die durch Mittelwertbildung nicht ausgeglichen werden können.

Die Mittelwertbildung an einem Grad-3-Vertex mittelt über 3 Nachbarn, an einem Grad-4-Vertex über 4 Nachbarn. Diese strukturelle Asymmetrie erzeugt einen stationären Zustand, in dem die Beulen an den 8 Würfelecken-Positionen und die Dellen an den 6 Flächenzentren dauerhaft bestehen bleiben.

**Vergleich mit Subdivision Surfaces:** In der Computergrafik ist bekannt, dass "extraordinary vertices" (Vertices mit nicht-standardmäßiger Valenz) in Catmull-Clark- oder Loop-Subdivision die Grenzfläche lokal deformieren. Das gleiche Prinzip gilt hier — die 8 Würfelecken sind topologische Singularitäten, die den Grenzkörper dauerhaft von der Kugel unterscheiden.

### Der Grenzkörper

Der Grenzkörper ist ein wohldefinierter O<sub>h</sub>-symmetrischer konvexer Körper mit:
- 8 leichten Beulen an den Positionen der ursprünglichen Würfelecken
- 6 leichte Dellen an den Positionen der ursprünglichen Flächenzentren
- ca. 14% Unterschied zwischen größtem und kleinstem Durchmesser
- Unendlich viele Flächen (im Grenzwert glatt)

Er ist **kein** bekannter Standardkörper (weder Kugel noch ein reguläres Polyeder).

### Sind die Schnittflächen immer plan?

Bei der Rektifikation entstehen Flächen mit mehr als 3 Eckpunkten — z.B. Quadrate beim Kuboctaeder (Iteration 1) oder Sechsecke in späteren Iterationen. Die Frage ist: Liegen diese Punkte exakt in einer Ebene, oder sind die Flächen "verbogen"?

**Antwort: Ja, alle Flächen sind exakt plan.**

Das folgt direkt aus der Konstruktion: Das Ergebnis jeder Iteration ist die konvexe Hülle der Kantenmittelpunkte. Die konvexe Hülle eines endlichen Punktsatzes ist ein konvexes Polyeder, und jede Fläche eines konvexen Polyeders liegt in einer Stützebene — einer Ebene, die den Körper berührt, aber nicht schneidet. Punkte, die in derselben Stützebene liegen, sind automatisch koplanar.

Geometrisch betrachtet entstehen bei jeder Iteration zwei Typen von Flächen:

- **Vertex-Flächen:** Jede alte Ecke mit Grad d wird zu einem planaren d-Eck (beim Würfel: 3 Kanten pro Ecke → Dreieck)
- **Geschrumpfte Original-Flächen:** Jede alte n-Eck-Fläche wird zu einem kleineren n-Eck (beim Würfel: Quadrat → kleineres Quadrat)

Beide Typen sind exakt plan — nicht nur numerisch, sondern als mathematische Notwendigkeit der konvexen Hülle.

### Bemerkenswerte Zwischenkörper

- **Iteration 0:** Würfel (8 Ecken, 12 Kanten, 6 Flächen)
- **Iteration 1:** Kuboctaeder (12 Ecken, 24 Kanten, 14 Flächen) — ein archimedischer Körper
- **Iteration 2:** Rhombikuboctaeder-artig (24 Ecken, 48 Kanten, 26 Flächen)
- **Ab Iteration 5:** visuell kugelähnlich, aber messbar nicht-sphärisch

## Technische Umsetzung

- **Three.js** für 3D-Rendering (WebGL)
- **Web Worker** mit topologischer Rektifikation (Polygon-Flächen, exakte Kantenanzahl via Euler)
- **Best-Fit-Kugel** als Referenz mit Outlier-Visualisierung (rot = außerhalb, grün = innerhalb)
- **Responsive** — funktioniert auf Desktop und Mobilgeräten (Touch-Rotation, Pinch-to-Zoom)

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `cube-rectification.html` | Standalone — eine einzige HTML-Datei, funktioniert ohne Server |
| `index.html` + `worker.js` | Zwei-Dateien-Version, braucht HTTP-Server |

### Lokal starten

```bash
# Standalone (Doppelklick oder):
open cube-rectification.html

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

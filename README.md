# Vom Würfel zur Kugel?

Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.

**[Live-Demo](https://crambambuli.github.io/cube-to-sphere/cube-rectification.html)**

![Vorschau](og-image.jpg)

## Das Problem

Gegeben ein Würfel. Man halbiert alle Kanten und schneidet an den Mittelpunkten die Ecken ab. Es entsteht ein neuer konvexer Körper mit mehr Flächen, Kanten und Ecken. Dieses Verfahren wiederholt man: wieder alle Kanten halbieren, wieder die Ecken abschneiden — und immer so weiter.

**Frage:** Welche Form entsteht, wenn man diesen Prozess unendlich oft wiederholt?

**Antwort:** Keine Kugel. Der Körper konvergiert gegen einen spezifischen O<sub>h</sub>-symmetrischen konvexen Körper mit ca. 14% Durchmesser-Variation — kugelähnlich, aber messbar nicht-sphärisch.

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

Die Vermutung liegt nahe, dass iterierte Rektifikation den Würfel zu einer Kugel glättet. Die numerische Simulation zeigt jedoch, dass die Abweichung von der Best-Fit-Kugel gegen einen **festen Wert konvergiert**, nicht gegen null:

```
Iter  Beule (außen)    Delle (innen)
─────────────────────────────────────────────────
  0   ▏                ▏                    0,000%
  1   ▏                ▏                    0,000%
  2   ▏                ▏                    0,000%
  3   ████▏            ████▏                2,548%
  4   ████████▏        ███████▏             4,884%
  5   ██████████▏      █████████▏           6,272%
  6   ████████████▏    ██████████▏          7,042%
  7   █████████████▏   ██████████▏          7,438%
  8   █████████████▏   ███████████▏         7,640%
  9   █████████████▏   ███████████▏         7,742%
 10   █████████████▏   ███████████▏         7,793%
 ...
 15   ██████████████▏  ███████████▏         7,843%
 20   ██████████████▏  ███████████▏         7,845%
         -7,845%          +6,604%
```

Iterationen 0–2 haben exakt 0% Abweichung, weil alle Vertices gleich weit vom Zentrum entfernt sind (Würfel, Kuboctaeder und dessen Rektifikation haben jeweils gleich lange Kanten und äquidistante Vertices).

| Iteration | Min (Beule) | Max (Delle) |
|-----------|-------------|-------------|
| 0 | 0,000% | +0,000% |
| 1 | 0,000% | +0,000% |
| 2 | 0,000% | +0,000% |
| 3 | -2,548% | +2,548% |
| 5 | -6,272% | +5,407% |
| 7 | -7,438% | +6,291% |
| 10 | -7,793% | +6,564% |
| 13 | -7,838% | +6,599% |
| 15 | -7,843% | +6,602% |
| 20 | -7,845% | +6,604% |

Die Abweichung stabilisiert sich bei **-7,845% / +6,604%** — der Körper konvergiert gegen einen nicht-sphärischen Grenzkörper. Bemerkenswert: die Beulen (an den Würfelecken) sind stärker ausgeprägt als die Dellen (an den Flächenzentren).

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
- 6 leichten Dellen an den Positionen der ursprünglichen Flächenzentren
- ca. 14% Unterschied zwischen größtem und kleinstem Durchmesser
- unendlich vielen Flächen (im Grenzwert glatt)

Er ist **kein** bekannter Standardkörper (weder Kugel noch ein reguläres Polyeder).

### Sind die Schnittflächen immer plan?

Bei der Rektifikation entstehen Flächen mit mehr als 3 Eckpunkten — z.B. Quadrate beim Kuboctaeder (Iteration 1) oder Sechsecke in späteren Iterationen. Die Frage ist: Liegen diese Punkte exakt in einer Ebene oder sind die Flächen "verbogen"?

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

## Die Anwendung

### Darstellung

Die Anwendung zeigt den Körper in zwei Modi:

- **Iteration 0–10 (Polyeder-Modus):** Halbtransparente Flächen mit weißen Kanten und farbcodierten Vertex-Punkten. Die Flächen werden in zwei Passes gerendert (Rückseite, dann Vorderseite) für korrektes Alpha-Blending.
- **Ab Iteration 11 (Kugel-Modus):** Eine halbtransparente Best-Fit-Kugel als Referenz. Nur noch farbcodierte Vertex-Punkte sind sichtbar — die Flächen und Kanten würden bei >50.000 Vertices den Browser überlasten.

### Farbcodierung der Punkte

Jeder Vertex-Punkt ist nach seiner Abweichung von der Best-Fit-Kugel eingefärbt:

- **Rot** — außerhalb der Kugel (Beule, an den Würfelecken-Positionen)
- **Grün** — innerhalb der Kugel (Delle, an den Flächenzentren)
- **Grau** — auf der Kugeloberfläche (kaum Abweichung)

Die Farbintensität skaliert linear mit der Abweichung: je weiter vom Kugelradius, desto kräftiger die Farbe.

### Sampling

Bei mehr als 50.000 Vertices wird ein gleichmäßiges Zufalls-Sample angezeigt (Fisher-Yates Shuffle). Die Stats-Zeile zeigt die Anzahl der dargestellten Samples.

### Stats-Zeile

| Feld | Bedeutung |
|------|-----------|
| Iteration | Aktuelle Rektifikationsstufe (0 = Würfel) |
| Ecken | Anzahl Vertices (exakt aus Topologie, nicht Euler-Schätzung) |
| Kanten | Anzahl Kanten (verdoppelt sich pro Iteration: E' = 2E) |
| Flächen | Anzahl Flächen (F' = V + F) |
| Dauer | Berechnungszeit der Iteration im Web Worker |
| Samples | Angezeigte Vertex-Punkte (= alle, oder Sample bei hohen Iterationen) |
| Abweichung | Min/Max-Abweichung von der Best-Fit-Kugel in Prozent |
| Vorberechnet | Anzahl bereits im Hintergrund berechneter Iterationen |

Werte zeigen "-" an, solange die Iteration noch berechnet wird.

### Vorberechnung

Iterationen werden im Hintergrund sequentiell vorberechnet (0 → 1 → 2 → ...). Der Web Worker berechnet jeweils die nächste Iteration, sobald die vorherige fertig ist. Beim Klick auf "Weiter" wird entweder das vorberechnete Ergebnis sofort angezeigt oder eine Sanduhr (⏳), bis die Berechnung abgeschlossen ist.

## Bedienung

| Aktion | Desktop | Mobil |
|--------|---------|-------|
| Nächste Iteration | Weiter-Button oder → oder Leertaste | Weiter-Button |
| Vorherige Iteration | Zurück-Button oder ← | Zurück-Button |
| Automatisch durchlaufen | Auto-Button oder A | Auto-Button |
| Reset auf Würfel | Reset-Button oder R | Reset-Button |
| Körper drehen | Maus ziehen | Finger ziehen |
| Zoomen | Scrollrad | Pinch-Geste |

Die Auto-Rotation des Körpers pausiert 3 Sekunden nach manueller Interaktion und setzt dann wieder ein.

## Technische Umsetzung

### Architektur

```
  Main Thread                                            Web Worker
  (index.html)                                           (worker.js)

                          {iter}
  Three.js          ---------------------->              Topologische
  Rendering                                              Rektifikation
  UI/Events         <----------------------              Normalisierung
                     {coords, triIndices,                 Triangulierung
                      deviations, stats}
```

- **Main Thread** (`index.html`): Three.js-Szene, Kamera, Beleuchtung, Rendering, UI-Events. Keine geometrische Berechnung — nur Darstellung.
- **Web Worker** (`worker.js`): Topologische Rektifikation mit Polygon-Flächen. Pflegt eigenen Zustand (Vertices + Faces) über Iterationen. Gibt Koordinaten, triangulierte Indizes, Abweichungen und exakte Zählungen zurück.

### Topologische Rektifikation (worker.js)

Statt den Convex Hull zu berechnen und daraus Kanten zu extrahieren (ungenau bei fast-sphärischen Körpern), führt der Worker die **Flächen-Topologie** explizit mit:

1. **Kanten sammeln:** Aus den Polygon-Flächen werden alle Kanten und deren Mittelpunkte berechnet.
2. **Geschrumpfte Flächen:** Jede alte Fläche wird durch die Mittelpunkte ihrer Kanten ersetzt.
3. **Vertex-Figuren:** Für jeden alten Vertex werden die Mittelpunkte seiner Kanten in der richtigen zyklischen Reihenfolge (via Flächen-Adjazenz) zu einem neuen Polygon verbunden.
4. **Normalisierung:** Alle Vertices werden durch den Durchschnittsradius geteilt (nicht maxR — siehe Diskussion oben).
5. **Deviations:** Abstand jedes Vertex von der Einheitskugel nach Normalisierung.
6. **Triangulierung:** Fan-Triangulierung mit konsistenter Winding-Order (Normalen nach außen).

### Rendering (index.html)

- **BufferGeometry** statt ConvexGeometry — der Worker liefert triangulierte Indizes, der Main Thread muss keinen Hull mehr berechnen.
- **Zwei-Pass-Blending** für transparente Flächen (erst Rückseiten, dann Vorderseiten).
- **Farbcodierte Vertex-Punkte** über individuelle `MeshBasicMaterial`-Instanzen.
- **Sphärische Kamerasteuerung** ohne OrbitControls (vermeidet Pointer-Capture-Konflikte).
- **Auto-Rotation** mit 3s Pause nach manueller Interaktion.

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `cube-rectification.html` | Standalone — eine einzige HTML-Datei mit inline Worker, funktioniert ohne Server |
| `index.html` | Main Thread: Three.js-Rendering, UI, Kamerasteuerung |
| `worker.js` | Web Worker: Topologische Rektifikation, Normalisierung, Triangulierung |
| `favicon.png` / `favicon-32.png` | Favicons (64×64 / 32×32, RGBA PNG mit transparentem Hintergrund) |
| `og-image.jpg` | Open-Graph-Vorschaubild für WhatsApp / Social Media |

### Lokal starten

```bash
# Standalone (Doppelklick oder):
open cube-rectification.html

# Oder mit Server (für index.html + worker.js):
python3 -m http.server 8766
# → http://localhost:8766
```

## Lizenz

MIT

# Vom Würfel zur Kugel

Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wie er zur Kugel konvergiert.

**[Live-Demo](https://crambambuli.github.io/cube-to-sphere/cube-to-sphere.html)**

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

### Beweis: Konvergenz zur Kugel

**Behauptung:** Sei P<sub>0</sub> ein Würfel. Definiere P<sub>n+1</sub> als die konvexe Hülle der Kantenmittelpunkte von P<sub>n</sub>, normiert so dass max |v| = 1 für alle Vertices v. Dann konvergiert die Folge (P<sub>n</sub>) im Hausdorff-Abstand gegen die Einheitskugel S².

---

**Teil 1 — Symmetrie bleibt erhalten**

Der Würfel hat die Oktaedersymmetrie Oh (48 Operationen: Drehungen + Spiegelungen).

Jede Symmetrieoperation bildet Ecken auf Ecken ab, also Kanten auf Kanten, also Kantenmittelpunkte auf Kantenmittelpunkte. Die Menge der Mittelpunkte ist Oh-invariant, also ist die konvexe Hülle auch Oh-symmetrisch.

→ Jede Iteration erhält die Oh-Symmetrie. ✓

---

**Teil 2 — Abstandsstreuung nimmt ab**

Nach Normierung gilt r<sub>max</sub> = 1. Definiere die Sphärizität:

σ<sub>n</sub> = 1 − r<sub>min</sub>

Wir zeigen σ<sub>n</sub> → 0.

Für zwei benachbarte Vertices a, b mit Abständen r<sub>a</sub>, r<sub>b</sub> und Winkelabstand α gilt für den Mittelpunkt m = (a+b)/2:

|m|² = (r<sub>a</sub>² + r<sub>b</sub>² + 2·r<sub>a</sub>·r<sub>b</sub>·cos α) / 4

Die Mittelwertbildung reduziert Extremwerte: der minimale Abstand wird angehoben (gemittelt mit größeren Nachbarn), der maximale wird gesenkt (gemittelt mit kleineren).

Untere Schranke für den neuen Minimalabstand:

r<sub>min</sub>' ≥ (r<sub>min</sub> + r<sub>max</sub>)/2 · cos(α<sub>max</sub>/2)

---

**Teil 3 — Winkelabstände schrumpfen**

Der maximale Winkelabstand α<sub>max</sub> zwischen benachbarten Vertices halbiert sich asymptotisch:

α<sub>max</sub>(n+1) ≤ α<sub>max</sub>(n) · c   mit c < 1

Denn: jede Kante wird durch kürzere Kanten ersetzt, die Vertex-Anzahl verdoppelt sich (V' = E, E' = 2E nach Euler), die Punkte liegen immer dichter.

---

**Zusammenführung**

1. σ<sub>n+1</sub> < σ<sub>n</sub> · (1 − δ<sub>n</sub>) mit δ<sub>n</sub> > 0
2. α<sub>max</sub> → 0 geometrisch, also cos(α<sub>max</sub>/2) → 1
3. Teleskopprodukt: σ<sub>n</sub> → 0

Da σ<sub>n</sub> → 0, konvergiert der Hausdorff-Abstand d<sub>H</sub>(P<sub>n</sub>, S²) → 0. ∎

---

**Warum die Oh-Symmetrie entscheidend ist**

Ohne Symmetrie könnte ein Ellipsoid rauskommen. Die Oh-Symmetrie erzwingt, dass der Grenzkörper in allen 48 Orientierungen identisch aussieht. Der einzige glatte konvexe Körper mit dieser Eigenschaft ist die Kugel.

**Konvergenzrate:** σ<sub>n</sub> ≈ σ<sub>0</sub> · (1/2)ⁿ · C. Bei σ<sub>0</sub> ≈ 0,18 (Würfel) ist σ<sub>12</sub> ≈ 0,0001, also ca. 0,01% Abweichung.

### Warum konvergieren die Würfelecken langsamer?

In der Visualisierung sind die 8 Positionen der ursprünglichen Würfelecken noch bei Iteration 10+ als leichte Beulen erkennbar. Das ist kein numerischer Fehler, sondern hat mathematische Gründe.

**Nicht-uniforme Glättung.** Die Rektifikation behandelt verschiedene Regionen der Oberfläche unterschiedlich:

- **Würfelecken** (8 Stück): Hier treffen 3 Kanten im 90°-Winkel aufeinander — starke Krümmung. Bei jeder Iteration wird die Ecke durch ein Polygon ersetzt, aber die lokale Geometrie "erinnert" sich an die Singularität. Die Vertex-Dichte und der Abstand zum Zentrum unterscheiden sich hier von anderen Regionen.
- **Würfelflächen-Zentren** (6 Stück): Flache Regionen, die bei jeder Iteration flach bleiben und sich kaum verändern.
- **Würfelkanten-Mitten** (12 Stück): Mittlere Krümmung, konvergieren schneller.

Das ist analog zu **Subdivision Surfaces** in der Computergrafik: sogenannte "extraordinary vertices" (Vertices mit nicht-standardmäßiger Valenz) konvergieren deutlich langsamer gegen die Grenzfläche als reguläre Vertices. Die 8 Würfelecken sind genau solche Singularitäten.

**Die Normalisierung verstärkt den Effekt.** Nach jeder Iteration wird durch max(r) geteilt. Die Vertices nahe den Würfelecken sind tendenziell die am weitesten vom Zentrum entfernten — sie werden auf Abstand 1 normiert, während alle anderen Vertices innerhalb der Einheitskugel liegen. Die Ecken "beulen" sich dadurch systematisch heraus.

**Konvergenzgeschwindigkeit.** Das Verhältnis r<sub>min</sub>/r<sub>max</sub> verbessert sich nur linear (nicht exponentiell) pro Iteration, sodass bei Iteration 12 die Abweichung noch einige Prozent betragen kann — sichtbar als 8 leichte Beulen an den Oktaeder-Achsen.

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
- **Ab Iteration 5:** visuell kaum noch von einer Kugel zu unterscheiden

## Technische Umsetzung

- **Three.js** für 3D-Rendering (WebGL)
- **Web Worker** mit eigenem Convex-Hull-Algorithmus (Conflict-Lists, Adjazenz-BFS) für nicht-blockierende Berechnung
- **Analytische Statistiken** via Euler-Formel (exakt, keine Rundungsfehler)
- **Responsive** — funktioniert auf Desktop und Mobilgeräten (Touch-Rotation, Pinch-to-Zoom)

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `cube-to-sphere.html` | Standalone — eine einzige HTML-Datei, funktioniert ohne Server |
| `index.html` + `worker.js` | Zwei-Dateien-Version, braucht HTTP-Server |

### Lokal starten

```bash
# Standalone (Doppelklick oder):
open cube-to-sphere.html

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

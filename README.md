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

**Behauptung:** Sei P₀ ein Würfel. Definiere P_{n+1} als die konvexe Hülle der Kantenmittelpunkte von Pₙ, normiert so dass max |v| = 1 für alle Vertices v. Dann konvergiert die Folge (Pₙ) im Hausdorff-Abstand gegen die Einheitskugel S².

---

**Teil 1 — Symmetrie bleibt erhalten**

Der Würfel hat die Oktaedersymmetrie Oh (48 Operationen: Drehungen + Spiegelungen).

Jede Symmetrieoperation bildet Ecken auf Ecken ab, also Kanten auf Kanten, also Kantenmittelpunkte auf Kantenmittelpunkte. Die Menge der Mittelpunkte ist Oh-invariant, also ist die konvexe Hülle auch Oh-symmetrisch.

→ Jede Iteration erhält die Oh-Symmetrie. ✓

---

**Teil 2 — Abstandsstreuung nimmt ab**

Nach Normierung gilt r_max = 1. Definiere die Sphärizität:

    σₙ = 1 − r_min

Wir zeigen σₙ → 0.

Für zwei benachbarte Vertices a, b mit Abständen rₐ, r_b und Winkelabstand α gilt für den Mittelpunkt m = (a+b)/2:

    |m|² = (rₐ² + r_b² + 2·rₐ·r_b·cos α) / 4

Die Mittelwertbildung reduziert Extremwerte: der minimale Abstand wird angehoben (gemittelt mit größeren Nachbarn), der maximale wird gesenkt (gemittelt mit kleineren).

Untere Schranke für den neuen Minimalabstand:

    r_min' ≥ (r_min + r_max)/2 · cos(α_max/2)

---

**Teil 3 — Winkelabstände schrumpfen**

Der maximale Winkelabstand α_max zwischen benachbarten Vertices halbiert sich asymptotisch:

    α_max(n+1) ≤ α_max(n) · c   mit c < 1

Denn: jede Kante wird durch kürzere Kanten ersetzt, die Vertex-Anzahl verdoppelt sich (V' = E, E' = 2E nach Euler), die Punkte liegen immer dichter.

---

**Zusammenführung**

1. σ_{n+1} < σₙ · (1 − δₙ) mit δₙ > 0
2. α_max → 0 geometrisch, also cos(α_max/2) → 1
3. Teleskopprodukt: σₙ → 0

Da σₙ → 0, konvergiert der Hausdorff-Abstand d_H(Pₙ, S²) → 0. ∎

---

**Warum die Oh-Symmetrie entscheidend ist**

Ohne Symmetrie könnte ein Ellipsoid rauskommen. Die Oh-Symmetrie erzwingt, dass der Grenzkörper in allen 48 Orientierungen identisch aussieht. Der einzige glatte konvexe Körper mit dieser Eigenschaft ist die Kugel.

**Konvergenzrate:** σₙ ≈ σ₀ · (1/2)ⁿ · C. Bei σ₀ ≈ 0.18 (Würfel) ist σ₁₂ ≈ 0.0001, also ca. 0.01% Abweichung.

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

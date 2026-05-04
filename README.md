# Vom Würfel zur Kugel?

Interaktive 3D-Visualisierung: Einen Würfel iterativ rektifizieren und beobachten, wohin er konvergiert.

**[Live-Demo](https://crambambuli.github.io/cube-to-sphere/cube-rectification.html)**

![Vorschau](og-image.jpg)

## Das Problem

Gegeben ein Würfel. Man halbiert alle Kanten und schneidet an den Mittelpunkten die Ecken ab. Es entsteht ein neuer konvexer Körper mit mehr Flächen, Kanten und Ecken. Dieses Verfahren wiederholt man: wieder alle Kanten halbieren, wieder die Ecken abschneiden — und immer so weiter.

**Frage:** Welche Form entsteht, wenn man diesen Prozess unendlich oft wiederholt?

**Antwort:** Keine Kugel. Der Körper konvergiert gegen einen spezifischen O<sub>h</sub>-symmetrischen konvexen Körper mit ca. 14% Durchmesser-Variation — kugelähnlich, aber messbar nicht-sphärisch.

## Mathematischer Hintergrund

Die Operation heißt **Rektifikation** (oder anschaulich **Mittenkappung**) — man halbiert die Kanten und kappt die Ecken bis zu den entstandenen Mittelpunkten. Anders formuliert: jeder Vertex wird durch eine neue Fläche ersetzt, jede Fläche durch eine kleinere Version ihrer selbst, die neuen Vertices sind genau die Mittelpunkte der alten Kanten.

### Woher kommt das Wort?

Etymologisch geht "Rektifikation" auf lateinisch *rēctus* (gerade, recht, richtig) + *facere* (machen) zurück — wörtlich also "ins Lot bringen" oder "berichtigen". Der Begriff wird in mehreren Disziplinen verwendet:

- **Chemie/Verfahrenstechnik:** Reinigung einer Flüssigkeit durch wiederholte Destillation.
- **Elektrotechnik:** Gleichrichtung — Wechselstrom (oszillierende Welle) wird in Gleichstrom (gerade Linie) umgewandelt.
- **Photogrammetrie:** Herausrechnen perspektivischer Verzerrungen, bis Bildlinien wieder gerade sind.
- **Polyedertheorie:** geprägt von H. S. M. Coxeter Anfang des 20. Jahrhunderts für die Operation, die einen konvexen Körper *symmetrischer* macht.

### Der "richtig gemachte" Körper

Coxeters Idee: ein Polyeder und sein duales Gegenstück sind in gewisser Weise "Gegensätze" (Würfel ↔ Oktaeder: 8 Ecken ↔ 8 Flächen, 6 Flächen ↔ 6 Ecken, gleiche Symmetriegruppe). Die Rektifikation ist die **ausgewogene Mitte** zwischen beiden:

- Die Rektifikation des Würfels (= unsere Iter 1) ist das **Kuboktaeder**.
- Sie ist gleichzeitig auch die Rektifikation des Oktaeders — der Mittelweg trifft beide Duale am gleichen Punkt.

Der Körper wird "ins Lot gebracht" im Sinne der Symmetrie: das Kuboktaeder ist **quasiregulär** — alle Vertices sehen gleich aus *und* alle Kanten sehen gleich aus. Beim Würfel gilt nur "Vertices gleich" (jede Kante grenzt an zwei Quadrate, also gleich, aber jede Ecke berührt drei Quadrate), beim Oktaeder umgekehrt nur "Kanten gleich". Erst die Rektifikation kombiniert beide Eigenschaften — der Körper ist in diesem präzisen Sinn "rektifiziert", also *richtig* symmetrisch.

In der App sieht man diesen Effekt am Übergang Iter 0 → Iter 1 — und auch, dass die Quasiregularität ab Iter 2 wieder verloren geht: das Rhombikuboctaeder hat zwei Kantentypen (Dreieck-Quadrat und Quadrat-Quadrat). **Nur Iter 1 erreicht die maximale Symmetrie.** Die weiteren Iterationen glätten den Körper kugelähnlicher, bringen aber keine zusätzliche "Rektifikation" im Coxeter-Sinn.

### Topologische Rektifikation vs. konvexe Hülle

Soweit die mathematische Idee. Bei der konkreten Umsetzung gibt es eine Wahl: Wie verbindet man die neuen Vertices zu Flächen? Die App implementiert **zwei Varianten** mit unterschiedlichem Verhalten — eine kombinatorische und eine rein geometrische. Beide wirken auf dieselben Eingabepunkte (die Kantenmittelpunkte), unterscheiden sich aber in der Eingabe-Information und der Konstruktionsregel:

**Topologische Rektifikation.** Eingabe: ein Polyeder mit kombinatorischer Struktur — Vertices, Kanten, Flächen und deren Inzidenzbeziehungen. Definition: eine **kombinatorische Vorschrift**, wie aus der alten Topologie eine neue konstruiert wird:

- Jede alte Kante → ein neuer Vertex (in der Mitte)
- Jede alte Fläche mit n Ecken → eine neue n-eckige Fläche aus den Mittelpunkten ihrer Kanten ("geschrumpfte Fläche")
- Jede alte Ecke mit Grad d → eine neue d-eckige Fläche aus den Mittelpunkten der dort einlaufenden Kanten ("Vertex-Figur")

Output: Polyeder mit vorgegebener Topologie. Die geometrischen Positionen der neuen Vertices liegen fest (Kantenmittelpunkte), aber **ob die Flächen plan sind, steht nicht im Voraus fest** — die 4 Mittelpunkte einer Vertex-Figur müssen nicht koplanar sein. Verschiebt man die Eingabevertices, ändert sich nur die Geometrie, nicht die Anzahl/Topologie der Flächen.

**Konvexe Hülle.** Eingabe: eine Menge von Punkten im Raum (ohne weitere Struktur). Definition: der kleinste konvexe Körper, der alle Punkte enthält. Output:

- Vertices = Teilmenge der Eingabepunkte (genau die extremen)
- Flächen = strikt **planare** Polygone (per Definition liegt jede Fläche in einer Ebene)
- Topologie wird **rein geometrisch** durch die Punktkoordinaten bestimmt

Ein Punkt ist genau dann ein Hull-Vertex, wenn er nicht im Inneren der Hülle der übrigen Punkte liegt. Eine Fläche entsteht aus drei oder mehr Punkten, die auf einer Ebene liegen, sofern alle anderen Punkte auf derselben Seite dieser Ebene sind. Verschiebt man die Punkte etwas, kann sich die Topologie sprunghaft ändern (z. B. spaltet ein Quad in zwei Dreiecke, sobald die 4 Punkte nicht mehr koplanar sind).

**Anschauung — Schrumpffolie / Vakuumverpackung:** Stell dir die Punkte als kleine Nägel oder Murmeln vor, die im 3D-Raum schweben. Lege eine elastische Plastikfolie locker um alle Punkte und sauge die Luft heraus. Die Folie zieht sich zusammen und schmiegt sich an die äußersten Punkte an:

- Punkte, die die Folie *berühren*, sind die **Hull-Vertices** — alle anderen Punkte sind im Inneren versteckt.
- Stellen, an denen die Folie zwischen drei oder mehr Punkten *flach gespannt* liegt, sind die **Flächen**.
- Stellen zwischen genau zwei Punkten sind die **Kanten**.

In 2D ist das gleiche Bild ein Gummiband um Nägel auf einem Brett: das Band schnappt zum kleinsten konvexen Polygon zusammen, Nägel im Inneren werden ignoriert.

**Charakteristische Eigenschaften einer konvexen Hülle:**

- **Konvex.** Die Hülle kann nirgends nach innen einbeulen. Formal: für je zwei Punkte p, q ∈ Hülle liegt die ganze Verbindungsstrecke wieder in der Hülle. Anschaulich: eine gerade Linie zwischen zwei Hull-Punkten verläuft immer durch das Innere oder auf der Oberfläche, niemals außen herum.
- **Minimal.** Sie ist die *engstmögliche* konvexe Verpackung der Punktmenge — jede kleinere konvexe Form würde mindestens einen Punkt nicht mehr enthalten. Formal: gleich dem Schnitt aller konvexen Mengen, die alle Eingabepunkte enthalten.
- **Eindeutig.** Bei gegebener Punktmenge gibt es genau eine konvexe Hülle (im Gegensatz z. B. zur Triangulierung, die viele Lösungen erlaubt).
- **Vertices ⊆ Eingabepunkte.** Jeder Hull-Vertex ist ein Eingabepunkt; keine neuen Punkte werden erfunden. Genau die *extremen* Punkte (= solche, die nicht im Inneren der Hülle der übrigen liegen) erscheinen als Vertices.
- **Flächen exakt planar.** Per Definition entsteht jede Fläche aus Punkten, die auf einer gemeinsamen Ebene liegen, sodass alle anderen Punkte auf derselben Seite dieser Ebene sind.
- **Geometrisch, nicht kombinatorisch.** Die Hülle hängt nur von den Koordinaten ab, nicht von einer Eingabe-Topologie. Verschiebt man Punkte stetig, kann sich die Hull-Topologie sprunghaft ändern (z. B. ein Quad spaltet in zwei Dreiecke, sobald 4 Punkte aus der Koplanarität fallen).
- **Niemals leer (für ≥ 4 nicht-koplanare Punkte in 3D).** Bei nur 3 koplanaren Punkten degeneriert die "Hülle" zu einem Dreieck (2D im 3D-Raum).

### Wo die Varianten auseinandergehen

Bei einem **konvexen** Eingabepolyeder mit **planaren** Vertex-Figuren (z. B. Würfel, Kuboctaeder) liefern beide dasselbe Ergebnis. Bei nicht-planaren Vertex-Figuren divergieren sie:

| | Topologisch | Konvexe Hülle |
|--|--|--|
| Behandelt 4 nicht-koplanare Mittelpunkte als | **ein** Quad (gewölbt) | **zwei** Dreiecke |
| Macht aus 4 koplanaren benachbarten Quads | 4 separate Quads | **ein** Hexagon |
| Topologie über alle Iterationen | konstant (8 Dreiecke + Rest Quads) | wechselnd |
| Definition setzt voraus | Polyeder mit Inzidenzstruktur | nur eine Punktmenge |

**Anschaulich:** Die topologische Variante "vererbt" das Schnittmuster aus der vorherigen Iteration. Die konvexe Hülle "vergisst" die Geschichte und schaut nur, wie die Punkte tatsächlich im Raum liegen.

Mit dem Schrumpffolien-Bild wird auch klar, warum beide Varianten **bis Iter 4 identisch** sind: solange alle Vertex-Figur-Quads exakt planar sind, schmiegt sich die Folie an genau diese Quads an. **Ab Iter 5** sind manche Quads leicht gewölbt — die Folie muss sich um die gewölbte Form herum spannen und teilt sie in zwei plane Dreiecke auf. Genau das ist der Symmetriebruch in der Convex-Hull-Variante.

Beide konvergieren bei endloser Iteration gegen **denselben Grenzkörper** — sie unterscheiden sich nur in der Wahl der Triangulierung der non-planaren Vertex-Figuren bei endlichen Iterationen.

### Was beide Varianten gemeinsam haben

**Vertex-Anzahl V' = E.** Pro Iteration wird jeder Kantenmittelpunkt zu einem neuen Vertex. Die alten Vertices verschwinden. V verdoppelt sich nicht ganz, aber wächst exponentiell.

**O<sub>h</sub>-Symmetrie.** Der Würfel hat die Oktaedersymmetrie O<sub>h</sub> mit 48 Symmetrieoperationen. Die Bezeichnung stammt aus der Schoenflies-Notation: **O** steht für die Oktaeder-Drehgruppe (24 reine Drehungen), **h** für die Erweiterung um Spiegelungen.

Jede Symmetrieoperation bildet Ecken auf Ecken, Kanten auf Kanten, Kantenmittelpunkte auf Kantenmittelpunkte ab. Die Menge der Mittelpunkte ist O<sub>h</sub>-invariant → die konvexe Hülle auch → jede Iteration erhält die O<sub>h</sub>-Symmetrie. ✓

**Konvergenz gegen einen nicht-sphärischen Grenzkörper.** Die Vermutung liegt nahe, dass iterierte Rektifikation den Würfel zu einer Kugel glättet. Die numerische Simulation zeigt jedoch, dass die Abweichung von der Best-Fit-Kugel gegen einen festen Wert konvergiert, nicht gegen null:

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

**Die Ursache: topologische Nicht-Uniformität.** Ab Iteration 1 haben alle Vertices Grad 4 (4 angrenzende Kanten) — der Vertex-Grad ist also homogen. Die Heterogenität liegt in der **Flächen-Nachbarschaft**: welche Flächentypen an einem Vertex zusammenkommen.

Die 8 Dreiecke aus den ursprünglichen Würfelecken bleiben über alle Iterationen als Flächen erhalten (sie schrumpfen nur). Sie sind die topologischen Singularitäten — alle anderen Flächen sind Vierecke oder werden aus solchen gebildet. Damit gibt es Vertices, die an ein Dreieck grenzen, und Vertices, die nur an Vierecke grenzen:

- **Iter 1** (Kuboctaeder): Jeder Vertex grenzt an 2 Dreiecke + 2 Quadrate — noch homogen.
- **Iter 2** (24 Vertices): Jeder Vertex grenzt an 1 Dreieck + 3 Vierecke — noch homogen.
- **Iter 3** (48 Vertices): Zwei Vertex-Klassen
  - 24 Vertices "nahe einem Dreieck" — grenzen an 1 geschrumpftes Dreieck + 3 Vierecke
  - 24 Vertices "weiter weg" — grenzen an 4 Vierecke
- **Iter 4+**: Mehr Klassen je nach Abstand zur nächsten Würfelecke.

Bei höheren Iterationen entstehen also immer mehr Vertex-Klassen, die sich durch ihre Entfernung zu den 8 Dreiecks-Singularitäten unterscheiden. Diese strukturelle Asymmetrie erzeugt einen stationären Zustand, in dem die Beulen an den 8 Würfelecken-Positionen und die Dellen an den 6 Flächenzentren dauerhaft bestehen bleiben.

**Vergleich mit Subdivision Surfaces:** In der Computergrafik ist bekannt, dass "extraordinary elements" (Vertices oder Flächen mit nicht-standardmäßiger Valenz) in Catmull-Clark-Subdivision die Grenzfläche lokal deformieren — die Glattheit nimmt dort ab, charakteristische "Falten" oder "Beulen" bleiben bestehen. Das gleiche Prinzip gilt hier: die 8 Dreiecke sind die "extraordinary faces" in einem ansonsten Quad-dominierten Mesh, und die Vertices auf ihren Ecken sind "extraordinary vertices" mit besonderer Flächen-Nachbarschaft.

### Variante 1: Topologische Rektifikation

Bei jeder Iteration entstehen zwei Typen neuer Flächen:

- **Geschrumpfte Flächen**: Jede alte Fläche wird durch eine kleinere Fläche mit gleicher Kantenzahl ersetzt. Die Ecken der neuen Fläche sind die Mittelpunkte der alten Kanten. Ein Quadrat wird zu einem kleineren Quadrat, ein Dreieck zu einem kleineren Dreieck.

- **Vertex-Figuren**: Wenn man "die Ecken abschneidet", bleibt an jeder alten Ecke eine Schnittfläche. Ihre Kantenzahl entspricht dem Grad des alten Vertex. Beim Würfel hat jede Ecke 3 Kanten → Vertex-Figur ist ein Dreieck. Ab Iteration 1 haben alle Vertices Grad 4 → alle Vertex-Figuren sind Vierecke.

#### Euler-Formeln

Bei jeder Iteration gilt exakt (beweisbar über V - E + F = 2):

| Größe | Formel | Entwicklung |
|-------|--------|-------------|
| Ecken | V' = E | 8 → 12 → 24 → 48 → 96 → 192 → ... |
| Kanten | E' = 2E | 12 → 24 → 48 → 96 → 192 → 384 → ... |
| Flächen | F' = V + F | 6 → 14 → 26 → 50 → 98 → 194 → ... |

Die Kanten verdoppeln sich exakt bei jeder Iteration.

#### Nur Dreiecke und Vierecke

Ab Iteration 1 gibt es ausschließlich **Dreiecke** und **Vierecke** — keine Fünf-, Sechsecke oder höher.

Der Grund: Jeder neue Vertex ist der Mittelpunkt einer alten Kante. Jede alte Kante grenzt an genau 2 Flächen und hat 2 Endpunkte (mit je einer Vertex-Figur). Also ist jeder neue Vertex von genau 4 Flächen umgeben → **alle Vertices haben Grad 4** → alle Vertex-Figuren sind Vierecke.

Konkret:
- **8 Dreiecke** — von den 8 Würfelecken. Bleiben als geschrumpfte Dreiecke über alle Iterationen erhalten.
- **Alle anderen Flächen: Vierecke** — geschrumpfte Quads + Vertex-Figuren (Grad 4).

#### Sind die Flächen immer plan?

Geschrumpfte Flächen liegen immer exakt in einer Ebene (die Mittelpunkte der Kanten einer planaren Fläche sind koplanar). ✓

Vertex-Figuren (Vierecke) sind genau dann plan, wenn die 4 Nachbarn des alten Vertex koplanar sind. Das ist **nicht immer** der Fall:

- **Dreiecke** (die 8 von den Würfelecken): immer exakt plan — 3 Punkte definieren eine Ebene. ✓
- **Iter 1→2**: Der Kuboctaeder ist kantentransitiv (alle Kanten unter O<sub>h</sub> äquivalent). Die O<sub>h</sub>-Symmetrie erzwingt Koplanarität → alle Quads exakt plan. ✓
- **Iter 2→3**: Nicht mehr kantentransitiv. Quads an hochsymmetrischen Positionen (z.B. mit 4-facher Rotationsachse) sind noch exakt plan. Quads an weniger symmetrischen Positionen können leicht nicht-planar sein.
- **Ab Iter ~4-5**: Die meisten Quads sind fast plan, aber mathematisch nicht exakt — die lokale Symmetrie reicht nicht mehr aus.
- **Größenordnung der Abweichung**: proportional zum Quadrat der Kantenlänge — bei Iter 3 in der Größenordnung 10⁻², bei Iter 10+ unter 10⁻⁸.

#### Rendering nicht-planarer Quads

Bei einem nicht-planaren Quad muss die 3D-Darstellung eine Entscheidung treffen, wie die Fläche approximiert wird:

1. **Fan-Triangulierung (2 Dreiecke):** Quad wird entlang einer willkürlichen Diagonale in 2 Dreiecke geteilt. Einfach, aber erzeugt einen Knick an der Diagonale.
2. **Mittelpunkt-Triangulierung (4 Dreiecke):** ✅ Der Schwerpunkt der 4 Ecken wird als 5. Vertex eingefügt, das Quad in 4 Dreiecke geteilt. Der Knick wird gleichmäßig auf alle 4 Seiten verteilt. **Diese Variante ist implementiert.**
3. **Kürzeste Diagonale:** Wie (1), aber die Diagonale mit dem kleineren Knickwinkel wählen.
4. **Bilineare Interpolation:** Das Quad als gewölbte Fläche (bilineares Patch) rendern, unterteilt in ein feines Gitter. Kein Knick, dafür höhere GPU-Last.
5. **Catmull-Clark Subdivision:** Jedes Quad in 4 Sub-Quads mit geglätteten Positionen unterteilen. Erzeugt eine glatte Oberfläche, verändert aber die Geometrie.

### Variante 2: Convex-Hull-Rektifikation

Statt die Vertex-Figuren als (möglicherweise non-planare) Polygone topologisch fortzuschreiben, kann man die Operation rein geometrisch definieren: pro Iteration **alle Kantenmittelpunkte sammeln und ihre konvexe Hülle bilden**. Die Vertex-Anzahl bleibt identisch (V' = E), aber non-planare Vertex-Figuren werden vom Hull-Algorithmus zwangsläufig in mehrere Dreiecke aufgespalten. Die resultierenden Flächen sind per Definition immer exakt plan.

Da alle Vertex-Koordinaten dyadisch rational sind (Nenner 2<sup>iter</sup>), kann der Hull-Algorithmus mit **exakter Integer-Arithmetik** rechnen — keine Floating-Point-Toleranzen, keine Rundungsfehler. Die Ergebnisse stimmen exakt mit `scipy.spatial.ConvexHull` überein.

#### Algorithmus

Der implementierte Hull-Algorithmus ist ein **inkrementeller 3D-Convex-Hull** mit anschließendem **koplanaren Polygon-Merge**:

**Schritt 1 — Integer-Repräsentation.** Die Vertex-Koordinaten der vorherigen Iteration liegen als Floats vor, sind aber exakt darstellbar (dyadisch rational mit Nenner 2<sup>iter−1</sup>). Wir multiplizieren mit 2<sup>iter−1</sup> und runden, um die ganzzahligen Koordinaten exakt zurückzugewinnen.

**Schritt 2 — Edge-Midpoints.** Für jede Polygon-Kante (a, b) der vorherigen Iteration berechnen wir den Mittelpunkt. In Integer-Arithmetik wird das einfach zu `int_a + int_b` (kein Division), wobei der neue Maßstab automatisch 2<sup>iter</sup> ist. Beispiel: Würfelvertices ±1 (Maßstab 1), Edge-Midpoint von (1,1,1) und (−1,1,1) ist int (0, 2, 2) im 2-fach feineren Gitter, was real (0, 1, 1) entspricht.

**Schritt 3 — Initiales Tetraeder.** Wir wählen 4 nicht-koplanare Punkte als Startsimplex:
1. Punkt mit minimalem x.
2. Punkt mit maximalem x.
3. Punkt mit größtem Abstand zur Linie zwischen den beiden ersten.
4. Punkt mit größtem (vorzeichenbehaftetem) Abstand zur Ebene der ersten drei.

Die Orientierung der vier Tetraeder-Flächen wird so festgelegt, dass alle Normalen nach außen zeigen.

**Schritt 4 — Inkrementelle Erweiterung.** Für jeden weiteren Punkt p:
1. **Sichtbarkeitstest:** Eine Fläche f mit Normale n und Stützwert d ist von p aus sichtbar gdw. n·p ≥ d. Mit gecachten Integer-Normalen ist das ein einziges Skalarprodukt + Vergleich, exakt ohne Toleranz. Koplanare Punkte (n·p = d) werden als sichtbar behandelt — sonst gingen sie als Hull-Vertices verloren.
2. **Sichtbare Region entfernen:** Alle sichtbaren Flächen werden gelöscht.
3. **Grenzkanten finden:** Eine Kante ist Grenze gdw. sie nur in einer entfernten Fläche vorkam (innere Kanten der entfernten Region kommen zweimal vor und heben sich auf). Implementiert via Map mit gerichteten Kanten — gegenläufige Paare löschen sich.
4. **Cone bilden:** Für jede Grenzkante (a, b) wird ein neues Dreieck (a, b, p) angelegt, mit cached Integer-Normale für künftige Sichtbarkeitstests.

**Schritt 5 — Koplanare Dreiecke mergen.** Der Hull liefert nur Dreiecke. Größere planare Flächen (Quads, Pentagons, Hexagons) entstehen durch Zusammenfassen koplanarer Nachbarn:
1. Für jede gemeinsame Kante zweier Dreiecke (a, b, c) und (a, b, d) wird die 3×3-Determinante det(b−a, c−a, d−a) ausgewertet. = 0 ⇒ koplanar (exakter Test über Integer-Differenzen).
2. Union-Find fasst alle paarweise koplanaren Dreiecke zu einem Cluster zusammen.
3. Pro Cluster werden die Boundary-Kanten extrahiert (Kanten die nur einmal vorkommen) und zu einem zyklischen Polygon verbunden.

**Komplexität.** Der inkrementelle Algorithmus ist im Worst-Case O(n²), für unsere Verteilungen in der Praxis ähnlich (jeder Punkt sieht ~ O(n<sup>1/2</sup>) Flächen). Bei iter 11 mit ~31.000 Punkten dauert die Berechnung ca. 17 s. Quickhull (O(n log n) im Mittel) wäre asymptotisch besser, würde die exakten Predikate aber komplizierter machen.

**Numerische Sicherheit.** Bei iter ≤ 14 bleiben alle Zwischenwerte (Cross-Products, Determinanten) innerhalb des JavaScript Safe-Integer-Bereichs (< 2<sup>53</sup>). Konkret: bei iter 12 sind Vertex-Koordinaten bis ±4096, Cross-Product-Komponenten bis ~7×10<sup>7</sup>, Determinanten-Terme bis ~3×10<sup>12</sup>. Für höhere Iterationen wäre BigInt nötig.

| Iter | V | E | F | n-Eck-Verteilung |
|------|------|------|------|------|
| 0 | 8 | 12 | 6 | 4-Eck:6 |
| 1 | 12 | 24 | 14 | 3-Eck:8, 4-Eck:6 |
| 2 | 24 | 48 | 26 | 3-Eck:8, 4-Eck:18 |
| 3 | 48 | 96 | 50 | 3-Eck:8, 4-Eck:42 |
| 4 | 96 | 192 | 98 | 3-Eck:8, 4-Eck:90 |
| **5** | **192** | **432** | **242** | **3-Eck:104, 4-Eck:138** |
| 6 | 432 | 1.008 | 578 | 3-Eck:296, 4-Eck:282 |
| 7 | 1.008 | 2.352 | 1.346 | 3-Eck:680, 4-Eck:666 |
| 8 | 2.352 | 5.424 | 3.074 | 3-Eck:1.448, 4-Eck:1.626 |
| 9 | 5.424 | 13.008 | 7.586 | 3-Eck:4.376, 4-Eck:3.162, 5-Eck:48 |
| 10 | 13.008 | 31.104 | 18.098 | 3-Eck:10.376, 4-Eck:7.578, 5-Eck:96, 6-Eck:48 |
| 11 | 31.104 | 75.168 | 44.066 | 3-Eck:26.360, 4-Eck:17.322, 5-Eck:336, 6-Eck:48 |
| 12 | 75.168 | 181.776 | 106.610 | 3-Eck:63.944, 4-Eck:41.658, 5-Eck:960, 6-Eck:48 |

**Iter 0–4: identisch zur topologischen Rektifikation.** Alle Vertex-Figuren sind durch die residuelle Symmetrie *mathematisch exakt koplanar* — der Determinanten-Test der Integer-Arithmetik liefert exakt 0, der Hull-Algorithmus sieht sie als ein Quad. Es gibt genau 8 Dreiecke (die unveränderten Würfelecken).

**Iter 4 → 5: Symmetriebruch.** 48 Vertex-Figur-Quads werden non-planar genug, dass der Hull sie in je 2 Dreiecke spaltet:
- +48 Diagonalen (Kanten)
- +48 Flächen (-1 Quad +2 Dreiecke = +1 Fläche)
- 0 zusätzliche Vertices

Die Zahl **48** ist exakt die Ordnung der Symmetriegruppe O<sub>h</sub> — also genau eine generische O<sub>h</sub>-Bahn von Quads bricht zuerst die Planarität.

**Iter 9: Pentagons. Iter 10: Hexagons.** Bei höheren Iterationen entstehen 5- und 6-Ecke, wenn mehrere non-planare Quads im Hull zu einem größeren Polygon mergen.

**Bemerkenswerte Muster bei höheren Iterationen:**

- **Hexagons bleiben konstant bei 48.** Seit ihrem ersten Auftreten in Iter 10 ist die Anzahl der 6-Ecke unverändert: 48 in Iter 10, 11, 12. Das ist genau eine O<sub>h</sub>-Bahn — vermutlich entstehen sie an einer einzigen ausgezeichneten Symmetrie-Position (möglicherweise auf den 3-fachen Achsen durch die Würfelecken, dort wo 3 Dreiecke benachbart sind) und bleiben in jeder Iteration als ein einzelner stabiler Orbit erhalten.
- **Pentagons wachsen stark.** Anzahl der 5-Ecke: 48 → 96 → 336 → 960. Die Sprünge folgen keinem einfachen Verdopplungsmuster — die Wachstumsfaktoren sind ×2, ×3,5, ×2,86. Sie entstehen an immer mehr Symmetrie-Positionen, wenn weitere Quads non-planar werden.
- **Dreiecke und Vierecke skalieren ungefähr proportional zur Vertex-Anzahl** und dominieren die Topologie. Ihr Verhältnis schwankt aber: bei iter 10 sind ~57% der Flächen Dreiecke, bei iter 12 schon ~60%.
- **Die 48 ist allgegenwärtig**, weil |O<sub>h</sub>| = 48: alle generischen Bahnen haben Größe 48, höhersymmetrische Positionen produzieren Teiler von 48 (24, 12, 8, 6).

### Monotonie des Durchschnittsradius

Pro Iteration ist jeder neue Vertex der Mittelpunkt einer alten Kante (a, b):

|v<sub>neu</sub>| = |v<sub>a</sub> + v<sub>b</sub>| / 2 ≤ (|v<sub>a</sub>| + |v<sub>b</sub>|) / 2

Aus der Dreiecksungleichung — strikt für nicht-parallele Vektoren — folgt eine obere Schranke für den neuen Durchschnittsradius:

rAvg(N+1) < (1 / (2·E<sub>N</sub>)) · Σ<sub>v</sub> deg(v) · |v|

Das ist eine **gradgewichtete Durchschnittsbildung** über die alten Vertices. Wenn alle Grade gleich sind, fällt die Gewichtung weg und der Ausdruck ist exakt rAvg(N) — strenge Monotonie.

| Variante | Vertex-Grade | Folge |
|----------|--------------|-------|
| Topologisch | alle Vertices Grad 4 (ab Iter 1) | rAvg(N+1) < rAvg(N) **strikt monoton fallend** |
| Convex Hull | gemischt (4, 5, 6+) ab Iter 5 | Monotonie ist nicht garantiert |

Konkrete Werte:

| Iter | Topo rAvg | Hull rAvg |
|------|-----------|-----------|
| 5 | 1,088670 | 1,088670 |
| 6 | 1,079595 | 1,078814 |
| 7 | 1,075137 | 1,075601 |
| 8 | 1,072915 | 1,074486 |
| 9 | 1,071809 | **1,074741 ↑** |
| 10 | 1,071257 | **1,075112 ↑** |
| 11 | 1,070981 | **1,075743 ↑** |
| 12 | 1,070843 | 1,075705 ↓ |

Topo schrumpft monoton; Hull steigt ab Iter 9 zunächst wieder an und beginnt bei Iter 12 minimal zu oszillieren — die Monotonie geht ganz verloren.

**Warum?** In der Hull-Variante haben Vertices, an denen non-planare Quads getrennt wurden, einen Diagonalen-Zuschlag im Grad: aus 4 wird 5 oder mehr. Diese hochgradigen Vertices sitzen genau dort, wo die lokale Geometrie am stärksten von der Sphärizität abweicht — **an den Beulen** (an den 8 Würfelecken-Positionen). Damit:

- Hochgradige Vertices = "Beulen-Vertices" = überdurchschnittlich weit vom Zentrum
- In der gradgewichteten Summe sind sie überproportional vertreten
- Der weighted-avg übersteigt rAvg(N)
- Die obere Schranke lässt rAvg(N+1) ≥ rAvg(N) zu

**Konsequenz.** Beide Varianten konvergieren formal gegen denselben Grenzkörper, aber sie produzieren verschieden verteilte Stichproben auf seiner Oberfläche:

- Topo: gleichmäßige Stichprobe (alle Vertices Grad 4) → rAvg konvergiert *von oben* gegen einen Grenzwert
- Hull: Stichprobe mit Bias zu den Beulen → rAvg konvergiert nach kurzem Schrumpfen *von unten* gegen einen leicht höheren Wert (Bias-getrieben in Richtung Maximalradius)

Beide Werte sind korrekte Mittelwerte ihrer jeweiligen Vertex-Mengen — sie messen lediglich unterschiedliche Sample-Verteilungen desselben Grenzkörpers.

### Vergleich der beiden Varianten

| | Topologische Rektifikation | Convex-Hull-Rektifikation |
|--|--|--|
| Vertex-Anzahl | identisch (V' = E) | identisch (V' = E) |
| Kanten-Anzahl | E' = 2E (immer) | ≥ 2E, divergiert ab Iter 5 |
| Flächen | Polygone (möglicherweise non-planar) | exakt planar |
| Topologie | konstant: 8 Dreiecke + Rest Quads | wechselnd: ab Iter 5 mehr Dreiecke, ab Iter 9 Pentagons, ab Iter 10 Hexagons |
| Konvergenz | gleicher Grenzkörper im Limes | gleicher Grenzkörper im Limes |

Beide Varianten sind in der App per Toggle-Button umschaltbar (nur im Polyeder-Modus, Iter ≤ 12). Sie werden parallel auf zwei separaten Web Workern berechnet — die schnellere Topo-Variante muss nicht auf die langsamere Hull-Variante warten.

### Der Grenzkörper

Der Grenzkörper ist ein wohldefinierter O<sub>h</sub>-symmetrischer konvexer Körper mit:
- 8 leichten Beulen an den Positionen der ursprünglichen Würfelecken
- 6 leichten Dellen an den Positionen der ursprünglichen Flächenzentren
- ca. 14% Unterschied zwischen größtem und kleinstem Durchmesser
- unendlich vielen Flächen (im Grenzwert glatt)

Er ist **kein** bekannter Standardkörper (weder Kugel noch ein reguläres Polyeder).

### Bemerkenswerte Zwischenkörper

- **Iteration 0:** Würfel (8 Ecken, 12 Kanten, 6 Flächen)
- **Iteration 1:** Kuboctaeder (12 Ecken, 24 Kanten, 14 Flächen) — ein archimedischer Körper
- **Iteration 2:** Rhombikuboctaeder (24 Ecken, 48 Kanten, 26 Flächen) — ebenfalls archimedisch
- **Ab Iteration 5:** visuell kugelähnlich, aber messbar nicht-sphärisch

## Die Anwendung

### Darstellung

Die Anwendung zeigt den Körper in zwei Modi:

- **Iteration 0–12 (Polyeder-Modus):** Halbtransparente Flächen mit weißen Kanten und farbcodierten Vertex-Punkten. Die Flächen werden in zwei Passes gerendert (Rückseite, dann Vorderseite) für korrektes Alpha-Blending. Beim Iterationswechsel wird fließend zwischen altem und neuem Körper überblendet (1s Cross-Fade mit Ease-in-out).

![Topologische Rektifikation mit Flächen, Kanten und Vertex-Punkten](topologische-rektifikation.jpg)

In der Convex-Hull-Variante werden non-planare Vertex-Figuren in Dreiecke aufgespalten — die Topologie wechselt mit jeder Iteration:

![Convex-Hull-Variante mit gemischten Polygonen](convex-hull.jpg)

- **Ab Iteration 13 (Kugel-Modus):** Eine halbtransparente Best-Fit-Kugel als Referenz. Der Körper schrumpft natürlich mit jeder Iteration (Kantenmittelpunkte liegen näher am Zentrum als die Endpunkte). Nur noch farbcodierte Vertex-Punkte sind sichtbar — die Flächen und Kanten würden bei >50.000 Vertices den Browser überlasten. Punkte werden mit `depthTest: false` gerendert, damit auch die innerhalb der Kugel liegenden (grünen) sichtbar bleiben.

![Kugel-Modus mit farbcodierten Vertex-Punkten](kugelmodus.jpg)

Die roten Punkte (außerhalb der Kugel) clustern an den 8 Würfelecken-Positionen, die grünen (innerhalb) an den 6 Flächenzentren — sichtbares Resultat der topologischen Nicht-Uniformität.

### Farbcodierung der Punkte

Jeder Vertex-Punkt ist nach seiner Abweichung von der Best-Fit-Kugel eingefärbt:

- **Rot** — außerhalb der Kugel (Beule, an den Würfelecken-Positionen)
- **Grün** — innerhalb der Kugel (Delle, an den Flächenzentren)
- **Grau** — auf der Kugeloberfläche (Abweichung < 0,001%, z.B. bei Iter 0–2 wo alle Vertices exakt equidistant sind)

Die Farbintensität skaliert linear mit der Abweichung: je weiter vom Kugelradius, desto kräftiger die Farbe. Zusätzlich verblassen Punkte und Kanten mit zunehmender Entfernung zur Kamera (Live-Update bei Rotation, auch während der Animation): vordere Elemente sind kräftig, hintere blass.

### Sampling

Bei mehr als 50.000 Vertices (Desktop) bzw. 25.000 (Mobilgeräte) wird ein gleichmäßiges Zufalls-Sample angezeigt (Fisher-Yates Shuffle). Die Stats-Zeile zeigt die Anzahl der dargestellten Samples. Die Punktgröße im Polyeder-Modus nimmt mit jeder Iteration ab: 0,010 bei Iter 0, dann pro Schritt 0,001 kleiner, ab Iter 9 konstant 0,001. Im Kugel-Modus (Iter 13+) konstant 0,003 — die Punkte verteilen sich auf einer größeren Kugelfläche und brauchen mehr Sichtbarkeit.

Bei Speicherfehlern (insbesondere auf Mobilgeräten) wird die Punktanzahl automatisch halbiert und das Rendering erneut versucht.

### Stats-Zeile

| Feld | Bedeutung |
|------|-----------|
| Iteration | Aktuelle Rektifikationsstufe (0 = Würfel) |
| Ecken | Anzahl Vertices (exakt aus Topologie, nicht Euler-Schätzung) |
| Kanten | Anzahl Kanten |
| Flächen | Anzahl Polygon-Flächen |
| n-Ecke | Aufschlüsselung der Flächen nach Eckenzahl (z.B. `3-Eck:104, 4-Eck:138`) |
| Radius | Durchschnittsabstand der Vertices vom Ursprung (schrumpft pro Iteration) |
| Dauer | Berechnungszeit der Iteration im Web Worker |
| Samples | Angezeigte Vertex-Punkte (= alle, oder Sample bei hohen Iterationen) |
| Abweichung | Min/Max-Abweichung von der Best-Fit-Kugel in Prozent |
| Vorberechnet | Höchster vorberechneter Index pro Variante (z.B. `topo 20/20, hull 8/12` — Topo ist meist schneller fertig) |

Werte zeigen "-" an, solange die Iteration noch berechnet wird.

### Vorberechnung

Iterationen werden im Hintergrund sequentiell vorberechnet (0 → 1 → 2 → ...). Topo und Hull laufen auf zwei separaten Web Workern echt parallel — Topo ist viel schneller (~50ms bei Iter 11 vs. ~17s für Hull). Beim Klick auf "Weiter" wird entweder das vorberechnete Ergebnis sofort angezeigt oder eine Sanduhr (⏳), bis die Berechnung abgeschlossen ist. Bei Variantenwechsel wird der aktuell sichtbare Körper sofort durch das Pendant der anderen Variante ersetzt (sofern bereits vorberechnet).

### Mobilgeräte

Auf Mobilgeräten (erkannt via User-Agent und Viewport-Breite < 768px) gelten reduzierte Limits:

| Parameter | Desktop | Mobil |
|-----------|---------|-------|
| Max. Iterationen (Topo) | 20 | 18 |
| Max. Iterationen (Hull) | 12 | 12 |
| Max. Samples | 50.000 | 25.000 |

## Bedienung

| Aktion | Desktop | Mobil |
|--------|---------|-------|
| Nächste Iteration | Weiter-Button oder → oder Leertaste | Weiter-Button |
| Vorherige Iteration | Zurück-Button oder ← | Zurück-Button |
| Variante umschalten (Topo ↔ Hull) | "Variante"-Button (nur im Polyeder-Modus) | "Variante"-Button |
| Körper drehen | Maus ziehen | 1 Finger ziehen |
| Verschieben (Pan) | Shift+Maus ziehen oder Rechtsklick ziehen | 2 Finger ziehen |
| Zoomen | Scrollrad | 2-Finger-Pinch |
| Rotation stoppen/starten | Doppelklick | Doppeltap |

Pinch und Pan funktionieren gleichzeitig: der Abstand der beiden Finger steuert den Zoom, die gemeinsame Bewegung den Pan.

Die Auto-Rotation pausiert 3 Sekunden nach manueller Interaktion und setzt dann wieder ein. Per Doppelklick/Doppeltap lässt sie sich dauerhaft stoppen bzw. wieder starten.

## Technische Umsetzung

### Architektur

```
                  ──── {iter, variant: 'topo'} ────►   Worker (topo)
                                                       (worker.js)
                  ◄── {coords, triIndices, ngonDist}── rectifyTopological()
  Main Thread
  (index.html)
                  ──── {iter, variant: 'hull'} ────►   Worker (hull)
                                                       (worker.js)
                  ◄── {coords, triIndices, ngonDist}── rectifyHull()
```

- **Main Thread** (`index.html`): Three.js-Szene, Kamera, Beleuchtung, Rendering, UI-Events. Verwaltet getrennte Histories für beide Varianten. Keine geometrische Berechnung — nur Darstellung.
- **Zwei Worker** (`worker.js`): Eine Instanz für jede Variante, läuft auf eigenem Thread → echt parallel. Jeder Worker pflegt eigenen Zustand (Vertices + Faces) über Iterationen. Beide Varianten werden im Hintergrund parallel vorberechnet.

### Topologische Rektifikation (`rectifyTopological`)

Führt die **Flächen-Topologie** explizit mit, ohne Approximation:

1. **Kanten sammeln:** Aus den Polygon-Flächen werden alle Kanten und deren Mittelpunkte berechnet.
2. **Geschrumpfte Flächen:** Jede alte Fläche wird durch die Mittelpunkte ihrer Kanten ersetzt.
3. **Vertex-Figuren:** Für jeden alten Vertex werden die Mittelpunkte seiner Kanten in der richtigen zyklischen Reihenfolge (via Flächen-Adjazenz) zu einem neuen Polygon verbunden.
4. **Triangulierung:** Mittelpunkt-Triangulierung für non-planare Quads (4 Dreiecke), Fan-Triangulierung für planare Quads (2 Dreiecke).
5. **Polygon-Kanten:** Kanten direkt aus den Polygon-Flächen, um Diagonalen-Artefakte zu vermeiden.

### Convex-Hull-Rektifikation (`rectifyHull`)

Inkrementeller 3D-Convex-Hull mit exakter Integer-Arithmetik und anschließendem koplanaren Polygon-Merge. Die volle Algorithmus-Beschreibung steht im Mathematik-Abschnitt unter [Variante 2: Convex-Hull-Rektifikation → Algorithmus](#algorithmus).

Die exakte Arithmetik nutzt aus, dass alle Vertex-Koordinaten dyadisch rational sind und im 2<sup>iter</sup>-Gitter als ganze Zahlen exakt darstellbar bleiben (bis iter 14 innerhalb des Safe-Integer-Bereichs). Sichtbarkeits- und Coplanaritätstests werden zu exakten Vorzeichen- bzw. Gleichheitsvergleichen — keine Toleranzschwellen.

`HULL_MAX_ITER = 12`: höhere Iterationen wechseln automatisch in den Topo-Kugel-Modus, da der O(n²)-Hull bei n > 30.000 sehr lange braucht.

### Parallele Vorberechnung im Main Thread

- Pro Variante eine eigene `history`-Liste und Pending-Set.
- Pro Variante max. eine offene Worker-Anfrage in flight (kein Queue-Aufstauen).
- Nach jedem fertigen Result wird die nächste Iteration in *jeder* Variante separat angefordert — Topo und Hull machen unabhängig voneinander Fortschritt.
- Bei Variantenwechsel kommt die nun aktive Variante zuerst in die jeweilige Worker-Queue (UX-Optimierung).

### Rendering (index.html)

- **BufferGeometry** statt ConvexGeometry — der Worker liefert triangulierte Indizes, der Main Thread muss keinen Hull mehr berechnen.
- **Zwei-Pass-Blending** für transparente Flächen (erst Rückseiten mit `renderOrder=0`, dann Vorderseiten mit `renderOrder=1`).
- **Morph-Animation** (Iter 0–12): Cross-Fade zwischen altem und neuem Körper (1s, ease-in-out). Altes Mesh wird in separate Group verschoben und parallel ausgeblendet.
- **Farbcodierte Vertex-Punkte** über individuelle `MeshBasicMaterial`-Instanzen mit `depthTest: false` (immer sichtbar, auch hinter der Kugel).
- **Quaternion-Trackball-Rotation** ohne Gimbal Lock, ohne OrbitControls (vermeidet Pointer-Capture-Konflikte). Rotation in alle Richtungen unbegrenzt möglich.
- **Pan** (Shift+Drag / Rechtsklick / 2-Finger-Drag): laterale Verschiebung in Kamera-Koordinaten.
- **Auto-Rotation** mit 3s Pause nach manueller Interaktion.

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `index.html` | Main Thread: Three.js-Rendering, Kamerasteuerung, UI, Variantenwechsel, Worker-Verwaltung |
| `worker.js` | Web Worker: beide Rektifikationsvarianten (`rectifyTopological` + `rectifyHull` mit eigenem 3D-Convex-Hull-Algorithmus), Deviation-Berechnung, Triangulierung. Wird in der App zweimal instanziiert (eine Instanz pro Variante). |
| `cube-rectification.html` | Standalone — eine einzige HTML-Datei mit dem Worker-Code als inline `<script type="text/worker">`. Beide Worker-Instanzen werden über Data-URLs aus diesem inline Code erzeugt; funktioniert ohne Server auch per `file://`. |
| `regenerate.py` | Erzeugt `cube-rectification.html` aus `index.html` + `worker.js`: ersetzt den `new Worker(...)`-Aufruf durch eine Data-URL/Blob-URL-Variante, bettet den Worker-Code inline ein, inlinet Favicons als Base64 und ergänzt OG-Tags. |
| `favicon.png` / `favicon-32.png` | Favicons (64×64 / 32×32, RGBA PNG mit transparentem Hintergrund) |
| `og-image.jpg` | Open-Graph-Vorschaubild für WhatsApp / Telegram / Social Media (1292×1520, JPEG) |
| `topologische-rektifikation.jpg` / `convex-hull.jpg` / `kugelmodus.jpg` | Screenshots für die README (Topo-Polyeder-Modus, Convex-Hull-Variante, Topo-Kugel-Modus) |

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

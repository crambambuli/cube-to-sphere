// ============================================================================
// worker.js — Topologische Rektifikation eines Würfels
// ============================================================================
//
// Dieses Modul implementiert die iterierte Rektifikation als Web Worker,
// d.h. die gesamte Berechnung läuft in einem eigenen Thread und blockiert
// nicht die UI.
//
// ANSATZ: Statt den Convex Hull zu berechnen und daraus Kanten zu extrahieren
// (was bei fast-sphärischen Körpern durch Koplanaritäts-Schwellwerte ungenau
// wird), führen wir die Flächen-Topologie explizit mit. Flächen sind Polygone
// (nicht Dreiecke), Kanten ergeben sich direkt aus den Flächen.
//
// REKTIFIKATION: Bei jedem Schritt werden zwei Typen neuer Flächen erzeugt:
//   1. Geschrumpfte Original-Flächen: Die Kantenmittelpunkte jeder alten
//      Fläche bilden eine neue (kleinere) Fläche gleicher Seitenanzahl.
//   2. Vertex-Figuren: Die Kantenmittelpunkte aller Kanten, die an einem
//      alten Vertex enden, bilden eine neue Fläche (Grad des Vertex = Seitenanzahl).
//
// EULER-FORMEL: V' = E, E' = 2E, F' = V + F (exakt, keine Approximation).
//
// KEINE NORMALISIERUNG: Der Körper behält seinen natürlichen Radius und
//   schrumpft mit jeder Iteration (Kantenmittelpunkte liegen näher am Zentrum).
//   Der Durchschnittsradius (rAvg) wird nur für die Best-Fit-Kugel und
//   Abweichungsberechnung verwendet, nicht zum Skalieren.
//
// TRIANGULIERUNG: Für das Rendering werden Polygone in Dreiecke zerlegt:
//   - Dreiecke: direkt (immer plan)
//   - Planare Quads: 2 Dreiecke (Fan-Triangulierung)
//   - Nicht-planare Quads: 4 Dreiecke (Schwerpunkt als 5. Vertex)
//   Ab Iter 13 (Kugel-Modus) wird die Triangulierung übersprungen.
// ============================================================================

// Alle YIELD_EVERY Schritte wird der Event-Loop freigegeben, damit
// Fortschrittsmeldungen (postMessage) tatsächlich zugestellt werden.
// Hoher Wert: bei höheren Iterationen ist die Berechnung pro Vertex sehr
// schnell, häufige Yields würden die Gesamtzeit dominieren (setTimeout(0)
// hat in Browsern eine Mindestverzögerung von 4–16 ms).
const YIELD_EVERY = 5000;
// queueMicrotask hat keine Mindestverzögerung — viel schneller als setTimeout(0).
function yield_() { return new Promise(r => queueMicrotask(r)); }

// ============================================================================
// Ausgangskörper: Einheitswürfel
// ============================================================================
// 8 Vertices an den Ecken des Würfels mit Kantenlänge 2, zentriert am Ursprung.
// Jede Fläche ist ein Quadrat (4 Vertices), Reihenfolge gegen den Uhrzeigersinn
// von außen betrachtet.
const CUBE_VERTS = [
  [-1,-1,-1], // 0: links  unten hinten
  [-1,-1, 1], // 1: links  unten vorne
  [-1, 1,-1], // 2: links  oben  hinten
  [-1, 1, 1], // 3: links  oben  vorne
  [ 1,-1,-1], // 4: rechts unten hinten
  [ 1,-1, 1], // 5: rechts unten vorne
  [ 1, 1,-1], // 6: rechts oben  hinten
  [ 1, 1, 1], // 7: rechts oben  vorne
];
const CUBE_FACES = [
  [0,1,3,2], // -x Fläche (links)
  [4,6,7,5], // +x Fläche (rechts)
  [0,4,5,1], // -y Fläche (unten)
  [2,3,7,6], // +y Fläche (oben)
  [0,2,6,4], // -z Fläche (hinten)
  [1,5,7,3], // +z Fläche (vorne)
];

// Erzeugt einen eindeutigen String-Schlüssel für eine Kante zwischen
// Vertex a und b, unabhängig von der Reihenfolge.
// Numerischer Edge-Key statt String (viel schneller, weniger Speicher)
// Bei max ~200K Vertices reicht Faktor 1.000.000
function edgeKey(a, b) { return a < b ? a * 1000000 + b : b * 1000000 + a; }
function edgeKeyToVerts(key) { const b = key % 1000000; return [Math.floor(key / 1000000), b]; }

// ============================================================================
// Kernalgorithmus: Topologische Rektifikation
// ============================================================================
// Eingabe:
//   vertices: Array von [x, y, z]-Koordinaten
//   faces:    Array von Polygon-Flächen (jede Fläche = Array von Vertex-Indizes)
//
// Ausgabe:
//   vertices: Neue Vertex-Koordinaten (Kantenmittelpunkte)
//   faces:    Neue Polygon-Flächen (geschrumpfte + Vertex-Figuren)
//   triIndices: Triangulierte Flächen für Three.js-Rendering
//   coords:   Flat Float64Array der Koordinaten (für Transferable)
//   deviations: Abstand jedes Vertex von der Best-Fit-Kugel
//   rAvg:     Durchschnittsradius (= Radius der Best-Fit-Kugel)
async function rectifyTopological(vertices, faces, onProgress, skipTriangulation) {

  // ----------------------------------------------------------
  // SCHRITT 1: Kanten sammeln und Mittelpunkte berechnen
  // ----------------------------------------------------------
  // Jede Kante des Polyeders wird genau einmal erfasst.
  // Der Mittelpunkt wird als neuer Vertex gespeichert.
  // edgeMidIdx: edge_key → Index des Mittelpunkts in newVertices
  const edgeMidIdx = new Map();
  const newVertices = [];

  for (const face of faces) {
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      const key = edgeKey(a, b);
      if (!edgeMidIdx.has(key)) {
        const mx = (vertices[a][0] + vertices[b][0]) / 2;
        const my = (vertices[a][1] + vertices[b][1]) / 2;
        const mz = (vertices[a][2] + vertices[b][2]) / 2;
        edgeMidIdx.set(key, newVertices.length);
        newVertices.push([mx, my, mz]);
      }
    }
  }

  // ----------------------------------------------------------
  // SCHRITT 2: Kante → Flächen Zuordnung
  // ----------------------------------------------------------
  // Jede Kante grenzt an genau 2 Flächen (geschlossenes Polyeder).
  // Diese Information brauchen wir in Schritt 4, um die Kanten
  // um einen Vertex in der richtigen Reihenfolge zu ordnen.
  const edgeFaces = new Map(); // edge_key → [faceIdx, faceIdx]
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      const key = edgeKey(a, b);
      if (!edgeFaces.has(key)) edgeFaces.set(key, []);
      edgeFaces.get(key).push(fi);
    }
  }

  const newFaces = [];

  // ----------------------------------------------------------
  // SCHRITT 3: Geschrumpfte Flächen
  // ----------------------------------------------------------
  // Jede alte n-Eck-Fläche wird zu einem neuen n-Eck,
  // dessen Ecken die Mittelpunkte der alten Kanten sind.
  // Beispiel: Quadrat → kleineres Quadrat, Dreieck → kleineres Dreieck.
  for (const face of faces) {
    const newFace = [];
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      newFace.push(edgeMidIdx.get(edgeKey(a, b)));
    }
    newFaces.push(newFace);
  }

  // ----------------------------------------------------------
  // SCHRITT 4: Vertex-Figuren
  // ----------------------------------------------------------
  // Für jeden alten Vertex mit Grad d (d angrenzende Kanten) entsteht
  // ein neues d-Eck aus den Mittelpunkten dieser Kanten.
  //
  // Die Kanten müssen in der richtigen zyklischen Reihenfolge um den
  // Vertex angeordnet werden. Dazu gehen wir von einer beliebigen
  // Startkante über gemeinsame Flächen zur jeweils nächsten Kante.
  //
  // Beispiel: Würfel-Ecke hat Grad 3 → Dreieck
  //           Kuboctaeder hat Vertices mit Grad 4 → Quadrat

  // Erst: für jeden Vertex die Liste seiner Kanten sammeln
  const vertexEdges = new Map(); // vertex → [edge_keys]
  for (const [key] of edgeMidIdx) {
    const [a, b] = edgeKeyToVerts(key);
    for (const v of [a, b]) {
      if (!vertexEdges.has(v)) vertexEdges.set(v, []);
      vertexEdges.get(v).push(key);
    }
  }

  let processed = 0;
  const totalVerts = vertexEdges.size;
  // Fortschritt nur einmal in der Mitte melden — der Worker blockiert während
  // der Berechnung sowieso, häufige postMessage-Calls bringen keinen Nutzen
  // und Yields via setTimeout(0) verlangsamen die Gesamtzeit deutlich.
  const progressAt = Math.max(1, Math.floor(totalVerts / 2));

  for (const [v, eKeys] of vertexEdges) {
    processed++;
    if (processed === progressAt && onProgress) onProgress('topo', processed, totalVerts);

    // Kanten zyklisch ordnen via Flächen-Adjazenz:
    // Start bei beliebiger Kante, dann über die gemeinsame Fläche
    // die nächste Kante finden, die ebenfalls an v endet.
    const ordered = [eKeys[0]];
    const used = new Set([eKeys[0]]);

    while (ordered.length < eKeys.length) {
      const lastKey = ordered[ordered.length - 1];
      const lastFaces = edgeFaces.get(lastKey);

      let found = false;
      for (const fi of lastFaces) {
        const face = faces[fi];
        // Suche in dieser Fläche die andere Kante, die an v endet
        for (let j = 0; j < face.length; j++) {
          const a = face[j], b = face[(j + 1) % face.length];
          if (a !== v && b !== v) continue; // Kante berührt v nicht
          const key = edgeKey(a, b);
          if (key !== lastKey && !used.has(key) && edgeMidIdx.has(key)) {
            ordered.push(key);
            used.add(key);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) break; // Sollte bei geschlossenem Polyeder nicht passieren
    }

    // Vertex-Figur: die Mittelpunkte der geordneten Kanten
    const vertexFace = ordered.map(key => edgeMidIdx.get(key));
    newFaces.push(vertexFace);
  }

  // ----------------------------------------------------------
  // SCHRITT 5: Triangulierung für Rendering (nur im Polyeder-Modus)
  // ----------------------------------------------------------
  if (skipTriangulation) {
    // Kugel-Modus: keine Triangulierung, keine Mittelpunkt-Vertices
    const numOrigVerts = newVertices.length;
    let rSum = 0;
    for (let i = 0; i < numOrigVerts; i++) {
      const v = newVertices[i];
      rSum += Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    }
    const rAvg = rSum / numOrigVerts;
    const deviations = new Float64Array(numOrigVerts);
    for (let i = 0; i < numOrigVerts; i++) {
      const v = newVertices[i];
      deviations[i] = rAvg - Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    }
    return {
      vertices: newVertices, faces: newFaces,
      triIndices: new Uint32Array(0), edgeIndices: new Uint32Array(0),
      coords: flatCoords(newVertices), deviations, rAvg,
    };
  }
  // Three.js braucht Dreiecke, keine Polygone.
  // - Dreiecke: direkt verwenden (immer plan)
  // - Planare Quads: Fan-Triangulierung (2 Dreiecke, eine Diagonale)
  // - Nicht-planare Quads: Mittelpunkt-Triangulierung (Schwerpunkt als
  //   5. Vertex → 4 Dreiecke, verteilt den Knick gleichmäßig)
  //
  // Die Winding-Order wird so gewählt, dass die Normale nach außen zeigt.
  const triIndices = [];
  for (const face of newFaces) {
    if (face.length < 3) continue;

    // Zentroid der Fläche (für Orientierung + Mittelpunkt-Triangulierung)
    let cx2 = 0, cy2 = 0, cz2 = 0;
    for (const vi of face) {
      cx2 += newVertices[vi][0];
      cy2 += newVertices[vi][1];
      cz2 += newVertices[vi][2];
    }

    // Flächennormale via Kreuzprodukt der ersten zwei Kanten
    const a = newVertices[face[0]], b = newVertices[face[1]], c = newVertices[face[2]];
    const nx = (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
    const ny = (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    const nz = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const outward = nx*cx2 + ny*cy2 + nz*cz2;

    if (face.length === 3) {
      // Dreieck: direkt verwenden (immer plan)
      if (outward >= 0) triIndices.push(face[0], face[1], face[2]);
      else triIndices.push(face[0], face[2], face[1]);
    } else if (face.length === 4) {
      // Quad: prüfen ob plan (4. Punkt in Ebene der ersten 3?)
      const d = newVertices[face[3]];
      const nl = Math.sqrt(nx*nx + ny*ny + nz*nz);
      const planarity = nl > 0 ? Math.abs(nx*(d[0]-a[0]) + ny*(d[1]-a[1]) + nz*(d[2]-a[2])) / nl : 0;

      if (planarity < 1e-10) {
        // Plan: einfache Fan-Triangulierung (2 Dreiecke, kein Mittelpunkt nötig)
        if (outward >= 0) {
          triIndices.push(face[0], face[1], face[2]);
          triIndices.push(face[0], face[2], face[3]);
        } else {
          triIndices.push(face[0], face[2], face[1]);
          triIndices.push(face[0], face[3], face[2]);
        }
      } else {
        // Nicht plan: Mittelpunkt-Triangulierung (4 Dreiecke)
        const midIdx = newVertices.length;
        newVertices.push([cx2 / 4, cy2 / 4, cz2 / 4]);
        for (let j = 0; j < 4; j++) {
          const v0 = face[j], v1 = face[(j + 1) % 4];
          if (outward >= 0) triIndices.push(v0, v1, midIdx);
          else triIndices.push(v1, v0, midIdx);
        }
      }
    } else {
      // 5+ Ecken: immer Mittelpunkt-Triangulierung
      const midIdx = newVertices.length;
      newVertices.push([cx2 / face.length, cy2 / face.length, cz2 / face.length]);
      for (let j = 0; j < face.length; j++) {
        const v0 = face[j], v1 = face[(j + 1) % face.length];
        if (outward >= 0) triIndices.push(v0, v1, midIdx);
        else triIndices.push(v1, v0, midIdx);
      }
    }
  }

  // ----------------------------------------------------------
  // SCHRITT 6: Durchschnittsradius + Abweichungen
  // ----------------------------------------------------------
  // NACH der Triangulierung, weil Mittelpunkt-Vertices hinzugekommen sind.
  // rAvg nur über die originalen Vertices (nicht die Mittelpunkte).
  const numOrigVerts = edgeMidIdx.size; // Anzahl echte Vertices (ohne Triangulierungs-Mittelpunkte)
  let rSum = 0;
  for (let i = 0; i < numOrigVerts; i++) {
    const v = newVertices[i];
    rSum += Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
  const rAvg = rSum / numOrigVerts;

  const deviations = new Float64Array(numOrigVerts);
  for (let i = 0; i < numOrigVerts; i++) {
    const v = newVertices[i];
    deviations[i] = rAvg - Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  // Polygon-Kanten als Liniensegmente (für Rendering ohne EdgesGeometry)
  // Jede Polygon-Kante = 2 Vertex-Indizes, als flaches Array
  const edgeIndices = [];
  for (const face of newFaces) {
    for (let j = 0; j < face.length; j++) {
      edgeIndices.push(face[j], face[(j + 1) % face.length]);
    }
  }

  return {
    vertices: newVertices,   // [[x,y,z], ...] — neue Vertex-Koordinaten
    faces: newFaces,         // [[v0,v1,...], ...] — Polygon-Flächen (für nächste Iteration)
    triIndices: new Uint32Array(triIndices), // Triangulierte Indizes (für Rendering)
    edgeIndices: new Uint32Array(edgeIndices), // Polygon-Kanten als Liniensegmente
    coords: flatCoords(newVertices),         // Flat Float64Array (für Transferable)
    deviations,              // Float64Array: Abweichung pro Vertex von der Kugel
    rAvg,                    // Durchschnittsradius (Best-Fit-Kugelradius, schrumpft pro Iteration)
  };
}

// ============================================================================
// 3D-Convex-Hull (inkrementeller Algorithmus)
// ============================================================================
// Eingabe: points = [[x,y,z], ...]
// Ausgabe: { faces: [[i,j,k], ...] } — Dreieck-Indizes (gegen den Uhrzeigersinn von außen)
//
// Algorithmus: Initiales Tetraeder aus 4 nicht-koplanaren Punkten,
// dann iterativ jeden weiteren Punkt einarbeiten:
//   - Finde alle Flächen, die von P aus sichtbar sind (Normale zeigt auf P)
//   - Entferne sie, finde die Grenzkanten der entstandenen "Lücke"
//   - Verbinde P mit jeder Grenzkante → neue Dreiecksflächen
//
// Komplexität: O(n²) im Worst Case, in der Praxis schneller.
// Für unsere Größenordnungen (≤ 25k Punkte) ausreichend.
//
// `exact` (optional): wenn true, Predikate ohne Toleranz und mit `>= 0`
// statt `> ε` für Sichtbarkeit (koplanare Punkte werden inkludiert).
// Sinnvoll bei ganzzahligen Koordinaten, wo Sichtbarkeitstests exakt sind.
function convexHull3D(points, exact = false) {
  const n = points.length;
  if (n < 4) return { faces: [] };

  // ---- Initiales Tetraeder ----
  // Wir brauchen 4 Punkte, die nicht koplanar sind.
  // Heuristik: extremale Punkte in x-, y-, z-Richtung + ein 4. nicht in der Ebene.
  let i0 = 0, i1 = 0;
  for (let i = 1; i < n; i++) if (points[i][0] < points[i0][0]) i0 = i;
  for (let i = 1; i < n; i++) if (points[i][0] > points[i1][0]) i1 = i;
  // i2: Punkt am weitesten weg von Linie i0-i1
  const dx = points[i1][0]-points[i0][0], dy = points[i1][1]-points[i0][1], dz = points[i1][2]-points[i0][2];
  const dl = Math.sqrt(dx*dx+dy*dy+dz*dz);
  let i2 = -1, maxD = -1;
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1) continue;
    const ex = points[i][0]-points[i0][0], ey = points[i][1]-points[i0][1], ez = points[i][2]-points[i0][2];
    const cx = dy*ez - dz*ey, cy = dz*ex - dx*ez, cz = dx*ey - dy*ex;
    const d = Math.sqrt(cx*cx+cy*cy+cz*cz) / dl;
    if (d > maxD) { maxD = d; i2 = i; }
  }
  // i3: Punkt am weitesten weg von Ebene i0-i1-i2
  const a = points[i0], b = points[i1], c = points[i2];
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
  const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
  const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
  const nl = Math.sqrt(nx*nx+ny*ny+nz*nz);
  let i3 = -1, maxD3 = 0; // signed
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2) continue;
    const d = ((points[i][0]-a[0])*nx + (points[i][1]-a[1])*ny + (points[i][2]-a[2])*nz) / nl;
    if (Math.abs(d) > Math.abs(maxD3)) { maxD3 = d; i3 = i; }
  }
  if (i3 === -1) return { faces: [] };

  // Hilfsfunktion: Face-Objekt mit gecachter Normale + Stütz-d aufbauen.
  // Eine Sichtbarkeitsprüfung wird damit zu einer einzigen Skalarprodukt-Auswertung.
  function makeFace(ai, bi, ci) {
    const a = points[ai], b = points[bi], c = points[ci];
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
    // d = n · a, damit isVisible(p) == n·p > d
    const d = nx*a[0] + ny*a[1] + nz*a[2];
    return { v: [ai, bi, ci], nx, ny, nz, d };
  }

  // Tetraeder mit konsistenter Außenorientierung aufbauen.
  let faces;
  if (maxD3 > 0) {
    faces = [
      makeFace(i0, i2, i1), // Boden: Normale weg von i3
      makeFace(i0, i1, i3),
      makeFace(i1, i2, i3),
      makeFace(i2, i0, i3),
    ];
  } else {
    faces = [
      makeFace(i0, i1, i2),
      makeFace(i0, i3, i1),
      makeFace(i1, i3, i2),
      makeFace(i2, i3, i0),
    ];
  }

  const initialSet = new Set([i0, i1, i2, i3]);

  // ---- Inkrementell jeden weiteren Punkt einarbeiten ----
  for (let pi = 0; pi < n; pi++) {
    if (initialSet.has(pi)) continue;
    const p = points[pi];
    const px = p[0], py = p[1], pz = p[2];
    // Sichtbare Flächen finden (gecachte Normale → 1 Skalarprodukt pro Fläche)
    // Im exakten Modus: koplanare Punkte (= 0) werden mit-inkludiert, damit
    // sie nicht aus dem Hull verschwinden.
    const visible = [];
    const kept = [];
    if (exact) {
      for (const f of faces) {
        const v = f.nx*px + f.ny*py + f.nz*pz - f.d;
        if (v >= 0) visible.push(f); else kept.push(f);
      }
    } else {
      for (const f of faces) {
        if (f.nx*px + f.ny*py + f.nz*pz > f.d + 1e-12) visible.push(f);
        else kept.push(f);
      }
    }
    if (visible.length === 0) continue; // Punkt liegt innerhalb des Hulls

    // Grenzkanten der sichtbaren Region (Kanten, die nur in EINER sichtbaren Fläche vorkommen)
    const edgeCount = new Map();
    for (const f of visible) {
      for (let j = 0; j < 3; j++) {
        const a = f.v[j], b = f.v[(j+1)%3];
        const key = a * 1000000 + b;
        const revKey = b * 1000000 + a;
        if (edgeCount.has(revKey)) edgeCount.delete(revKey);
        else edgeCount.set(key, [a, b]);
      }
    }

    // Neue Flächen: Grenzkante a→b + Punkt pi → Dreieck (a, b, pi)
    faces = kept;
    for (const [a, b] of edgeCount.values()) {
      faces.push(makeFace(a, b, pi));
    }
  }

  return { faces: faces.map(f => f.v) };
}

// ============================================================================
// Convex-Hull-Rektifikation (Variante)
// ============================================================================
// Eingabe: vertices, faces (wie topologisch), aber Operation:
//   1. Edge-Midpoints aller Polygon-Kanten sammeln
//   2. Convex Hull dieser Midpoints berechnen (gibt Dreiecke)
//   3. Adjazente koplanare Dreiecke zu Polygonen mergen
//
// Im Unterschied zur topologischen Variante wechselt die Topologie
// (Anzahl Dreiecke, Quads, Pentagons, Hexagons je nach Iteration).
//
// EXAKTE ARITHMETIK: Alle Vertex-Koordinaten sind dyadisch rational mit
// Nenner 2^iter. Speichern wir sie als ganze Zahlen im 2^iter-Gitter,
// werden alle Hull-Predikate (Sichtbarkeit, Koplanarität) durch
// ganzzahlige Determinanten exakt entscheidbar — keine Toleranzschwellen,
// keine Rundungsfehler. Bei iter ≤ 12 bleiben alle Zwischenwerte innerhalb
// des Safe-Integer-Bereichs (< 2^53).
async function rectifyHull(vertices, faces, onProgress, skipTriangulation, iter) {
  const scaleOld = 2 ** (iter - 1); // Skalierung der Eingabe-Vertices
  // (Neuer Maßstab ist 2*scaleOld; statt zu dividieren summieren wir die alten Ints,
  //  was automatisch dem neuen Maßstab entspricht.)

  // Eingabe-Vertices in Integer-Koordinaten am 2^(iter-1)-Gitter
  const intVertices = vertices.map(v => [
    Math.round(v[0] * scaleOld),
    Math.round(v[1] * scaleOld),
    Math.round(v[2] * scaleOld),
  ]);

  // ---- SCHRITT 1: Edge-Midpoints (parallel als Float und Integer) ----
  const edgeSet = new Set();
  const newVertices = [];   // Floats für Rendering, Deviationen
  const intMidpoints = [];   // Integers im 2^iter-Gitter — exakt für Hull-Predikate
  for (const face of faces) {
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      const key = edgeKey(a, b);
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        newVertices.push([
          (vertices[a][0] + vertices[b][0]) / 2,
          (vertices[a][1] + vertices[b][1]) / 2,
          (vertices[a][2] + vertices[b][2]) / 2,
        ]);
        // Integer-Midpoint: sum der Eingangs-Ints (im 2^(iter-1)-Gitter)
        // entspricht direkt dem korrekten Wert im 2^iter-Gitter.
        intMidpoints.push([
          intVertices[a][0] + intVertices[b][0],
          intVertices[a][1] + intVertices[b][1],
          intVertices[a][2] + intVertices[b][2],
        ]);
      }
    }
  }

  if (onProgress) onProgress('hull', 0, 1);
  await yield_();

  // ---- SCHRITT 2: Convex Hull mit exakten Predikaten auf Integer-Punkten ----
  const { faces: triFaces } = convexHull3D(intMidpoints, /*exact=*/true);

  if (onProgress) onProgress('hull', 1, 1);
  await yield_();

  // ---- SCHRITT 3: Koplanare Dreiecke zu Polygonen mergen ----
  // Exakter Test via 3×3-Determinante über Integer-Koordinaten:
  // Zwei Dreiecke (a,b,c) und (a,b,d) sind koplanar iff det(b-a, c-a, d-a) = 0.
  const N = triFaces.length;

  // Edge → [tri-Indizes] für Adjazenz
  const triEdges = new Map();
  for (let i = 0; i < N; i++) {
    const t = triFaces[i];
    for (let j = 0; j < 3; j++) {
      const a = t[j], b = t[(j+1)%3];
      const key = edgeKey(a, b);
      if (!triEdges.has(key)) triEdges.set(key, []);
      triEdges.get(key).push(i);
    }
  }

  // Union-Find: koplanare Nachbarn zusammenfassen
  const parent = new Int32Array(N);
  for (let i = 0; i < N; i++) parent[i] = i;
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

  // Exakter Koplanaritäts-Test: 4 Punkte aus 2 adjazenten Dreiecken liegen in
  // einer Ebene iff die 3×3-Determinante über die Integer-Differenzen 0 ergibt.
  function coplanarExact(i, j) {
    const ti = triFaces[i], tj = triFaces[j];
    const inI = new Set(ti);
    let dIdx = -1;
    for (const x of tj) if (!inI.has(x)) { dIdx = x; break; }
    if (dIdx === -1) return true; // identische Dreiecke — sollte nicht vorkommen
    const pa = intMidpoints[ti[0]], pb = intMidpoints[ti[1]], pc = intMidpoints[ti[2]], pd = intMidpoints[dIdx];
    const ux = pb[0]-pa[0], uy = pb[1]-pa[1], uz = pb[2]-pa[2];
    const vx = pc[0]-pa[0], vy = pc[1]-pa[1], vz = pc[2]-pa[2];
    const wx = pd[0]-pa[0], wy = pd[1]-pa[1], wz = pd[2]-pa[2];
    // det([u v w]) — alle Werte ganze Zahlen, Vergleich mit 0 ist exakt
    return ux*(vy*wz - vz*wy) - uy*(vx*wz - vz*wx) + uz*(vx*wy - vy*wx) === 0;
  }

  for (const tris of triEdges.values()) {
    if (tris.length === 2) {
      if (coplanarExact(tris[0], tris[1])) union(tris[0], tris[1]);
    }
  }

  // Gruppieren nach Cluster und Polygon-Umriss extrahieren
  const groups = new Map();
  for (let i = 0; i < N; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const newFaces = [];
  for (const tris of groups.values()) {
    // Sammle Kanten, zähle Vorkommen — Innenkanten 2x, Boundary 1x
    const edgeCount = new Map();
    const edgeDir = new Map(); // a→b (für Orientierung)
    for (const ti of tris) {
      const t = triFaces[ti];
      for (let j = 0; j < 3; j++) {
        const a = t[j], b = t[(j+1)%3];
        const key = edgeKey(a, b);
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        if (!edgeDir.has(key)) edgeDir.set(key, [a, b]);
      }
    }
    const boundary = [];
    for (const [key, c] of edgeCount) {
      if (c === 1) boundary.push(edgeDir.get(key));
    }
    if (boundary.length < 3) continue;

    // Boundary-Kanten zu zyklischer Liste verbinden
    const adj = new Map();
    for (const [a, b] of boundary) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
    const start = boundary[0][0];
    const poly = [start];
    let prev = -1, cur = start;
    while (poly.length < boundary.length) {
      const nbrs = adj.get(cur);
      const nxt = nbrs[0] !== prev ? nbrs[0] : nbrs[1];
      if (nxt === start) break;
      poly.push(nxt);
      prev = cur; cur = nxt;
    }
    newFaces.push(poly);
  }

  // ---- SCHRITT 4: Statistik (rAvg, deviations) und Triangulation ----
  // Reuse existing logic
  const numOrigVerts = newVertices.length;

  if (skipTriangulation) {
    let rSum = 0;
    for (let i = 0; i < numOrigVerts; i++) {
      const v = newVertices[i];
      rSum += Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    }
    const rAvg = rSum / numOrigVerts;
    const deviations = new Float64Array(numOrigVerts);
    for (let i = 0; i < numOrigVerts; i++) {
      const v = newVertices[i];
      deviations[i] = rAvg - Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    }
    return {
      vertices: newVertices, faces: newFaces,
      triIndices: new Uint32Array(0), edgeIndices: new Uint32Array(0),
      coords: flatCoords(newVertices), deviations, rAvg,
    };
  }

  // Triangulation: Dreiecke direkt, Quads als 2 Tris (Hull-Diagonale ist schon korrekt),
  // 5+ Ecken via Mittelpunkt-Triangulierung. Da der Hull konvex ist, reicht Fan-Tri für Quads.
  const triIndices = [];
  for (const face of newFaces) {
    if (face.length < 3) continue;
    let cx=0, cy=0, cz=0;
    for (const vi of face) {
      cx += newVertices[vi][0]; cy += newVertices[vi][1]; cz += newVertices[vi][2];
    }
    const a = newVertices[face[0]], b = newVertices[face[1]], c = newVertices[face[2]];
    const nx = (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
    const ny = (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    const nz = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const outward = nx*cx + ny*cy + nz*cz;
    if (face.length === 3) {
      if (outward >= 0) triIndices.push(face[0], face[1], face[2]);
      else triIndices.push(face[0], face[2], face[1]);
    } else {
      // Fan-Triangulierung (Hull-Polygone sind plan)
      for (let j = 1; j < face.length - 1; j++) {
        if (outward >= 0) triIndices.push(face[0], face[j], face[j+1]);
        else triIndices.push(face[0], face[j+1], face[j]);
      }
    }
  }

  // rAvg + deviations
  let rSum = 0;
  for (let i = 0; i < numOrigVerts; i++) {
    const v = newVertices[i];
    rSum += Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  }
  const rAvg = rSum / numOrigVerts;
  const deviations = new Float64Array(numOrigVerts);
  for (let i = 0; i < numOrigVerts; i++) {
    const v = newVertices[i];
    deviations[i] = rAvg - Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  }

  // Polygon-Kanten als Liniensegmente
  const edgeIndices = [];
  for (const face of newFaces) {
    for (let j = 0; j < face.length; j++) {
      edgeIndices.push(face[j], face[(j+1)%face.length]);
    }
  }

  return {
    vertices: newVertices, faces: newFaces,
    triIndices: new Uint32Array(triIndices),
    edgeIndices: new Uint32Array(edgeIndices),
    coords: flatCoords(newVertices),
    deviations, rAvg,
  };
}

// Konvertiert [[x,y,z], ...] in ein flaches Float64Array [x0,y0,z0,x1,y1,z1,...]
// für den Transfer via postMessage (Transferable).
function flatCoords(verts) {
  const arr = new Float64Array(verts.length * 3);
  for (let i = 0; i < verts.length; i++) {
    arr[i * 3] = verts[i][0];
    arr[i * 3 + 1] = verts[i][1];
    arr[i * 3 + 2] = verts[i][2];
  }
  return arr;
}

// ============================================================================
// Worker-Zustand
// ============================================================================
// Der Worker pflegt seinen eigenen Zustand (Vertices + Flächen) über
// Iterationen hinweg. Der Main Thread sendet nur { iter: N, variant }
// und bekommt das Ergebnis zurück. Kein Hin-und-Her von Vertex-Daten.
//
// Zwei Varianten parallel:
//   'topo': Topologische Rektifikation (Polygone, möglicherweise non-planar)
//   'hull': Convex-Hull-Rektifikation (immer plane Polygone)
const state = {
  topo: { vertices: CUBE_VERTS, faces: CUBE_FACES, lastIter: -1 },
  hull: { vertices: CUBE_VERTS, faces: CUBE_FACES, lastIter: -1 },
};

// ============================================================================
// Message Handler
// ============================================================================
// Empfängt { iter: N } vom Main Thread.
//   iter = 0: Gibt den Ausgangswürfel zurück (Reset).
//   iter > 0: Berechnet die nächste Rektifikation und gibt Ergebnis zurück.
//
// Antwortet mit:
//   type: 'progress' — Fortschrittsmeldung während der Berechnung
//   type: 'result'   — Fertiges Ergebnis mit Koordinaten, Indizes, Deviations, Statistiken
self.onmessage = async function(e) {
  try {
    const iter = e.data.iter;
    const variant = e.data.variant === 'hull' ? 'hull' : 'topo';
    const s = state[variant];
    const t0 = performance.now();

    if (iter === 0) {
      // Ausgangswürfel in Originalgröße (Vertices bei ±1, Abstand √3)
      s.vertices = CUBE_VERTS.map(v => [...v]);
      s.faces = CUBE_FACES;
      s.lastIter = 0;
      const coords = flatCoords(s.vertices);
      // Würfel-Triangulierung: 6 Quadrate × 2 Dreiecke = 12 Dreiecke
      const triIndices = new Uint32Array([
        0,2,6, 0,6,4,  // -z (hinten)
        1,5,7, 1,7,3,  // +z (vorne)
        0,4,5, 0,5,1,  // -y (unten)
        2,3,7, 2,7,6,  // +y (oben)
        0,1,3, 0,3,2,  // -x (links)
        4,6,7, 4,7,5   // +x (rechts)
      ]);
      // Alle Würfel-Ecken gleich weit vom Ursprung → deviation = 0
      const deviations = new Float64Array(8).fill(0);
      // Würfel-Kanten aus Polygon-Flächen
      const cubeEdgeIndices = [];
      for (const face of CUBE_FACES) {
        for (let j = 0; j < face.length; j++) {
          cubeEdgeIndices.push(face[j], face[(j + 1) % face.length]);
        }
      }
      const edgeIndices = new Uint32Array(cubeEdgeIndices);
      self.postMessage({
        type: 'result', iter, variant, coords, triIndices, edgeIndices, deviations,
        rAvg: Math.sqrt(3),
        duration: 0,
        vertCount: 8, edgeCount: 12, faceCount: 6
      }, [coords.buffer, triIndices.buffer, edgeIndices.buffer, deviations.buffer]);
      return;
    }

    // Rektifikation berechnen, mit Fortschrittsmeldungen
    // Ab Iter 13 (Kugel-Modus): keine Triangulierung nötig, spart Speicher + Zeit
    const skipTri = iter > 12;
    const rectFn = variant === 'hull' ? rectifyHull : rectifyTopological;
    const result = await rectFn(s.vertices, s.faces, (phase, done, total) => {
      self.postMessage({ type: 'progress', iter, variant, phase, done, total });
    }, skipTri, iter);

    // Zustand aktualisieren für die nächste Iteration
    // Nur originale Vertices behalten (Triangulierungs-Mittelpunkte abschneiden)
    const numOrig = result.deviations.length;
    s.vertices = result.vertices.slice(0, numOrig);
    s.faces = result.faces;
    s.lastIter = iter;

    const duration = performance.now() - t0;

    // Kantenanzahl exakt aus der Topologie berechnen
    // (jede Kante kommt in genau 2 Flächen vor)
    const edgeSet = new Set();
    for (const face of s.faces) {
      for (let j = 0; j < face.length; j++) {
        edgeSet.add(edgeKey(face[j], face[(j + 1) % face.length]));
      }
    }

    // n-Eck-Verteilung (für Hull-Modus interessant)
    const ngonDist = {};
    for (const face of s.faces) {
      const n = face.length;
      ngonDist[n] = (ngonDist[n] || 0) + 1;
    }

    // Ergebnis an Main Thread senden
    // Transferable Arrays (coords, triIndices, deviations) werden ohne
    // Kopie übergeben — der Worker kann sie danach nicht mehr lesen.
    self.postMessage({
      type: 'result', iter, variant,
      coords: result.coords,
      triIndices: result.triIndices,
      edgeIndices: result.edgeIndices,
      deviations: result.deviations,
      rAvg: result.rAvg,
      duration,
      vertCount: result.deviations.length,
      edgeCount: edgeSet.size,
      faceCount: s.faces.length,
      ngonDist,
    }, [result.coords.buffer, result.triIndices.buffer, result.edgeIndices.buffer, result.deviations.buffer]);

  } catch (err) {
    console.error('Worker error:', err.message, err.stack);
    // Leeres Ergebnis senden, damit der Main Thread nicht hängt
    self.postMessage({
      type: 'result', iter: e.data.iter, variant: e.data.variant || 'topo',
      coords: new Float64Array(0), triIndices: new Uint32Array(0),
      edgeIndices: new Uint32Array(0),
      deviations: new Float64Array(0), rAvg: 1, duration: 0,
      vertCount: 0, edgeCount: 0, faceCount: 0,
    });
  }
};

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
// NORMALISIERUNG: Durch den Durchschnittsradius (rAvg) statt maxR.
//   maxR-Normalisierung erzeugt einen nicht-sphärischen Fixpunkt,
//   weil die Beulen (an den Würfelecken) immer auf r=1 zurückgesetzt werden.
//   rAvg-Normalisierung erlaubt sowohl Beulen als auch Dellen zu schrumpfen.
// ============================================================================

// Alle YIELD_EVERY Schritte wird der Event-Loop freigegeben, damit
// Fortschrittsmeldungen (postMessage) tatsächlich zugestellt werden.
const YIELD_EVERY = 100;
function yield_() { return new Promise(r => setTimeout(r, 0)); }

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
function edgeKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }

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
async function rectifyTopological(vertices, faces, onProgress) {

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
    const [a, b] = key.split('_').map(Number);
    for (const v of [a, b]) {
      if (!vertexEdges.has(v)) vertexEdges.set(v, []);
      vertexEdges.get(v).push(key);
    }
  }

  let processed = 0;
  const totalVerts = vertexEdges.size;

  for (const [v, eKeys] of vertexEdges) {
    processed++;
    if (processed % YIELD_EVERY === 0) {
      if (onProgress) onProgress('topo', processed, totalVerts);
      await yield_();
    }

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
  // SCHRITT 5: Normalisierung durch Durchschnittsradius
  // ----------------------------------------------------------
  // Alle Vertices werden so skaliert, dass ihr durchschnittlicher
  // Abstand vom Ursprung = 1 ist.
  //
  // WARUM NICHT maxR? maxR-Normalisierung (teile durch den am weitesten
  // entfernten Punkt) erzeugt einen nicht-sphärischen Fixpunkt: die
  // Beulen an den Würfelecken werden immer auf r=1 zurückgesetzt und
  // können nie schrumpfen. rAvg-Normalisierung erlaubt symmetrisches
  // Schrumpfen von Beulen UND Dellen.
  let rSum = 0;
  for (const v of newVertices) {
    rSum += Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
  const rAvg = rSum / newVertices.length;
  if (rAvg > 1e-12) {
    for (const v of newVertices) {
      v[0] /= rAvg; v[1] /= rAvg; v[2] /= rAvg;
    }
  }

  // ----------------------------------------------------------
  // SCHRITT 6: Abweichungen von der Best-Fit-Kugel
  // ----------------------------------------------------------
  // Nach rAvg-Normalisierung hat die Best-Fit-Kugel Radius 1.
  // deviation > 0: Punkt liegt innerhalb der Kugel (Delle)
  // deviation < 0: Punkt liegt außerhalb der Kugel (Beule)
  const deviations = new Float64Array(newVertices.length);
  for (let i = 0; i < newVertices.length; i++) {
    const v = newVertices[i];
    deviations[i] = 1 - Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  // ----------------------------------------------------------
  // SCHRITT 7: Triangulierung für Rendering
  // ----------------------------------------------------------
  // Three.js braucht Dreiecke, keine Polygone. Wir verwenden
  // Fan-Triangulierung: ein Polygon mit n Ecken wird zu n-2 Dreiecken.
  //
  // Die Winding-Order (Reihenfolge der Vertices) bestimmt die
  // Richtung der Flächennormale. Wir orientieren alle Dreiecke so,
  // dass die Normale nach außen zeigt (weg vom Ursprung).
  const triIndices = [];
  for (const face of newFaces) {
    if (face.length < 3) continue;

    // Flächennormale via Kreuzprodukt der ersten zwei Kanten
    const a = newVertices[face[0]], b = newVertices[face[1]], c = newVertices[face[2]];
    const abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
    const acx = c[0]-a[0], acy = c[1]-a[1], acz = c[2]-a[2];
    const nx = aby*acz - abz*acy;
    const ny = abz*acx - abx*acz;
    const nz = abx*acy - aby*acx;

    // Zentroid der Fläche (≈ Richtung vom Ursprung zur Fläche)
    let cx2 = 0, cy2 = 0, cz2 = 0;
    for (const vi of face) {
      cx2 += newVertices[vi][0];
      cy2 += newVertices[vi][1];
      cz2 += newVertices[vi][2];
    }

    // Dot-Produkt: positiv = Normale zeigt nach außen (gewünscht)
    const outward = nx*cx2 + ny*cy2 + nz*cz2;

    if (outward >= 0) {
      // Normale zeigt nach außen → Reihenfolge beibehalten
      for (let j = 1; j < face.length - 1; j++) {
        triIndices.push(face[0], face[j], face[j + 1]);
      }
    } else {
      // Normale zeigt nach innen → Reihenfolge umkehren
      for (let j = 1; j < face.length - 1; j++) {
        triIndices.push(face[0], face[j + 1], face[j]);
      }
    }
  }

  return {
    vertices: newVertices,   // [[x,y,z], ...] — neue Vertex-Koordinaten
    faces: newFaces,         // [[v0,v1,...], ...] — Polygon-Flächen (für nächste Iteration)
    triIndices: new Uint32Array(triIndices), // Triangulierte Indizes (für Rendering)
    coords: flatCoords(newVertices),         // Flat Float64Array (für Transferable)
    deviations,              // Float64Array: Abweichung pro Vertex von der Kugel
    rAvg,                    // Durchschnittsradius nach Normalisierung (≈ 1)
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
// Iterationen hinweg. Der Main Thread sendet nur { iter: N } und bekommt
// das Ergebnis zurück. Kein Hin-und-Her von Vertex-Daten.
let currentVertices = CUBE_VERTS;
let currentFaces = CUBE_FACES;

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
    const t0 = performance.now();

    if (iter === 0) {
      // Ausgangswürfel zurückgeben (keine Berechnung nötig)
      currentVertices = CUBE_VERTS;
      currentFaces = CUBE_FACES;
      const coords = flatCoords(currentVertices);
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
      self.postMessage({
        type: 'result', iter, coords, triIndices, deviations,
        rAvg: Math.sqrt(3), // Abstand Würfelecke zum Ursprung = √3
        duration: 0,
        vertCount: 8, edgeCount: 12, faceCount: 6
      }, [coords.buffer, triIndices.buffer, deviations.buffer]);
      return;
    }

    // Rektifikation berechnen, mit Fortschrittsmeldungen
    const result = await rectifyTopological(currentVertices, currentFaces, (phase, done, total) => {
      self.postMessage({ type: 'progress', iter, phase, done, total });
    });

    // Zustand aktualisieren für die nächste Iteration
    currentVertices = result.vertices;
    currentFaces = result.faces;

    const duration = performance.now() - t0;

    // Kantenanzahl exakt aus der Topologie berechnen
    // (jede Kante kommt in genau 2 Flächen vor)
    const edgeSet = new Set();
    for (const face of currentFaces) {
      for (let j = 0; j < face.length; j++) {
        edgeSet.add(edgeKey(face[j], face[(j + 1) % face.length]));
      }
    }

    // Ergebnis an Main Thread senden
    // Transferable Arrays (coords, triIndices, deviations) werden ohne
    // Kopie übergeben — der Worker kann sie danach nicht mehr lesen.
    self.postMessage({
      type: 'result', iter,
      coords: result.coords,           // Float64Array: Vertex-Positionen
      triIndices: result.triIndices,    // Uint32Array: Dreieck-Indizes
      deviations: result.deviations,    // Float64Array: Abweichung von Kugel
      rAvg: result.rAvg,               // Durchschnittsradius
      duration,                         // Berechnungsdauer in ms
      vertCount: currentVertices.length, // V' = E (Euler)
      edgeCount: edgeSet.size,           // E' = 2E (Euler)
      faceCount: currentFaces.length,    // F' = V + F (Euler)
    }, [result.coords.buffer, result.triIndices.buffer, result.deviations.buffer]);

  } catch (err) {
    console.error('Worker error:', err.message, err.stack);
    // Leeres Ergebnis senden, damit der Main Thread nicht hängt
    self.postMessage({
      type: 'result', iter: e.data.iter,
      coords: new Float64Array(0), triIndices: new Uint32Array(0),
      deviations: new Float64Array(0), rAvg: 1, duration: 0,
      vertCount: 0, edgeCount: 0, faceCount: 0,
    });
  }
};

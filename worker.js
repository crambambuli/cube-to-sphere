// Topologische Rektifikation — exakte Kantenanzahl via Euler-Formel
// Keine Convex-Hull-basierte Kantenerkennung, keine Schwellwerte.
// Flächen werden als Polygone (nicht Dreiecke) durch Iterationen geführt.

const YIELD_EVERY = 100;
function yield_() { return new Promise(r => setTimeout(r, 0)); }

// ---- Cube Topology ----
// Vertices: 0(-1,-1,-1) 1(-1,-1,1) 2(-1,1,-1) 3(-1,1,1)
//           4(1,-1,-1)  5(1,-1,1)  6(1,1,-1)  7(1,1,1)
const CUBE_VERTS = [
  [-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],
  [1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]
];
const CUBE_FACES = [
  [0,1,3,2], // -x
  [4,6,7,5], // +x
  [0,4,5,1], // -y
  [2,3,7,6], // +y
  [0,2,6,4], // -z
  [1,5,7,3], // +z
];

function edgeKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }

// ---- Topologische Rektifikation ----
// Input: vertices [[x,y,z],...], faces [[v0,v1,...],...]  (Polygone)
// Output: neue vertices, neue faces, exakt V'=E, E'=2E, F'=V+F
async function rectifyTopological(vertices, faces, onProgress) {
  // 1. Kanten sammeln, Midpoints erzeugen
  const edgeMidIdx = new Map(); // edge_key -> midpoint index
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

  // 2. Edge-to-faces Mapping
  const edgeFaces = new Map(); // edge_key -> [faceIdx, faceIdx]
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

  // 3. Geschrumpfte Flächen: pro alte Fläche eine neue Fläche
  //    aus den Midpoints ihrer Kanten
  for (const face of faces) {
    const newFace = [];
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      newFace.push(edgeMidIdx.get(edgeKey(a, b)));
    }
    newFaces.push(newFace);
  }

  // 4. Vertex-Figuren: pro alter Ecke eine neue Fläche
  //    aus den Midpoints der Kanten, die an der Ecke enden (geordnet)
  const vertexEdges = new Map(); // vertex -> [edge_keys]
  for (const [key, edge] of edgeMidIdx) {
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

    // Kanten um Vertex v ordnen via Flächen-Adjazenz
    // Start: beliebige Kante, dann über gemeinsame Fläche zur nächsten
    const ordered = [eKeys[0]];
    const used = new Set([eKeys[0]]);

    while (ordered.length < eKeys.length) {
      const lastKey = ordered[ordered.length - 1];
      const [la, lb] = lastKey.split('_').map(Number);
      const lastFaces = edgeFaces.get(lastKey);

      let found = false;
      for (const fi of lastFaces) {
        const face = faces[fi];
        // Finde die andere Kante dieser Fläche, die ebenfalls an v endet
        for (let j = 0; j < face.length; j++) {
          const a = face[j], b = face[(j + 1) % face.length];
          if (a !== v && b !== v) continue;
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
      if (!found) break;
    }

    // Vertex-Figur aus den geordneten Kanten-Midpoints
    const vertexFace = ordered.map(key => edgeMidIdx.get(key));
    newFaces.push(vertexFace);
  }

  // 5. Normalisierung durch Durchschnittsradius (rAvg)
  //    maxR-Normalisierung erzeugt einen nicht-sphärischen Fixpunkt,
  //    weil die Beulen immer auf r=1 zurückgesetzt werden.
  //    rAvg-Normalisierung erlaubt Beulen UND Dellen zu schrumpfen.
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

  // 6. Deviations (Abstand von der Einheitskugel nach rAvg-Normalisierung)
  const deviations = new Float64Array(newVertices.length);
  for (let i = 0; i < newVertices.length; i++) {
    const v = newVertices[i];
    deviations[i] = 1 - Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  // 7. Flächen triangulieren (Fan) für Rendering
  const triIndices = [];
  for (const face of newFaces) {
    for (let j = 1; j < face.length - 1; j++) {
      triIndices.push(face[0], face[j], face[j + 1]);
    }
  }

  return {
    vertices: newVertices,
    faces: newFaces,
    triIndices: new Uint32Array(triIndices),
    coords: flatCoords(newVertices),
    deviations,
    rAvg,
  };
}

function flatCoords(verts) {
  const arr = new Float64Array(verts.length * 3);
  for (let i = 0; i < verts.length; i++) {
    arr[i * 3] = verts[i][0];
    arr[i * 3 + 1] = verts[i][1];
    arr[i * 3 + 2] = verts[i][2];
  }
  return arr;
}

// ---- Worker State ----
let currentVertices = CUBE_VERTS;
let currentFaces = CUBE_FACES;

self.onmessage = async function(e) {
  try {
    const iter = e.data.iter;
    const t0 = performance.now();

    if (iter === 0) {
      // Reset
      currentVertices = CUBE_VERTS;
      currentFaces = CUBE_FACES;
      const coords = flatCoords(currentVertices);
      const triIndices = new Uint32Array([
        0,2,6, 0,6,4, 1,5,7, 1,7,3,
        0,4,5, 0,5,1, 2,3,7, 2,7,6,
        0,1,3, 0,3,2, 4,6,7, 4,7,5
      ]);
      const deviations = new Float64Array(8).fill(0);
      self.postMessage({
        type: 'result', iter, coords, triIndices, deviations,
        rAvg: Math.sqrt(3), duration: 0,
        vertCount: 8, edgeCount: 12, faceCount: 6
      }, [coords.buffer, triIndices.buffer, deviations.buffer]);
      return;
    }

    const result = await rectifyTopological(currentVertices, currentFaces, (phase, done, total) => {
      self.postMessage({ type: 'progress', iter, phase, done, total });
    });

    currentVertices = result.vertices;
    currentFaces = result.faces;

    const duration = performance.now() - t0;

    // Kanten zählen (exakt aus Topologie)
    const edgeSet = new Set();
    for (const face of currentFaces) {
      for (let j = 0; j < face.length; j++) {
        edgeSet.add(edgeKey(face[j], face[(j + 1) % face.length]));
      }
    }

    self.postMessage({
      type: 'result', iter,
      coords: result.coords,
      triIndices: result.triIndices,
      deviations: result.deviations,
      rAvg: result.rAvg,
      duration,
      vertCount: currentVertices.length,
      edgeCount: edgeSet.size,
      faceCount: currentFaces.length,
    }, [result.coords.buffer, result.triIndices.buffer, result.deviations.buffer]);

  } catch (err) {
    console.error('Worker error:', err.message, err.stack);
    self.postMessage({
      type: 'result', iter: e.data.iter,
      coords: new Float64Array(0), triIndices: new Uint32Array(0),
      deviations: new Float64Array(0), rAvg: 1, duration: 0,
      vertCount: 0, edgeCount: 0, faceCount: 0,
    });
  }
};

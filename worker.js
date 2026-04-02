// Optimized 3D Convex Hull with conflict lists + rectify
// Pure JS — no Three.js dependency

const EPS = 1e-10;
const COPLANAR = 1 - 1e-8;

function cross(a, b) {
  return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
}
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function norm(a) { const l = Math.sqrt(dot(a,a)); return l > 0 ? [a[0]/l, a[1]/l, a[2]/l] : [0,0,0]; }

function computeNormal(pts, v) {
  return norm(cross(sub(pts[v[1]], pts[v[0]]), sub(pts[v[2]], pts[v[0]])));
}

function convexHull(pts) {
  const n = pts.length;
  if (n < 4) return [];

  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }

  let i0 = order[0], i1 = -1, i2 = -1, i3 = -1, maxD = 0;
  for (let i = 1; i < n; i++) {
    const d = dot(sub(pts[order[i]], pts[i0]), sub(pts[order[i]], pts[i0]));
    if (d > maxD) { maxD = d; i1 = order[i]; }
  }

  const lineDir = norm(sub(pts[i1], pts[i0]));
  maxD = 0;
  for (let i = 0; i < n; i++) {
    const idx = order[i];
    if (idx === i0 || idx === i1) continue;
    const v = sub(pts[idx], pts[i0]);
    const perpSq = dot(v,v) - dot(v, lineDir) ** 2;
    if (perpSq > maxD) { maxD = perpSq; i2 = idx; }
  }

  const planeN = norm(cross(sub(pts[i1], pts[i0]), sub(pts[i2], pts[i0])));
  maxD = 0;
  for (let i = 0; i < n; i++) {
    const idx = order[i];
    if (idx === i0 || idx === i1 || idx === i2) continue;
    const d = Math.abs(dot(planeN, sub(pts[idx], pts[i0])));
    if (d > maxD) { maxD = d; i3 = idx; }
  }
  if (i3 < 0) return [];

  let initVerts;
  if (dot(planeN, sub(pts[i3], pts[i0])) > 0) {
    initVerts = [[i0,i2,i1],[i0,i1,i3],[i1,i2,i3],[i0,i3,i2]];
  } else {
    initVerts = [[i0,i1,i2],[i0,i3,i1],[i1,i3,i2],[i0,i2,i3]];
  }

  const usedInTet = new Set([i0, i1, i2, i3]);
  const faces = [];
  const EK = (a, b) => a < b ? a * 1048576 + b : b * 1048576 + a;
  const edgeToFace = new Map();

  function addFace(v) {
    const idx = faces.length;
    const f = {
      v, n: computeNormal(pts, v),
      adj: [-1, -1, -1], alive: true,
      conflict: []
    };
    faces.push(f);
    for (let e = 0; e < 3; e++) {
      const a = v[(e+1)%3], b = v[(e+2)%3];
      const key = EK(a, b);
      const ex = edgeToFace.get(key);
      if (ex !== undefined) {
        f.adj[e] = ex[0];
        faces[ex[0]].adj[ex[1]] = idx;
        edgeToFace.delete(key);
      } else {
        edgeToFace.set(key, [idx, e]);
      }
    }
    return idx;
  }

  for (const v of initVerts) addFace(v);

  // Assign points to conflict faces
  for (let oi = 0; oi < n; oi++) {
    const pi = order[oi];
    if (usedInTet.has(pi)) continue;
    let bestDist = -Infinity, bestFace = -1;
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      const d = dot(f.n, sub(pts[pi], pts[f.v[0]]));
      if (d > bestDist) { bestDist = d; bestFace = fi; }
    }
    if (bestDist > EPS) {
      faces[bestFace].conflict.push(pi);
    }
  }

  // Main loop
  for (let mainIter = 0; mainIter < n * 4; mainIter++) {
    let seedFace = -1;
    for (let fi = 0; fi < faces.length; fi++) {
      if (faces[fi].alive && faces[fi].conflict.length > 0) { seedFace = fi; break; }
    }
    if (seedFace < 0) break;

    // Pick farthest point
    let bestPt = -1, bestD = -Infinity;
    const sf = faces[seedFace];
    for (const pi of sf.conflict) {
      const d = dot(sf.n, sub(pts[pi], pts[sf.v[0]]));
      if (d > bestD) { bestD = d; bestPt = pi; }
    }

    const p = pts[bestPt];

    // BFS visible faces
    const visible = [seedFace];
    const visSet = new Set([seedFace]);
    const horizon = [];

    for (let qi = 0; qi < visible.length; qi++) {
      const fi = visible[qi];
      const f = faces[fi];
      for (let e = 0; e < 3; e++) {
        const adj = f.adj[e];
        if (adj < 0 || visSet.has(adj)) continue;
        const af = faces[adj];
        if (!af.alive) continue;
        if (dot(af.n, sub(p, pts[af.v[0]])) > EPS) {
          visSet.add(adj);
          visible.push(adj);
        } else {
          horizon.push([f.v[(e+1)%3], f.v[(e+2)%3]]);
        }
      }
    }

    // Collect orphans
    const orphans = [];
    for (const fi of visible) {
      for (const pi of faces[fi].conflict) {
        if (pi !== bestPt) orphans.push(pi);
      }
    }

    // Remove visible faces
    for (const fi of visible) {
      const f = faces[fi];
      f.alive = false;
      f.conflict = [];
      for (let e = 0; e < 3; e++) {
        edgeToFace.delete(EK(f.v[(e+1)%3], f.v[(e+2)%3]));
      }
    }

    // Fix adjacency
    for (const fi of visible) {
      const f = faces[fi];
      for (let e = 0; e < 3; e++) {
        const adj = f.adj[e];
        if (adj >= 0 && faces[adj].alive) {
          const af = faces[adj];
          for (let ae = 0; ae < 3; ae++) {
            if (af.adj[ae] === fi) {
              const a = af.v[(ae+1)%3], b = af.v[(ae+2)%3];
              edgeToFace.delete(EK(a, b));
              af.adj[ae] = -1;
              edgeToFace.set(EK(a, b), [adj, ae]);
            }
          }
        }
      }
    }

    // New faces
    const newFaces = [];
    for (const [a, b] of horizon) {
      newFaces.push(addFace([a, b, bestPt]));
    }

    // Reassign orphans
    for (const opi of orphans) {
      for (const nfi of newFaces) {
        const f = faces[nfi];
        if (dot(f.n, sub(pts[opi], pts[f.v[0]])) > EPS) {
          f.conflict.push(opi);
          break;
        }
      }
    }
  }

  return faces.filter(f => f.alive).map(f => f.v);
}

// ---- Rectify ----
function rectify(coords) {
  const V = coords.length / 3;
  const pts = [];
  for (let i = 0; i < V; i++) {
    pts.push([coords[i*3], coords[i*3+1], coords[i*3+2]]);
  }

  const hullFaces = convexHull(pts);

  const edgeNormals = new Map();
  for (const f of hullFaces) {
    const n = computeNormal(pts, f);
    for (let e = 0; e < 3; e++) {
      const a = f[e], b = f[(e+1)%3];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!edgeNormals.has(key)) edgeNormals.set(key, []);
      edgeNormals.get(key).push(n);
    }
  }

  const midpoints = [];
  const seen = new Set();
  for (const [key, normals] of edgeNormals) {
    const nc = normals.length;
    let isReal = nc === 1;
    if (!isReal && nc === 2) {
      isReal = Math.abs(dot(normals[0], normals[1])) < COPLANAR;
    }
    if (!isReal && nc > 2) {
      const n0 = normals[0];
      isReal = !normals.every(n => Math.abs(dot(n0, n)) > COPLANAR);
    }
    if (isReal) {
      const [a, b] = key.split('_').map(Number);
      const mx = (pts[a][0]+pts[b][0])*0.5, my = (pts[a][1]+pts[b][1])*0.5, mz = (pts[a][2]+pts[b][2])*0.5;
      const mkey = mx.toFixed(10) + '_' + my.toFixed(10) + '_' + mz.toFixed(10);
      if (!seen.has(mkey)) { seen.add(mkey); midpoints.push(mx, my, mz); }
    }
  }

  let maxR = 0;
  for (let i = 0; i < midpoints.length; i += 3) {
    const r = Math.sqrt(midpoints[i]**2 + midpoints[i+1]**2 + midpoints[i+2]**2);
    if (r > maxR) maxR = r;
  }
  if (maxR > 1e-6) for (let i = 0; i < midpoints.length; i++) midpoints[i] /= maxR;

  return new Float64Array(midpoints);
}

self.onmessage = function(e) {
  const result = rectify(e.data.coords);
  self.postMessage({ iter: e.data.iter, coords: result }, [result.buffer]);
};

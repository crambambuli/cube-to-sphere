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
    const [a, b] = edgeKeyToVerts(key);
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
  // SCHRITT 5: Durchschnittsradius berechnen (keine Normalisierung)
  // ----------------------------------------------------------
  // Der Körper schrumpft natürlich mit jeder Iteration, weil
  // Kantenmittelpunkte näher am Zentrum liegen als die Endpunkte.
  // rAvg wird für die Best-Fit-Kugel und Abweichungsberechnung benötigt.
  let rSum = 0;
  for (const v of newVertices) {
    rSum += Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
  const rAvg = rSum / newVertices.length;

  // ----------------------------------------------------------
  // SCHRITT 6: Abweichungen von der Best-Fit-Kugel
  // ----------------------------------------------------------
  // Best-Fit-Kugel hat Radius rAvg.
  // deviation > 0: Punkt liegt innerhalb der Kugel (Delle)
  // deviation < 0: Punkt liegt außerhalb der Kugel (Beule)
  const deviations = new Float64Array(newVertices.length);
  for (let i = 0; i < newVertices.length; i++) {
    const v = newVertices[i];
    deviations[i] = rAvg - Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
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
// Convex-Hull-Algorithmus (Incremental mit Adjazenz + Conflict Lists)
// ============================================================================
function convexHull(pts) {
  const n = pts.length;
  if (n < 4) return [];
  let i0=0,i1=-1,i2=-1,i3=-1,maxD=0;
  for(let i=1;i<n;i++){const dx=pts[i][0]-pts[0][0],dy=pts[i][1]-pts[0][1],dz=pts[i][2]-pts[0][2];const d=dx*dx+dy*dy+dz*dz;if(d>maxD){maxD=d;i1=i;}}
  const ld=[pts[i1][0]-pts[i0][0],pts[i1][1]-pts[i0][1],pts[i1][2]-pts[i0][2]];
  const ll=Math.sqrt(ld[0]*ld[0]+ld[1]*ld[1]+ld[2]*ld[2]);ld[0]/=ll;ld[1]/=ll;ld[2]/=ll;
  maxD=0;for(let i=0;i<n;i++){if(i===i0||i===i1)continue;const v=[pts[i][0]-pts[i0][0],pts[i][1]-pts[i0][1],pts[i][2]-pts[i0][2]];const p=v[0]*ld[0]+v[1]*ld[1]+v[2]*ld[2];const d=v[0]*v[0]+v[1]*v[1]+v[2]*v[2]-p*p;if(d>maxD){maxD=d;i2=i;}}
  const ab=[pts[i1][0]-pts[i0][0],pts[i1][1]-pts[i0][1],pts[i1][2]-pts[i0][2]];
  const ac=[pts[i2][0]-pts[i0][0],pts[i2][1]-pts[i0][1],pts[i2][2]-pts[i0][2]];
  const pn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const pnl=Math.sqrt(pn[0]*pn[0]+pn[1]*pn[1]+pn[2]*pn[2]);pn[0]/=pnl;pn[1]/=pnl;pn[2]/=pnl;
  maxD=0;for(let i=0;i<n;i++){if(i===i0||i===i1||i===i2)continue;const d=Math.abs(pn[0]*(pts[i][0]-pts[i0][0])+pn[1]*(pts[i][1]-pts[i0][1])+pn[2]*(pts[i][2]-pts[i0][2]));if(d>maxD){maxD=d;i3=i;}}
  if(i3<0)return[];
  const orient=pn[0]*(pts[i3][0]-pts[i0][0])+pn[1]*(pts[i3][1]-pts[i0][1])+pn[2]*(pts[i3][2]-pts[i0][2]);
  const initF=orient>0?[[i0,i2,i1],[i0,i1,i3],[i1,i2,i3],[i0,i3,i2]]:[[i0,i1,i2],[i0,i3,i1],[i1,i3,i2],[i0,i2,i3]];
  const faces=[];const EK=(a,b)=>a<b?a*1048576+b:b*1048576+a;const edgeToFace=new Map();
  function fNorm(f){const a=pts[f[0]],b=pts[f[1]],c=pts[f[2]];const x=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];const l=Math.sqrt(x[0]*x[0]+x[1]*x[1]+x[2]*x[2]);return l>0?[x[0]/l,x[1]/l,x[2]/l]:[0,0,0];}
  function fDist(f,p){const n=fNorm(f),a=pts[f[0]];return n[0]*(p[0]-a[0])+n[1]*(p[1]-a[1])+n[2]*(p[2]-a[2]);}
  function addFace(v){const idx=faces.length;const f={v,adj:[-1,-1,-1],alive:true,conflict:[]};faces.push(f);for(let e=0;e<3;e++){const a=v[(e+1)%3],b=v[(e+2)%3],key=EK(a,b);const ex=edgeToFace.get(key);if(ex!==undefined){f.adj[e]=ex[0];faces[ex[0]].adj[ex[1]]=idx;edgeToFace.delete(key);}else edgeToFace.set(key,[idx,e]);}return idx;}
  for(const v of initF)addFace(v);
  const usedInTet=new Set([i0,i1,i2,i3]),conflictFaces=new Set();
  for(let i=0;i<n;i++){if(usedInTet.has(i))continue;let bd=-Infinity,bf=-1;for(let fi=0;fi<faces.length;fi++){const d=fDist(faces[fi].v,pts[i]);if(d>bd){bd=d;bf=fi;}}if(bd>1e-10){faces[bf].conflict.push(i);conflictFaces.add(bf);}}
  while(conflictFaces.size>0){
    const sf=conflictFaces.values().next().value;let bp=-1,bd=-Infinity;for(const pi of faces[sf].conflict){const d=fDist(faces[sf].v,pts[pi]);if(d>bd){bd=d;bp=pi;}}
    const p=pts[bp],visible=[sf],visSet=new Set([sf]),horizon=[];
    for(let qi=0;qi<visible.length;qi++){const fi=visible[qi],f=faces[fi];for(let e=0;e<3;e++){const adj=f.adj[e];if(adj<0||visSet.has(adj)||!faces[adj].alive)continue;if(fDist(faces[adj].v,p)>1e-10){visSet.add(adj);visible.push(adj);}else horizon.push([f.v[(e+1)%3],f.v[(e+2)%3]]);}}
    const orphans=[];for(const fi of visible){for(const pi of faces[fi].conflict)if(pi!==bp)orphans.push(pi);conflictFaces.delete(fi);faces[fi].alive=false;faces[fi].conflict=[];for(let e=0;e<3;e++)edgeToFace.delete(EK(faces[fi].v[(e+1)%3],faces[fi].v[(e+2)%3]));}
    for(const fi of visible){const f=faces[fi];for(let e=0;e<3;e++){const adj=f.adj[e];if(adj>=0&&faces[adj].alive){for(let ae=0;ae<3;ae++)if(faces[adj].adj[ae]===fi){edgeToFace.delete(EK(faces[adj].v[(ae+1)%3],faces[adj].v[(ae+2)%3]));faces[adj].adj[ae]=-1;edgeToFace.set(EK(faces[adj].v[(ae+1)%3],faces[adj].v[(ae+2)%3]),[adj,ae]);}}}}
    const nf=[];for(const[a,b]of horizon)nf.push(addFace([a,b,bp]));
    for(const opi of orphans){for(const nfi of nf){if(fDist(faces[nfi].v,pts[opi])>1e-10){faces[nfi].conflict.push(opi);conflictFaces.add(nfi);break;}}}
  }
  return faces.filter(f=>f.alive).map(f=>f.v);
}

// ============================================================================
// Convex-Hull-basierte Rektifikation
// ============================================================================
async function rectifyHull(vertices, faces, onProgress) {
  // Midpoints identisch zur topologischen Version
  const edgeMidIdx = new Map();
  const newVertices = [];
  for (const face of faces) {
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      const key = edgeKey(a, b);
      if (!edgeMidIdx.has(key)) {
        newVertices.push([(vertices[a][0]+vertices[b][0])/2,(vertices[a][1]+vertices[b][1])/2,(vertices[a][2]+vertices[b][2])/2]);
        edgeMidIdx.set(key, newVertices.length - 1);
      }
    }
  }
  if (onProgress) onProgress('hull', 0, 1);
  const hullFaces = convexHull(newVertices);
  // Deviations + rAvg
  let rSum = 0;
  for (const v of newVertices) rSum += Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  const rAvg = rSum / newVertices.length;
  const deviations = new Float64Array(newVertices.length);
  for (let i = 0; i < newVertices.length; i++) {
    const v = newVertices[i];
    deviations[i] = rAvg - Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  }
  // triIndices (Normalen nach außen)
  const triIndices = [];
  for (const face of hullFaces) {
    const a=newVertices[face[0]],b=newVertices[face[1]],c=newVertices[face[2]];
    const nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
    const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    const nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    let cx2=a[0]+b[0]+c[0],cy2=a[1]+b[1]+c[1],cz2=a[2]+b[2]+c[2];
    if(nx*cx2+ny*cy2+nz*cz2>=0) triIndices.push(face[0],face[1],face[2]);
    else triIndices.push(face[0],face[2],face[1]);
  }
  // edgeIndices
  const edgeSetH = new Set();
  const edgeIndicesArr = [];
  for (const face of hullFaces) {
    for (let e = 0; e < 3; e++) {
      const a=face[e],b=face[(e+1)%3],key=edgeKey(a,b);
      if(!edgeSetH.has(key)){edgeSetH.add(key);edgeIndicesArr.push(a,b);}
    }
  }
  return {
    vertices: newVertices, faces: hullFaces,
    triIndices: new Uint32Array(triIndices), edgeIndices: new Uint32Array(edgeIndicesArr),
    coords: flatCoords(newVertices), deviations, rAvg,
  };
}

// ============================================================================
// Worker-Zustand
// ============================================================================
// Der Worker pflegt seinen eigenen Zustand (Vertices + Flächen) über
// Iterationen hinweg. Der Main Thread sendet nur { iter: N } und bekommt
// das Ergebnis zurück. Kein Hin-und-Her von Vertex-Daten.
let currentVertices = CUBE_VERTS;
let currentFaces = CUBE_FACES;
let currentMode = 'topo';

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
    const mode = e.data.mode || 'topo'; // 'topo' oder 'hull'

    // Bei Modus-Wechsel: Zustand zurücksetzen
    if (mode !== currentMode) {
      currentMode = mode;
      currentVertices = CUBE_VERTS.map(v => [...v]);
      currentFaces = CUBE_FACES;
    }

    const t0 = performance.now();

    if (iter === 0) {
      // Ausgangswürfel in Originalgröße (Vertices bei ±1, Abstand √3)
      currentVertices = CUBE_VERTS.map(v => [...v]);
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
      // Würfel-Kanten aus Polygon-Flächen
      const cubeEdgeIndices = [];
      for (const face of CUBE_FACES) {
        for (let j = 0; j < face.length; j++) {
          cubeEdgeIndices.push(face[j], face[(j + 1) % face.length]);
        }
      }
      const edgeIndices = new Uint32Array(cubeEdgeIndices);
      self.postMessage({
        type: 'result', iter, mode, coords, triIndices, edgeIndices, deviations,
        rAvg: Math.sqrt(3),
        duration: 0,
        vertCount: 8, edgeCount: 12, faceCount: 6
      }, [coords.buffer, triIndices.buffer, edgeIndices.buffer, deviations.buffer]);
      return;
    }

    // Rektifikation berechnen, mit Fortschrittsmeldungen
    const rectFn = mode === 'hull' ? rectifyHull : rectifyTopological;
    const result = await rectFn(currentVertices, currentFaces, (phase, done, total) => {
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
      type: 'result', iter, mode,
      coords: result.coords,           // Float64Array: Vertex-Positionen
      triIndices: result.triIndices,    // Uint32Array: Dreieck-Indizes
      edgeIndices: result.edgeIndices,  // Uint32Array: Polygon-Kanten als Liniensegmente
      deviations: result.deviations,    // Float64Array: Abweichung von Kugel
      rAvg: result.rAvg,               // Durchschnittsradius
      duration,                         // Berechnungsdauer in ms
      vertCount: currentVertices.length, // V' = E (Euler)
      edgeCount: edgeSet.size,           // E' = 2E (Euler)
      faceCount: currentFaces.length,    // F' = V + F (Euler)
    }, [result.coords.buffer, result.triIndices.buffer, result.edgeIndices.buffer, result.deviations.buffer]);

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

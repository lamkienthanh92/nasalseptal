import React, { useState, useMemo, useId } from "react";

// ---------------------------------------------------------------------------
// Septal cartilage shape: a simple QUADRILATERAL built to match the standard
// anatomical cross-section diagram (Dorsal / Cranial / Caudal / Posterior).
// The 4 side lengths are drawn in exact proportion to the real cm ratio
// (2.8 : 1.9 : 2.9 : 2.6) at a single px/cm scale, so the L-strut (a true
// perpendicular offset) and the graft patches are always drawn to scale
// without manual fudge factors.
//   A = cephalic-dorsal corner (keystone, toward Cranial)
//   B = dorsal-caudal corner (anterior septal angle)
//   C = caudal-ventral corner (pointed tip, toward Caudal)
//   D = ventral-cephalic corner (toward Posterior)
// ---------------------------------------------------------------------------
const A = { x: 312.6, y: 75.0 };
const B = { x: 75.0, y: 312.6 };
const C = { x: 236.3, y: 473.9 };
const D = { x: 523.4, y: 351.9 };
const QUAD = [A, B, C, D];
const CENTROID = { x: 286.8, y: 303.4 };
const BBOX = { minX: 75, maxX: 523.4, minY: 75, maxY: 473.9 };

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scalePt(a, s) {
  return { x: a.x * s, y: a.y * s };
}
function norm(a) {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
const pt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

// Natural-looking outline: several points along each side, gentle waves plus
// a few sharp teeth near the Posterior corner (mimicking the real irregular
// junction with the vomer / perpendicular plate seen on CT) — the 4 CORNERS
// A-B-C-D stay fixed, so side ratios & the L-strut (computed on the straight
// skeleton) are unaffected.
function catmullRom(points, closed = true) {
  const n = points.length;
  let d = `M ${pt(points[0])} `;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n],
      p1 = points[i],
      p2 = points[(i + 1) % n],
      p3 = points[(i + 2) % n];
    const c1 = add(p1, scalePt(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, scalePt(sub(p3, p1), 1 / 6));
    d += `C ${pt(c1)} ${pt(c2)} ${pt(p2)} `;
    if (!closed && i === n - 2) break;
  }
  return d + "Z";
}
function outwardNormal(p1, p2) {
  const dir = norm(sub(p2, p1));
  const n1 = { x: -dir.y, y: dir.x };
  const mid = scalePt(add(p1, p2), 0.5);
  const toward = sub(CENTROID, mid);
  const dot = n1.x * toward.x + n1.y * toward.y;
  return dot >= 0 ? { x: -n1.x, y: -n1.y } : n1;
}
// anatomical-direction label anchors — offset outward along each side's true
// normal (sides are now diagonal, ~45°, not axis-aligned)
const LABEL_OFFSET = 34;
function labelPos(p1, p2) {
  const mid = scalePt(add(p1, p2), 0.5);
  return add(mid, scalePt(outwardNormal(p1, p2), LABEL_OFFSET));
}
const DORSAL_LABEL = labelPos(A, B);
const CAUDAL_LABEL = labelPos(B, C);
const VENTRAL_LABEL = labelPos(C, D);
const CEPHALIC_LABEL = labelPos(D, A);
// per side: [smooth wave amplitude, wave cycles, sharp-tooth amplitude, tooth count]
const EDGE_TEXTURE = [
  { wave: 0.045, freq: 1.4, jag: 0, jagN: 0 }, // A→B dorsal: gentle wave
  { wave: 0.05, freq: 1.6, jag: 0, jagN: 0 }, // B→C caudal: gentle wave
  { wave: 0.035, freq: 1.2, jag: 0.09, jagN: 3 }, // C→D ventral: a few sharp teeth (vomer junction)
  { wave: 0.03, freq: 1.3, jag: 0.11, jagN: 4 }, // D→A cephalic: more pronounced teeth (ethmoid junction)
];
function buildOrganicPoints(corners, subN = 7) {
  const pts = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i],
      p2 = corners[(i + 1) % corners.length];
    pts.push(p1);
    const edgeLen = dist(p1, p2);
    const outward = outwardNormal(p1, p2);
    const tex = EDGE_TEXTURE[i];
    for (let s = 1; s < subN; s++) {
      const t = s / subN;
      const base = add(p1, scalePt(subPt(p2, p1), t));
      let offset =
        Math.sin(t * Math.PI * tex.freq + i * 0.7) * edgeLen * tex.wave;
      if (tex.jag > 0) {
        offset +=
          Math.sin(t * Math.PI * tex.jagN) *
          edgeLen *
          tex.jag *
          Math.sin(t * Math.PI);
      }
      pts.push(add(base, scalePt(outward, offset)));
    }
  }
  return pts;
}
function subPt(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}
const outerPathD = catmullRom(buildOrganicPoints(QUAD, 7));

// inward normal of edge P1->P2 (points into the shape, based on centroid)
function inwardNormal(P1, P2, inside) {
  const dir = norm(sub(P2, P1));
  const n1 = { x: -dir.y, y: dir.x };
  const mid = scalePt(add(P1, P2), 0.5);
  const toward = sub(inside, mid);
  return n1.x * toward.x + n1.y * toward.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
}
function lineIntersect(P1, dir1, P2, dir2) {
  const denom = dir1.x * dir2.y - dir1.y * dir2.x;
  if (Math.abs(denom) < 1e-6) return scalePt(add(P1, P2), 0.5);
  const diff = sub(P2, P1);
  const t = (diff.x * dir2.y - diff.y * dir2.x) / denom;
  return add(P1, scalePt(dir1, t));
}

// The TRUE L-strut: an exact perpendicular offset along the dorsal side (A-B)
// and the caudal side (B-C), using the intersection of the two offset lines
// as the inner corner — this gives two real perpendicular strips like the
// reference anatomy figure, not a bounding rectangle.
function lStrutGeometry(wMm, scale) {
  const wCm = wMm / 10;
  const lenAB = dist(A, B),
    lenBC = dist(B, C);
  const margin = Math.min(wCm * scale, lenAB * 0.55, lenBC * 0.55);
  const nAB = inwardNormal(A, B, CENTROID);
  const nBC = inwardNormal(B, C, CENTROID);
  const dirAB = norm(sub(B, A)),
    dirBC = norm(sub(C, B));
  const Aoff = add(A, scalePt(nAB, margin));
  const Coff = add(C, scalePt(nBC, margin));
  const P = lineIntersect(Aoff, dirAB, Coff, dirBC);
  return {
    dorsalStrut: [A, B, P, Aoff],
    caudalStrut: [B, C, Coff, P],
    harvest: [A, Aoff, P, Coff, D],
  };
}
const polyPath = (points) => "M " + points.map(pt).join(" L ") + " Z";

// point-in-polygon (ray casting)
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// true geometric centroid of a polygon (area-weighted, not just vertex average)
// — used to anchor grafts at the actual middle of the harvestable area, not a
// sub-region's own average.
function polygonCentroid(poly) {
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i],
      p2 = poly[(i + 1) % poly.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    a += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  a = a / 2;
  if (Math.abs(a) < 1e-6) return poly[0];
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

const REGION_DEFAULTS = {
  SA: { label: "SA · Anterosuperior", color: "#d98a4a", min: 3.4, max: 5.5 },
  SP: { label: "SP · Posterosuperior", color: "#5f9e72", min: 3.5, max: 10.5 },
  IP: { label: "IP · Posteroinferior", color: "#7fb8cf", min: 3.5, max: 6.7 },
  IA: { label: "IA · Anteroinferior", color: "#b97a4f", min: 4.1, max: 7.0 },
  C: { label: "C · Central", color: "#3d5a80", min: 5.0, max: 6.8 },
};

// 4 quadrants around the centroid (shared by the thickness map & the
// availability calculation)
const REGION_RECTS = {
  SA: {
    x: BBOX.minX,
    y: BBOX.minY,
    w: CENTROID.x - BBOX.minX,
    h: CENTROID.y - BBOX.minY,
  },
  SP: {
    x: CENTROID.x,
    y: BBOX.minY,
    w: BBOX.maxX - CENTROID.x,
    h: CENTROID.y - BBOX.minY,
  },
  IA: {
    x: BBOX.minX,
    y: CENTROID.y,
    w: CENTROID.x - BBOX.minX,
    h: BBOX.maxY - CENTROID.y,
  },
  IP: {
    x: CENTROID.x,
    y: CENTROID.y,
    w: BBOX.maxX - CENTROID.x,
    h: BBOX.maxY - CENTROID.y,
  },
  C: { x: CENTROID.x - 28, y: CENTROID.y - 28, w: 56, h: 56 },
};

// fraction of each region still inside the harvestable area (grid sampling —
// works for any polygon shape, no need for a bespoke formula per L-strut size)
function regionAvailability(harvestPoly) {
  const out = {};
  const N = 7;
  for (const [key, R] of Object.entries(REGION_RECTS)) {
    let inside = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const px = R.x + ((i + 0.5) / N) * R.w;
        const py = R.y + ((j + 0.5) / N) * R.h;
        if (pointInPolygon({ x: px, y: py }, harvestPoly)) inside++;
      }
    }
    out[key] = { fraction: inside / (N * N) };
  }
  return out;
}

function patchDimsCm(app) {
  if (app.mode === "maxdim") {
    const side = Math.min(app.L, Math.sqrt(app.area));
    return { w: side, h: side };
  }
  return { w: app.L, h: app.W || Math.sqrt(app.area) };
}

const APPS = [
  {
    name: "Spreader graft (each side)",
    note: "widens internal nasal valve",
    L: 2.5,
    W: 0.35,
    area: 0.9,
    thickMin: 0.8,
    mode: "strip",
  },
  {
    name: "Columellar strut",
    note: "supports nasal tip",
    L: 2.2,
    W: 0.35,
    area: 0.8,
    thickMin: 0.8,
    mode: "strip",
  },
  {
    name: "Tip / shield graft",
    note: "shapes nasal tip",
    L: 1.2,
    W: 0.9,
    area: 1.1,
    thickMin: 0.5,
    mode: "strip",
  },
  {
    name: "Alar batten / contour graft",
    note: "prevents external valve collapse",
    L: 1.3,
    W: 0.5,
    area: 0.65,
    thickMin: 0.5,
    mode: "strip",
  },
  {
    name: "Small dorsal onlay",
    note: "fills a dorsal saddle depression",
    L: 1.2,
    W: 1.2,
    area: 1.5,
    thickMin: 0.5,
    mode: "strip",
  },
  {
    name: "External auditory canal reconstruction",
    note: "literature: graft ~1×3.2 cm",
    L: 3.2,
    W: 1.0,
    area: 3.2,
    thickMin: 0.3,
    mode: "strip",
  },
  {
    name: "Laryngotracheal reconstruction (stentless)",
    note: "literature: graft under 3 cm",
    L: 3.0,
    W: 0,
    area: 2.0,
    thickMin: 0.5,
    mode: "maxdim",
  },
  {
    name: "Tracheal reconstruction (short segment)",
    note: "literature: ~3×5 cm, needs mucosa + perichondrium",
    L: 5,
    W: 3,
    area: 15,
    thickMin: 0.5,
    mode: "strip",
  },
];

const ink = "#16262b";
const muted = "#6f7c78";
const line = "#d9d2c2";
const mono = "'IBM Plex Mono', monospace";
const serif = "'Source Serif 4', Georgia, serif";

function Field({ label, unit, value, onChange, step = 0.1 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <label style={{ fontSize: 13, lineHeight: 1.25, color: ink }}>
        {label}
        {unit && (
          <span style={{ display: "block", fontSize: 11, color: muted }}>
            {unit}
          </span>
        )}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: 96,
          textAlign: "right",
          borderRadius: 3,
          padding: "4px 8px",
          fontSize: 13,
          border: `1px solid ${line}`,
          background: "#fdfcf9",
          fontFamily: mono,
        }}
      />
    </div>
  );
}

function Badge({ status, children }) {
  const styles = {
    ok: { background: "rgba(44,110,99,0.14)", color: "#1c473f" },
    warn: { background: "rgba(184,118,58,0.16)", color: "#b8763a" },
    no: { background: "rgba(164,69,60,0.13)", color: "#a4453c" },
  };
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        whiteSpace: "nowrap",
        fontFamily: mono,
        ...styles[status],
      }}
    >
      {children}
    </span>
  );
}

export default function CartilageGraftSimulator() {
  const clipId = useId().replace(/:/g, "");

  const [edges, setEdges] = useState({
    dorsal: 2.8,
    caudal: 1.9,
    cephalic: 2.9,
    ventral: 2.6,
  });
  const [cartArea, setCartArea] = useState(7.3);
  const [wMm, setWMm] = useState(10);
  const [regions, setRegions] = useState(REGION_DEFAULTS);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const setRegionField = (key, field, val) =>
    setRegions((r) => ({ ...r, [key]: { ...r[key], [field]: val } }));

  // ONE single px/cm scale, anchored to the dorsal side (as requested) — since
  // the drawn shape's 4 sides are already in correct relative proportion,
  // using one shared scale for everything (L-strut, grafts) stays consistent.
  const scale = edges.dorsal > 0 ? dist(A, B) / edges.dorsal : 120;

  const { dorsalStrut, caudalStrut, harvest } = useMemo(
    () => lStrutGeometry(wMm, scale),
    [wMm, scale]
  );

  const wCm = wMm / 10;
  const hsc = Math.max(
    0,
    cartArea - edges.dorsal * wCm - edges.caudal * wCm + wCm * wCm
  );
  const pct = cartArea > 0 ? Math.round((hsc / cartArea) * 100) : 0;
  const availLen = Math.max(edges.cephalic, edges.ventral);
  const availW =
    availLen > 0
      ? Math.min(hsc / availLen, Math.min(edges.dorsal, edges.caudal))
      : 0;

  const thickMm = Math.max(...Object.values(regions).map((r) => r.max));
  const regionAvail = useMemo(() => regionAvailability(harvest), [harvest]);

  const appRows = APPS.map((app) => {
    let status, label;
    if (app.mode === "maxdim") {
      const areaOk = hsc >= app.area,
        thickOk = thickMm >= app.thickMin;
      status = areaOk && thickOk ? "ok" : areaOk || thickOk ? "warn" : "no";
      label =
        status === "ok"
          ? "Feasible"
          : status === "warn"
          ? "Borderline"
          : "Insufficient";
    } else {
      const areaOk = hsc >= app.area,
        lenOk = availLen >= app.L,
        widOk = availW >= app.W,
        thickOk = thickMm >= app.thickMin;
      const passCount = [areaOk, lenOk, widOk, thickOk].filter(Boolean).length;
      if (areaOk && lenOk && widOk && thickOk) {
        const margin = Math.min(
          hsc / app.area,
          availLen / app.L,
          availW / (app.W || 0.01)
        );
        status = margin >= 1.25 ? "ok" : "warn";
        label = status === "ok" ? "Feasible" : "Feasible (tight margin)";
      } else if (passCount >= 2) {
        status = "warn";
        label = "Borderline / one dimension short";
      } else {
        status = "no";
        label = "Insufficient";
      }
    }
    const suggested = Object.entries(regions)
      .filter(
        ([key, r]) => r.max >= app.thickMin && regionAvail[key].fraction > 0.15
      )
      .sort((a, b) => regionAvail[b[0]].fraction - regionAvail[a[0]].fraction)
      .map(([key]) => key);
    return { ...app, status, label, suggested };
  });

  const selectedApp = selectedIdx != null ? appRows[selectedIdx] : null;
  const harvestCentroid = useMemo(() => polygonCentroid(harvest), [harvest]);
  const patch = useMemo(() => {
    if (!selectedApp || !selectedApp.suggested.length) return null;
    const key = selectedApp.suggested[0];
    const anchor = harvestCentroid;
    const dims = patchDimsCm(selectedApp);
    const w = dims.w * scale,
      h = dims.h * scale;
    return {
      key,
      x: anchor.x - w / 2,
      y: anchor.y - h / 2,
      w,
      h,
      dims,
      anchor,
    };
  }, [selectedApp, harvestCentroid, scale]);

  // --- callout box layout for the thickness map (style of the original Fig 3.2) ---
  const callouts = [
    { key: "SA", x: 10, y: 10, w: 160, anchor: [180.9, 189.2] },
    { key: "SP", x: 430, y: 10, w: 160, anchor: [405.1, 189.2] },
    { key: "IP", x: 430, y: 455, w: 160, anchor: [405.1, 388.7] },
    { key: "IA", x: 10, y: 455, w: 160, anchor: [180.9, 388.7] },
    { key: "C", x: 220, y: 505, w: 160, anchor: [286.8, 303.4] },
  ];

  const sectionLabel = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#1c473f",
    fontFamily: mono,
    borderBottom: `1px solid ${line}`,
    paddingBottom: 4,
    marginBottom: 8,
  };
  const panelBox = {
    background: "#fff",
    borderRadius: 4,
    border: `1px solid ${line}`,
    padding: 20,
  };
  const h2Style = {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
    fontFamily: serif,
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#f4f1e9",
        color: ink,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "28px 16px" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
            color: "#1c473f",
            fontFamily: mono,
          }}
        >
          Prototype — not for clinical decision-making
        </div>
        <h1
          style={{
            fontSize: "clamp(24px,3vw,32px)",
            fontWeight: 700,
            marginBottom: 8,
            fontFamily: serif,
          }}
        >
          Septal Cartilage Graft Harvest &amp; Application Simulator
        </h1>
        <p
          style={{
            fontSize: 14,
            maxWidth: 672,
            marginBottom: 24,
            color: muted,
            lineHeight: 1.5,
          }}
        >
          Enter measurements from CT imaging (RadiAnt / 3D Slicer) to estimate
          the safe harvestable area and match it against common surgical
          applications. The diagram follows standard
          Dorsal–Cranial–Caudal–Posterior anatomical orientation, with all 4
          sides scaled to your entered measurements.
        </p>

        <div
          style={{ display: "grid", gap: 20, gridTemplateColumns: "340px 1fr" }}
        >
          {/* INPUT PANEL */}
          <div style={panelBox}>
            <h2 style={h2Style}>Measurements</h2>

            <div style={sectionLabel}>Length of the 4 sides (cm)</div>
            <Field
              label="Dorsal side"
              value={edges.dorsal}
              onChange={(v) => setEdges((e) => ({ ...e, dorsal: v }))}
            />
            <Field
              label="Caudal side"
              value={edges.caudal}
              onChange={(v) => setEdges((e) => ({ ...e, caudal: v }))}
            />
            <Field
              label="Cephalic side"
              value={edges.cephalic}
              onChange={(v) => setEdges((e) => ({ ...e, cephalic: v }))}
            />
            <Field
              label="Vomerine (ventral) side"
              value={edges.ventral}
              onChange={(v) => setEdges((e) => ({ ...e, ventral: v }))}
            />

            <div style={{ ...sectionLabel, marginTop: 16 }}>Area</div>
            <Field
              label="Cartilage area"
              unit="cm²"
              value={cartArea}
              onChange={setCartArea}
            />

            <div style={{ ...sectionLabel, marginTop: 16 }}>L-strut width</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>Width preserved</span>
              <span
                style={{ fontFamily: mono, color: "#1c473f", fontWeight: 600 }}
              >
                {wMm.toFixed(1).replace(/\.0$/, "")} mm
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={15}
              step={0.5}
              value={wMm}
              onChange={(e) => setWMm(parseFloat(e.target.value))}
              style={{ width: "100%", marginBottom: 8, accentColor: "#2c6e63" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setWMm(10)}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  padding: "4px 0",
                  fontSize: 11,
                  border: `1px solid ${line}`,
                  background: "#efece3",
                  fontFamily: mono,
                  cursor: "pointer",
                }}
              >
                10mm default
              </button>
              <button
                onClick={() => setWMm(15)}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  padding: "4px 0",
                  fontSize: 11,
                  border: `1px solid ${line}`,
                  background: "#efece3",
                  fontFamily: mono,
                  cursor: "pointer",
                }}
              >
                15mm safer
              </button>
            </div>

            <div style={{ ...sectionLabel, marginTop: 16 }}>
              Thickness by region (mm)
            </div>
            <table
              style={{
                width: "100%",
                fontSize: 12,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ color: muted }}>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: 400,
                      paddingBottom: 4,
                    }}
                  >
                    Region
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: 400,
                      paddingBottom: 4,
                    }}
                  >
                    Thinnest
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontWeight: 400,
                      paddingBottom: 4,
                    }}
                  >
                    Thickest
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(regions).map(([key, r]) => (
                  <tr key={key}>
                    <td
                      style={{
                        padding: "4px 0",
                        color: r.color,
                        fontWeight: 600,
                      }}
                    >
                      {key}
                    </td>
                    <td style={{ padding: "4px 0", textAlign: "right" }}>
                      <input
                        type="number"
                        step={0.1}
                        value={r.min}
                        onChange={(e) =>
                          setRegionField(
                            key,
                            "min",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        style={{
                          width: 56,
                          textAlign: "right",
                          borderRadius: 3,
                          padding: "2px 4px",
                          border: `1px solid ${line}`,
                          fontFamily: mono,
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px 0", textAlign: "right" }}>
                      <input
                        type="number"
                        step={0.1}
                        value={r.max}
                        onChange={(e) =>
                          setRegionField(
                            key,
                            "max",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        style={{
                          width: 56,
                          textAlign: "right",
                          borderRadius: 3,
                          padding: "2px 4px",
                          border: `1px solid ${line}`,
                          fontFamily: mono,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* RESULTS */}
          <div style={panelBox}>
            <h2 style={h2Style}>Harvestable Area</h2>

            <div
              style={{
                display: "grid",
                gap: 16,
                marginBottom: 20,
                gridTemplateColumns: "1fr 200px",
              }}
            >
              <svg
                viewBox="0 0 600 550"
                style={{ width: "100%", height: "auto" }}
              >
                <defs>
                  <clipPath id={`${clipId}-harvest`}>
                    <path d={polyPath(harvest)} />
                  </clipPath>
                </defs>
                <path
                  d={outerPathD}
                  fill="rgba(44,110,99,0.26)"
                  stroke="#2c6e63"
                  strokeWidth="1.6"
                />
                <path
                  d={polyPath(dorsalStrut)}
                  fill="rgba(184,118,58,0.55)"
                  stroke="#b8763a"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d={polyPath(caudalStrut)}
                  fill="rgba(184,118,58,0.55)"
                  stroke="#b8763a"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                {patch && (
                  <g clipPath={`url(#${clipId}-harvest)`}>
                    <rect
                      x={patch.x}
                      y={patch.y}
                      width={patch.w}
                      height={patch.h}
                      rx="3"
                      fill="#fdfcf9"
                      stroke="#16262b"
                      strokeWidth="2"
                      strokeDasharray="5,3"
                    />
                  </g>
                )}
                <path
                  d={outerPathD}
                  fill="none"
                  stroke="#c9c0aa"
                  strokeWidth="2"
                />

                {/* anatomical direction labels, English only, matching reference figure */}
                <text
                  x={DORSAL_LABEL.x}
                  y={DORSAL_LABEL.y}
                  textAnchor="middle"
                  fontFamily={mono}
                  fontSize="13"
                  fontWeight="600"
                  fill="#8a5a28"
                >
                  Dorsal — {edges.dorsal.toFixed(1)}cm
                </text>
                <text
                  x={CAUDAL_LABEL.x}
                  y={CAUDAL_LABEL.y}
                  textAnchor="middle"
                  fontFamily={mono}
                  fontSize="13"
                  fontWeight="600"
                  fill="#8a5a28"
                >
                  Caudal — {edges.caudal.toFixed(1)}cm
                </text>
                <text
                  x={CEPHALIC_LABEL.x}
                  y={CEPHALIC_LABEL.y}
                  textAnchor="middle"
                  fontFamily={mono}
                  fontSize="12.5"
                  fill="#16262b"
                >
                  Cranial — {edges.cephalic.toFixed(1)}cm
                </text>
                <text
                  x={VENTRAL_LABEL.x}
                  y={VENTRAL_LABEL.y}
                  textAnchor="middle"
                  fontFamily={mono}
                  fontSize="12.5"
                  fill="#16262b"
                >
                  Posterior — {edges.ventral.toFixed(1)}cm
                </text>

                {patch && (
                  <g>
                    <circle
                      cx={patch.anchor.x}
                      cy={patch.anchor.y}
                      r="2.5"
                      fill="#16262b"
                    />
                    <text
                      x={patch.x + patch.w / 2}
                      y={
                        patch.y - 10 < 30
                          ? patch.y + patch.h + 22
                          : patch.y - 10
                      }
                      textAnchor="middle"
                      fontFamily="Inter"
                      fontSize="12"
                      fontWeight="600"
                      fill="#16262b"
                    >
                      {selectedApp.name}
                    </text>
                    <text
                      x={patch.x + patch.w / 2}
                      y={
                        (patch.y - 10 < 30
                          ? patch.y + patch.h + 22
                          : patch.y - 10) + 15
                      }
                      textAnchor="middle"
                      fontFamily={mono}
                      fontSize="11"
                      fill="#4a5551"
                    >
                      ~{patch.dims.w.toFixed(1)}×{patch.dims.h.toFixed(1)} cm ·
                      region {patch.key}
                    </text>
                  </g>
                )}
                {selectedApp && !patch && (
                  <text
                    x={CENTROID.x}
                    y={CENTROID.y}
                    textAnchor="middle"
                    fontFamily="Inter"
                    fontSize="13"
                    fontWeight="600"
                    fill="#a4453c"
                  >
                    No suitable region for this application
                  </text>
                )}
              </svg>
              <div
                style={{
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  justifyContent: "center",
                  color: muted,
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      marginRight: 6,
                      background: "rgba(184,118,58,0.55)",
                      border: "1px solid #b8763a",
                    }}
                  />
                  L-strut (2 perpendicular strips, preserved)
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      marginRight: 6,
                      background: "rgba(44,110,99,0.4)",
                      border: "1px solid #2c6e63",
                    }}
                  />
                  Harvestable area
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      marginRight: 6,
                      background: "#fdfcf9",
                      border: "1.5px dashed #16262b",
                    }}
                  />
                  Simulated graft (click an application below)
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  borderRadius: 3,
                  padding: 12,
                  background: "#fbfaf6",
                  border: `1px solid ${line}`,
                  borderLeft: "4px solid #2c6e63",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    fontFamily: mono,
                    color: "#1c473f",
                  }}
                >
                  {hsc.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: muted }}>
                  Harvestable area (cm²)
                </div>
              </div>
              <div
                style={{
                  borderRadius: 3,
                  padding: 12,
                  background: "#fbfaf6",
                  border: `1px solid ${line}`,
                  borderLeft: "4px solid #2c6e63",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    fontFamily: mono,
                    color: "#1c473f",
                  }}
                >
                  {pct}%
                </div>
                <div style={{ fontSize: 11, color: muted }}>
                  Of total cartilage area
                </div>
              </div>
              <div
                style={{
                  borderRadius: 3,
                  padding: 12,
                  background: "#fbfaf6",
                  border: `1px solid ${line}`,
                  borderLeft: "4px solid #2c6e63",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    fontFamily: mono,
                    color: "#1c473f",
                  }}
                >
                  {availLen.toFixed(1)}×{Math.max(availW, 0).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: muted }}>
                  Estimated largest strip (L×W, cm)
                </div>
              </div>
            </div>

            <h2 style={h2Style}>Thickness Map by Region</h2>
            <div
              style={{ position: "relative", marginBottom: 24, minHeight: 550 }}
            >
              <svg
                viewBox="0 0 600 550"
                style={{ width: "100%", height: "auto" }}
              >
                <defs>
                  <clipPath id={clipId}>
                    <path d={outerPathD} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${clipId})`}>
                  {Object.entries(REGION_RECTS).map(([key, R]) => (
                    <rect
                      key={key}
                      x={R.x}
                      y={R.y}
                      width={R.w}
                      height={R.h}
                      fill={regions[key].color}
                      opacity={key === "C" ? 0.85 : 0.55}
                    />
                  ))}
                </g>
                <path
                  d={outerPathD}
                  fill="none"
                  stroke="#c9c0aa"
                  strokeWidth="2"
                />
                {callouts.map((c) => {
                  const r = regions[c.key];
                  return (
                    <g key={c.key}>
                      <line
                        x1={c.anchor[0]}
                        y1={c.anchor[1]}
                        x2={c.x + c.w / 2}
                        y2={c.y < CENTROID.y ? c.y + 34 : c.y}
                        stroke="#9a9284"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <rect
                        x={c.x}
                        y={c.y}
                        width={c.w}
                        height={34}
                        rx="3"
                        fill="#fdfcf9"
                        stroke={r.color}
                        strokeWidth="1.3"
                      />
                      <text
                        x={c.x + 8}
                        y={c.y + 13}
                        fontFamily="Inter"
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#16262b"
                      >
                        {r.label}
                      </text>
                      <text
                        x={c.x + 8}
                        y={c.y + 27}
                        fontFamily={mono}
                        fontSize="10"
                        fill="#4a5551"
                      >
                        thinnest {r.min}mm · thickest {r.max}mm
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <h2 style={h2Style}>Feasible Applications</h2>
            <table
              style={{
                width: "100%",
                fontSize: 13,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ color: muted }}>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: 400,
                      paddingBottom: 8,
                      borderBottom: `1px solid ${line}`,
                      fontFamily: mono,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Application
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: 400,
                      paddingBottom: 8,
                      borderBottom: `1px solid ${line}`,
                      fontFamily: mono,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Reference requirement
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: 400,
                      paddingBottom: 8,
                      borderBottom: `1px solid ${line}`,
                      fontFamily: mono,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Suggested region
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: 400,
                      paddingBottom: 8,
                      borderBottom: `1px solid ${line}`,
                      fontFamily: mono,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Assessment
                  </th>
                </tr>
              </thead>
              <tbody>
                {appRows.map((app, idx) => {
                  const isSelected = idx === selectedIdx;
                  const cellStyle = {
                    padding: "10px 0",
                    borderBottom: "1px solid #ece7da",
                    verticalAlign: "top",
                  };
                  return (
                    <tr
                      key={app.name}
                      onClick={() => setSelectedIdx(isSelected ? null : idx)}
                      style={{
                        cursor: "pointer",
                        background: isSelected
                          ? "rgba(44,110,99,0.08)"
                          : "transparent",
                      }}
                    >
                      <td
                        style={{
                          ...cellStyle,
                          borderLeft: isSelected
                            ? "3px solid #2c6e63"
                            : "3px solid transparent",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{app.name}</div>
                        <div style={{ fontSize: 11.5, color: muted }}>
                          {app.note}
                        </div>
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          fontSize: 12,
                          fontFamily: mono,
                          color: "#555",
                        }}
                      >
                        {app.mode === "maxdim"
                          ? `longest side ≤ ${app.L} cm · area ≥ ${app.area} cm² · thickness ≥ ${app.thickMin} mm`
                          : `${app.L}×${app.W || "–"} cm · area ≥ ${
                              app.area
                            } cm² · thickness ≥ ${app.thickMin} mm`}
                      </td>
                      <td style={cellStyle}>
                        {app.suggested.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {app.suggested.map((key, i) => (
                              <span
                                key={key}
                                style={{
                                  display: "inline-block",
                                  borderRadius: 3,
                                  padding: "2px 6px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background:
                                    isSelected && i === 0
                                      ? regions[key].color
                                      : `${regions[key].color}22`,
                                  color:
                                    isSelected && i === 0
                                      ? "#fff"
                                      : regions[key].color,
                                  border: `1px solid ${regions[key].color}55`,
                                }}
                              >
                                {key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "#a4453c" }}>
                            no suitable region
                          </span>
                        )}
                      </td>
                      <td style={cellStyle}>
                        <Badge status={app.status}>{app.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${line}`,
                fontSize: 12,
                lineHeight: 1.6,
                color: muted,
              }}
            >
              <b style={{ color: ink }}>Note:</b> The diagram is built to follow
              standard Dorsal–Cranial–Caudal–Posterior anatomical orientation,
              with all 4 sides scaled proportionally to your real measurements
              (px/cm ratio derived from the dorsal side). The L-strut is
              computed as a true perpendicular offset along the dorsal + caudal
              sides (taking the intersection of the two offset lines as the
              inner corner), not a bounding rectangle — so it always renders as
              an accurate "L" shape with the correct margin-to-side ratio,
              without spilling too far toward the center. HSC is estimated as
              HSC ≈ Cartilage area − (dorsal side × w) − (caudal side × w) + w²,
              consistent with the study's real data (7.3→3.5 cm² at w=10mm; →2.2
              cm² at w=15mm) — this figure is computed independently via the
              formula, not from the drawing. "Suggested region" is determined by
              comparing each region's maximum thickness against the required
              threshold, and grid-sampling points within each region to estimate
              what fraction still lies within the harvestable area — a region
              more than 85% covered by the L-strut is not suggested. Size
              thresholds for each graft type are compiled from the literature
              and are for planning guidance only — the final decision rests with
              the operating surgeon.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

# Methods

All coordinates are patient LPS (x to the left, y posterior, z superior), in millimetres. The reformat plane is defined by a centre, a yaw about the vertical axis and a roll about the antero-posterior axis; its in-plane axes are u (posterior) and v (superior), and its normal n points to the patient's left. Anterior is on the left of the reformat image.

## 1. Plane
*Detect plane* scores left-right symmetry of the tissue mask (HU above −300) over yaw and shift; this follows the skull, not the septum. *Align plane to septum* (below) moves the plane onto the septum.

## 2. Septal sheet
For every point on a 0.5 mm grid over the current view the CT is sampled along n (±22 mm, 0.25 mm steps). Runs of tissue (HU ≥ −450) that are 0.8–9 mm long and have at least 1.5 mm of air on both sides are candidate septal sheets; the one whose centre is nearest to the plane (within a gate) is taken. For each column the offset from the plane, thickness, mean and peak HU are stored. A column is **soft** (cartilage-like) if its peak HU is below 230.

## 3. Align plane to septum
Three passes with gates 12, 6 and 4 mm: fit `offset = a + b·u + c·v` to the soft columns by iteratively reweighted least squares (Cauchy weights, scale 0.8 mm), then tilt and shift the plane by (a, b, c). The final analysis uses a 5 mm gate.

## 4. Suggested outline and landmarks
Soft columns 1–7 mm thick are cleaned by a 2 mm opening; the largest component is closed (1.5 mm), holes are filled, its boundary is traced and simplified (Douglas–Peucker, 1.2 mm). **K** is the highest vertex, **ASA** the most anterior vertex above the lowest 15% of the outline, **ANS** the lowest vertex at least a quarter of the width behind ASA. These are starting points.

## 5. L-strut and harvestable cartilage
Dorsal strut K→ASA and caudal strut ASA→ANS. Each line is moved inward by the strut width; the outline is clipped by both half-planes (Sutherland–Hodgman). Reported: projected area; area on the curved septum (each grid cell weighted by √(1 + (∂offset/∂u)² + (∂offset/∂v)²)); lengths of the harvest edges on the two lines; longest and narrowest span (Feret).

## 6. Graft placement and plans
Each graft is a rectangle. Candidate positions are tried on a 1 mm grid at 7.5° steps; a rectangle fits if all of its sample points (every 1 mm, including corners) lie inside the harvestable region (0.5 mm raster). Several grafts are placed by depth-first search so that they share no 1 mm cell. A plan is **Feasible** if all grafts fit when enlarged by the fit margin, **Borderline** if they fit only at the listed sizes, **Insufficient** otherwise. When a graft does not fit, the longest and widest graft of the same width or length that does fit is reported. The suggested plan is, among feasible plans, the one with the most grafts and then the least cartilage used.

## 7. Septum statistics
Within the 5 mm gate: 95th percentile and RMS of |offset|, area with |offset| > 3 mm, mean thickness of soft columns (includes mucosa and partial volume). Inside the outline: share of columns that are not soft (ossified share).

## 8. Validation
`validation/` derives a reference plane and outline from the NasalSeg nasal-cavity labels (septum = band between the right and left cavity labels; plane fitted to the band midline; outline = soft part of the band on that plane). On four cases the aligned plane differed from the reference by 0.4–1.5° and the suggested outline overlapped the reference outline with IoU 0.42–0.74 (usually smaller). This checks agreement with a label-based reference only.

## Known limits
Single-plane projection; thin cartilage and 1.5 mm slices; thickness includes mucosa; rule-based, not a trained model; not validated against surgeons' decisions.

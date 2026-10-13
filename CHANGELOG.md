# Changelog

## Unreleased
- Source split into `src/` (template, stylesheet, ordered script parts) with a dependency-free `build.mjs`; the built `index.html` is byte-identical to version 2.0.2.
- Earlier React prototype moved to `legacy/`.

## 2.0.2 (2026-10-12)
- Reference chart in the Planning tab uses author-year labels.
- Print overlay (black and white, hatched) also applies to the 3D view; optional grayscale 3D colouring.
- "Outline only" option for the 3D septal sheet.

## 2.0.0 (2026-10-11)
- Align plane to the septum; suggest outline and landmarks (K, ASA, ANS).
- Septum analysis: deviation, thickness, ossified share, area on the curved septum.
- Graft placement without overlap, comparison of five plans with a stated suggestion rule.
- Angle, HU disc and thickness tools; richer 3D view with layers.
- DPI-aware reformat canvas.

## 1.0.0 (2026-10-11)
- First version: DICOM/NRRD reader, midsagittal reformat, outline and landmarks, L-strut and harvestable area, graft feasibility, 3D bone view.

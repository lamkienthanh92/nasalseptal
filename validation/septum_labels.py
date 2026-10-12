"""Helpers to read NasalSeg cases and identify the nasal-cavity labels by geometry."""
import numpy as np, nrrd

def load(root, case):
    img, h = nrrd.read(f"{root}/images/{case}_img.nrrd")
    seg, _ = nrrd.read(f"{root}/labels/{case}_seg.nrrd")
    org = np.array(h["space origin"], float)
    sp = np.abs(np.diag(h["space directions"]))
    return img.astype(np.float32), seg, org, sp

def roles(seg, org, sp):
    """Label order differs from the dataset description, so roles are found from geometry:
    nasopharynx = most posterior centroid, maxillary sinuses = the two most lateral,
    nasal cavities = the remaining two (smaller x = patient right in LPS)."""
    cen = {l: (np.argwhere(seg == l).mean(0) * sp + org) for l in range(1, 6) if (seg == l).any()}
    if len(cen) < 5:
        return None
    nasopharynx = max(cen, key=lambda l: cen[l][1])
    rest = [l for l in cen if l != nasopharynx]
    xm = np.mean([cen[l][0] for l in cen])
    rest.sort(key=lambda l: -abs(cen[l][0] - xm))
    nasal = sorted(rest[2:], key=lambda l: cen[l][0])
    return {"R": nasal[0], "L": nasal[1], "np": nasopharynx}

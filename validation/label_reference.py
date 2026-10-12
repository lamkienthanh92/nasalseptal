"""Reference septal plane and outline derived from the NasalSeg nasal-cavity labels.

The septum is the thin band between the right and left nasal-cavity labels. A plane is fitted to the
midline of that band; the outline is the soft (below 230 HU) part of the band on that plane after
opening, which gives a label-based reference to compare the app's suggestion with."""
import numpy as np
from scipy.ndimage import (map_coordinates, gaussian_filter, binary_opening, binary_closing,
                           binary_fill_holes, binary_dilation, label)
from shapely.geometry import Polygon
from skimage import measure
from septum_labels import load, roles

def basis(yaw, roll):
    a, b = np.radians(yaw), np.radians(roll)
    cz, sz, cb, sb = np.cos(a), np.sin(a), np.cos(b), np.sin(b)
    R = lambda v: np.array([(v[0]*cb+v[2]*sb)*cz - v[1]*sz, (v[0]*cb+v[2]*sb)*sz + v[1]*cz, -v[0]*sb + v[2]*cb])
    return R([1, 0, 0]), R([0, 1, 0]), R([0, 0, 1])

def reference(root, case, px=0.5):
    d, s, org, sp = load(root, case)
    rl = roles(s, org, sp)
    if not rl:
        return None
    nx, ny, nz = d.shape
    R, L = (s == rl["R"]), (s == rl["L"])
    rmax = np.full((ny, nz), -1); lmin = np.full((ny, nz), 10**6); rows = []
    for k in range(nz):
        for j in range(ny):
            rr, ll = np.where(R[:, j, k])[0], np.where(L[:, j, k])[0]
            if len(rr): rmax[j, k] = rr.max()
            if len(ll): lmin[j, k] = ll.min()
            if len(rr) and len(ll) and ll.min() > rr.max() and 0.5 < (ll.min()-rr.max()-1)*sp[0] < 6.5:
                rows.append((j*sp[1]+org[1], k*sp[2]+org[2], (rr.max()+ll.min())/2*sp[0]+org[0]))
    a = np.array(rows)
    if len(a) < 300:
        return None
    A = np.c_[np.ones(len(a)), a[:, 0], a[:, 1]]; w = np.ones(len(a))
    for _ in range(5):
        co, *_ = np.linalg.lstsq(A*w[:, None], a[:, 2]*w, rcond=None)
        res = a[:, 2] - A@co; w = 1/(1+(res/0.8)**2)
    c0, b, cc = co; yc, zc = a[:, 0].mean(), a[:, 1].mean(); x0 = c0 + b*yc + cc*zc
    n = np.array([1, -b, -cc]); n /= np.linalg.norm(n)
    yaw = np.degrees(np.arctan2(n[1], n[0])); roll = np.degrees(np.arcsin(-n[2]))
    N, U, V = basis(yaw, roll); c = np.array([x0, yc, zc])
    us = np.arange(-45, 45, px); vs = np.arange(40, -40, -px); UU, VV = np.meshgrid(us, vs)
    P = c[None, None, :] + UU[..., None]*U + VV[..., None]*V
    idx = [(P[..., 0]-org[0])/sp[0], (P[..., 1]-org[1])/sp[1], (P[..., 2]-org[2])/sp[2]]
    img = map_coordinates(d, idx, order=1, cval=-1024)
    J = np.clip(np.round(idx[1]).astype(int), 0, ny-1); K = np.clip(np.round(idx[2]).astype(int), 0, nz-1)
    inside = (idx[0] >= rmax[J, K]-0.5) & (idx[0] <= lmin[J, K]+0.5) & (rmax[J, K] >= 0) & (lmin[J, K] < 10**6)
    sm = gaussian_filter(img, 0.6/px); m = inside & (sm > 10) & (sm < 230)
    it = int(round(1.5/px)); m = binary_closing(m, iterations=it); m = binary_opening(m, iterations=max(1, it//2)); m = binary_fill_holes(m)
    lab, nl = label(binary_opening(m, iterations=int(round(2.5/px))))
    if nl == 0:
        return None
    ci = 1 + int(np.argmax([(lab == i).sum() for i in range(1, nl+1)]))
    cm = binary_fill_holes(binary_dilation(lab == ci, iterations=int(round(1.5/px))) & m)
    cont = max(measure.find_contours(cm.astype(float), 0.5), key=len)
    pts = np.c_[us[0]+cont[:, 1]*px, vs[0]-cont[:, 0]*px]
    pg = Polygon(pts).buffer(0)
    return {"case": case, "yaw": yaw, "roll": roll, "center": c.tolist(), "normal": N.tolist(),
            "area": pg.area, "poly_world": [(c+u*U+v*V).tolist() for u, v in pg.simplify(1.5).exterior.coords[:-1]]}

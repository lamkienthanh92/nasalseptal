"""Compare the app's plane alignment and suggested outline with the label-based reference.

Needs: Python 3.9+, numpy, scipy, shapely, scikit-image, pynrrd, playwright (with Chromium).
Usage:  python validate_engine.py --nasalseg /path/to/NasalSeg P101 P050 P130 P094
The app is opened from ../index.offline.html, so no network is needed."""
import argparse, json, pathlib, numpy as np
from playwright.sync_api import sync_playwright
from shapely.geometry import Polygon
from label_reference import reference

ap = argparse.ArgumentParser(); ap.add_argument("cases", nargs="+"); ap.add_argument("--nasalseg", required=True)
ap.add_argument("--app", default=str(pathlib.Path(__file__).resolve().parent.parent / "index.offline.html"))
args = ap.parse_args()
print("case   normal diff (deg)   outline IoU   app area   ref area")
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"])
    for case in args.cases:
        ref = reference(args.nasalseg, case)
        if ref is None:
            print(case, "no reference"); continue
        pg = b.new_page(viewport={"width": 1500, "height": 900})
        pg.goto("file://" + args.app); pg.wait_for_timeout(400)
        pg.click("nav button[data-tab=patient]"); pg.set_input_files("#file", f"{args.nasalseg}/images/{case}_img.nrrd")
        pg.wait_for_function("window.__S.vol!==null", timeout=90000); pg.wait_for_timeout(1000)
        pg.evaluate("__api.alignPlane()"); pg.wait_for_timeout(500)
        pg.evaluate("__api.suggestOutline()")
        d = json.loads(pg.evaluate("JSON.stringify({snap:__S.snap,pts:__S.pts})"))
        sn = d["snap"]; uv = lambda P: [float((np.array(P)-np.array(sn["c"])) @ np.array(sn["u"])), float((np.array(P)-np.array(sn["c"])) @ np.array(sn["v"]))]
        rp = Polygon([uv(P) for P in ref["poly_world"]]).buffer(0)
        ap_ = Polygon([uv(P) for P in d["pts"]]).buffer(0) if d["pts"] else None
        iou = rp.intersection(ap_).area / rp.union(ap_).area if ap_ else float("nan")
        ang = np.degrees(np.arccos(np.clip(abs(np.array(sn["n"]) @ np.array(ref["normal"])), 0, 1)))
        print(f"{case}   {ang:5.2f}               {iou:4.2f}          {ap_.area if ap_ else 0:6.0f}     {rp.area:6.0f}")
        pg.close()
    b.close()

# Validation scripts

`validate_engine.py` compares the app's plane alignment and suggested outline with a reference derived from the NasalSeg nasal-cavity labels (`label_reference.py`).

```
pip install numpy scipy shapely scikit-image pynrrd playwright && playwright install chromium
python validate_engine.py --nasalseg /path/to/NasalSeg P101 P050 P130 P094
```

NasalSeg is not included (download from Zenodo, doi:10.5281/zenodo.13893419). The reference is itself an approximation (soft tissue between the two cavity labels), so overlap values describe agreement with that reference, not accuracy against true cartilage.

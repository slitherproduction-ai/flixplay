import sys, pathlib
v = sys.argv[1]
def sub(path, old, new):
    p = pathlib.Path(path); s = p.read_text()
    assert old in s, (path, old); p.write_text(s.replace(old, new, 1)); print("patched", path)
if v in ("noalp", "both"):
    sub("app/(tabs)/_layout.tsx", "      <ActiveListProblem />\n", "")
if v in ("nobar", "both"):
    sub("features/login/mobile-login-form.tsx", "        {bar ? <LoadingBar /> : null}\n", "")

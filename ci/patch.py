import sys, pathlib
v = sys.argv[1]
def sub(path, old, new):
    p = pathlib.Path(path); s = p.read_text()
    assert old in s, (path, old); p.write_text(s.replace(old, new, 1)); print("patched", path)
if v in ("noalp", "both"):
    sub("app/(tabs)/_layout.tsx", "      <ActiveListProblem />\n", "")
if v in ("nobar", "both"):
    sub("features/login/mobile-login-form.tsx", "        {bar ? <LoadingBar /> : null}\n", "")
if v == "noclip":
    import subprocess
    for f in subprocess.run(["grep","-rl","removeClippedSubviews","app","components","features"],capture_output=True,text=True).stdout.split():
        t=pathlib.Path(f).read_text(); n=t.replace('removeClippedSubviews={Platform.OS === "android"}','removeClippedSubviews={false}').replace("removeClippedSubviews\n","removeClippedSubviews={false}\n")
        if n!=t: pathlib.Path(f).write_text(n); print("noclip", f)
if v in ("mark", "nophase"):
    p = pathlib.Path("app/login.tsx"); s = p.read_text()
    s = s.replace('      setProgress({ phase: "account", serverMs', '      console.log("REPRO account");\n      setProgress({ phase: "account", serverMs')
    s = s.replace('      setProgress((current) => ({ ...current, phase: "catalog" }));', '      console.log("REPRO catalog");\n      setProgress((current) => ({ ...current, phase: "catalog" }));')
    s = s.replace('      addServer({ ...profile, ...update });\n      router.replace("/(tabs)");', '      console.log("REPRO add");\n      addServer({ ...profile, ...update });\n      console.log("REPRO replace");\n      router.replace("/(tabs)");\n      console.log("REPRO replaced");')
    if v == "nophase":
        s = s.replace('      await new Promise((resolve) => setTimeout(resolve, 700));\n', '', 1).replace('      await new Promise((resolve) => setTimeout(resolve, 500));\n', '', 1)
        s = s.replace('      console.log("REPRO account");\n      setProgress({', '      console.log("REPRO account");\n      if (0) setProgress({', 1)
        s = s.replace('      console.log("REPRO catalog");\n      setProgress(', '      console.log("REPRO catalog");\n      if (0) setProgress(', 1)
    p.write_text(s); print(v, s.count("REPRO"))

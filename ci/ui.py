import re, subprocess, sys, time
def dump():
    subprocess.run(["adb","shell","uiautomator","dump","/sdcard/ui.xml"],capture_output=True)
    return subprocess.run(["adb","shell","cat","/sdcard/ui.xml"],capture_output=True,text=True).stdout
def find(label, xml):
    for m in re.finditer(r'<node [^>]*>', xml):
        n=m.group(0)
        t=re.search(r' text="([^"]*)"',n).group(1); d=re.search(r'content-desc="([^"]*)"',n).group(1)
        if label in (t,d) or (label.endswith("*") and (t.startswith(label[:-1]) or d.startswith(label[:-1]))):
            b=list(map(int,re.findall(r'\d+',re.search(r'bounds="([^"]*)"',n).group(1))))
            return ((b[0]+b[2])//2,(b[1]+b[3])//2)
    return None
def tap(label, timeout=40):
    end=time.time()+timeout
    while time.time()<end:
        xml=dump(); p=find(label,xml)
        if p:
            subprocess.run(["adb","shell","input","tap",str(p[0]),str(p[1])]); print("tapped",label,p,flush=True); return True
        time.sleep(2)
    print("NOT FOUND",label,flush=True); print(re.findall(r'(?:text|content-desc)="([^"]+)"',dump())[:60]); return False
cmd=sys.argv[1]
if cmd=="tap": sys.exit(0 if tap(sys.argv[2]) else 1)
if cmd=="type":
    subprocess.run(["adb","shell","input","text",sys.argv[2]])
if cmd=="labels": print(re.findall(r'(?:text|content-desc)="([^"]+)"',dump()))
if cmd=="focused":
    xml=dump()
    import re as _r
    i=xml.find('focused="true"')
    if i<0: print("FOCUSED: none"); sys.exit(0)
    s=xml.rfind("<node",0,i); seg=xml[s:s+3000]
    print("FOCUSED:", _r.findall(r'(?:text|content-desc|class|bounds)="([^"]+)"',seg)[:14], flush=True)

# labels_agent.py
# Mini serveur local pour exposer les PSD via une API JSON
# Usage: py labels_agent.py --root "C:\chemin\vers\Products" --port 4517 --token SECRET123

import argparse, os, re, time
from flask import Flask, request, jsonify, send_file, abort
from waitress import serve

app = Flask(__name__)
ROOT = ""
TOKEN = ""
MAX_DEPTH_DEFAULT = 6

def is_psd(name: str) -> bool:
    name_l = name.lower()
    return name_l.endswith(".psd") and (name_l.startswith("pslabel_") or name_l.startswith("psboxlabel_"))

def ref_from_filename(name: str):
    m = re.match(r'^(?:psbox)?label_([A-Za-z0-9]+)\.psd$', name, re.IGNORECASE)
    return m.group(1).upper() if m else None

def ref_from_dirname(dirname: str):
    m = re.match(r'^([A-Za-z0-9]+)\s*-\s*', dirname)
    return m.group(1).upper() if m else None

def detect_type(name: str):
    return "box" if name.lower().startswith("psboxlabel_") else "sachet"

def _check_token():
    t = request.args.get("token", "") or request.headers.get("X-Agent-Token", "")
    return (TOKEN and t == TOKEN)

@app.get("/status")
def status():
    if not _check_token(): return jsonify(ok=False, error="invalid token"), 403
    return jsonify(ok=True, root=ROOT, time=int(time.time()))

@app.get("/list")
def list_files():
    if not _check_token(): return jsonify(ok=False, error="invalid token"), 403
    try:
        depth = int(request.args.get("depth", MAX_DEPTH_DEFAULT))
    except Exception:
        depth = MAX_DEPTH_DEFAULT

    files = []
    root_abspath = os.path.abspath(ROOT)
    for cur, dirs, fnames in os.walk(root_abspath):
        rel = os.path.relpath(cur, root_abspath)
        level = 0 if rel == "." else rel.count(os.sep) + 1
        if level > depth:
            dirs[:] = []
            continue

        base_dirname = os.path.basename(cur)
        for fn in fnames:
            if not is_psd(fn): continue
            fpath = os.path.join(cur, fn)
            try:
                st = os.stat(fpath)
            except OSError:
                continue
            ref = ref_from_filename(fn) or ref_from_dirname(base_dirname)
            files.append({
                "path": fpath,
                "name": fn,
                "type": detect_type(fn),
                "ref": ref,
                "mtime": int(st.st_mtime),
                "dir": cur,
            })
    return jsonify(ok=True, count=len(files), files=files)

@app.get("/download")
def download():
    if not _check_token(): return jsonify(ok=False, error="invalid token"), 403
    p = request.args.get("path")
    if not p: return abort(400)
    p = os.path.abspath(p)
    if not p.startswith(os.path.abspath(ROOT)): return abort(403)
    if not os.path.isfile(p): return abort(404)
    return send_file(p, as_attachment=True)

def main():
    global ROOT, TOKEN
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="Dossier racine (ex: C:\\Users\\…\\Products)")
    ap.add_argument("--port", type=int, default=4517)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--token", required=True, help="Secret partagé avec PrestaShop")
    args = ap.parse_args()
    ROOT = args.root
    TOKEN = args.token
    print(f"[labels-agent] root={ROOT}  port={args.port}  host={args.host}")
    serve(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()

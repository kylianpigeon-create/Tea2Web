require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 5174);
const PS_EXE = process.env.PHOTOSHOP_EXE;

// --- Multer en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
});

// --- Utils
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

const BASE_JOBS = path.join(__dirname, "jobs");
if (!fs.existsSync(BASE_JOBS)) fs.mkdirSync(BASE_JOBS, { recursive: true });
function tempDir(prefix = "tea2_") {
  return fs.mkdtempSync(path.join(BASE_JOBS, prefix));
}

// --- JSX generator (copie/colle le tien ici inchangé si besoin) ---
function makeJsxUpdateTextOnly(opts) {
  const {
    psdPath,
    outDir,
    outName,
    info_poids = "",
    info_ddm = "",
    info_nlot = "",
    info_adresse = "",
    jpegQuality = 12,
  } = opts;

  return `#target photoshop
app.bringToFront();
var _psdPath = File(${JSON.stringify(psdPath)});
var _outDir  = Folder(${JSON.stringify(outDir)});
var _outName = ${JSON.stringify(outName)};
var _jpgQ    = ${typeof jpegQuality === "number" ? jpegQuality : 12};

var INFO_POIDS = ${JSON.stringify(info_poids)};
var INFO_DDM   = ${JSON.stringify(info_ddm)};
var INFO_NLOT  = ${JSON.stringify(info_nlot)};
var INFO_ADDR  = ${JSON.stringify(info_adresse)};

var PATH_POIDS = ["CHANVRE","COMMUN","INFOS","POIDS"];
var PATH_DDM   = ["CHANVRE","COMMUN","INFOS","DDM"];
var PATH_NLOT  = ["CHANVRE","COMMUN","INFOS","NLOT"];
var PATH_ADDR  = ["CHANVRE","COMMUN","ADRESSE","ADRESSE"];

function findByPath(root, parts){
  var ctx=root;
  for (var i=0;i<parts.length;i++){
    var p=parts[i], next=null;
    for (var j=0;j<ctx.layers.length;j++){ var L=ctx.layers[j]; if (L.name===p){ next=L; break; } }
    if (!next) return null;
    ctx=next;
  }
  return ctx;
}
function deepFindFirst(root, leafName){
  if (root.name===leafName) return root;
  for (var i=0;i<root.layers.length;i++){
    var L=root.layers[i];
    if (L.name===leafName) return L;
    if (L.typename==="LayerSet"){ var r=deepFindFirst(L, leafName); if (r) return r; }
  }
  return null;
}
function resolveTextLayer(node, preferredName){
  if (!node) return null;
  if (node.typename==="ArtLayer" && node.kind===LayerKind.TEXT) return node;
  if (node.typename==="LayerSet"){
    for (var i=0;i<node.layers.length;i++){
      var L=node.layers[i];
      if (L.typename==="ArtLayer" && L.kind===LayerKind.TEXT && (!preferredName || L.name===preferredName)) return L;
    }
    for (var j=0;j<node.layers.length;j++){
      var C=node.layers[j];
      var got = resolveTextLayer(C, preferredName);
      if (got) return got;
    }
  }
  return null;
}
var _log=[]; function log(s){ _log.push(String(s)); }
function flushLog(){
  try{ var f=File(_outDir.fsName+"/report.txt"); f.open("w"); f.write(_log.join("\\n")); f.close(); }catch(e){}
}
function updateInfoValue(layerPathArray, leafName, newValue) {
  if (!newValue) { log("Skip "+leafName+" (vide)"); return; }
  var node = findByPath(app.activeDocument, layerPathArray);
  if (!node) { log("Chemin "+leafName+" introuvable → recherche profonde"); node = deepFindFirst(app.activeDocument, leafName); }
  if (!node){ log("❌ "+leafName+" introuvable"); return; }
  var target = resolveTextLayer(node, leafName);
  if (!target){ log("❌ "+leafName+" : aucun calque texte trouvé"); return; }
  try { target.allLocked = false; } catch(e){}
  target.visible = true;
  var t = target.textItem.contents || "";
  var idx = t.lastIndexOf(":");
  if (idx === -1) {
    target.textItem.contents = newValue;
    log("✔ "+leafName+" (remplacement total)");
    return;
  }
  var prefix = t.substring(0, idx + 1);
  var after = t.substring(idx + 1);
  var sep = (after.length && (after[0] === " " || after.charCodeAt(0)===160)) ? after[0] : " ";
  target.textItem.contents = prefix + sep + newValue;
  log("✔ "+leafName+" mis à jour");
}
function updateAddress(layerPathArray, leafName, newText) {
  if (!newText) { log("Skip "+leafName+" (vide)"); return; }
  var node = findByPath(app.activeDocument, layerPathArray);
  if (!node) { log("Chemin "+leafName+" introuvable → recherche profonde"); node = deepFindFirst(app.activeDocument, leafName); }
  if (!node){ log("❌ "+leafName+" introuvable"); return; }
  var target = resolveTextLayer(node, leafName);
  if (!target){ log("❌ "+leafName+" : aucun calque texte trouvé"); return; }
  try { target.allLocked = false; } catch(e){}
  target.visible = true;
  var txt = String(newText).replace(/\\r\\n|\\n/g, "\\r");
  target.textItem.contents = txt;
  log("✔ "+leafName+" (adresse) mise à jour");
}
function exportJpegOverwrite(srcDoc, folder, baseName, quality){
  if (!folder.exists) folder.create();
  var outFile = File(folder.fsName + "/" + baseName + ".jpg");
  if (outFile.exists) { try { outFile.remove(); } catch(e) {} }
  var dup = srcDoc.duplicate();
  try { dup.convertProfile("sRGB IEC61966-2.1", Intent.PERCEPTUAL, true, true); } catch(e) {}
  dup.flatten();
  var opts = new JPEGSaveOptions();
  opts.quality = Math.max(0, Math.min(12, quality||12));
  dup.saveAs(outFile, opts, true);
  dup.close(SaveOptions.DONOTSAVECHANGES);
  return outFile;
}
function run(){
  var doc = app.open(_psdPath);
  updateInfoValue(["CHANVRE","COMMUN","INFOS","POIDS"], "POIDS", INFO_POIDS);
  updateInfoValue(["CHANVRE","COMMUN","INFOS","DDM"],   "DDM",   INFO_DDM);
  updateInfoValue(["CHANVRE","COMMUN","INFOS","NLOT"],  "NLOT",  INFO_NLOT);
  updateAddress(["CHANVRE","COMMUN","ADRESSE","ADRESSE"], "ADRESSE", INFO_ADDR);
  var outJpg = exportJpegOverwrite(doc, _outDir, _outName + "_export", _jpgQ);
  log("✔ JPG exporté : " + outJpg.fsName);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  flushLog();
}
try{
  app.preferences.rulerUnits = Units.PIXELS;
  run();
}catch(e){
  var errf = File(_outDir.fsName + "/error.txt"); errf.open("w"); errf.write(e.message); errf.close();
}finally{
  var done = File(_outDir.fsName + "/done.txt"); done.open("w"); done.write("ok"); done.close();
}
`;
}

// --- Lance Photoshop avec -r <jsx> et attend done.txt
function runPhotoshopJsx(jsxPath, doneFile, timeoutMs = 10 * 60 * 1000) {
  if (!PS_EXE || !fs.existsSync(PS_EXE)) {
    throw new Error("PHOTOSHOP_EXE non défini/invalid dans .env");
  }
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
    } catch {}
    const proc = spawn(`"${PS_EXE}"`, ["-r", jsxPath], {
      shell: true,
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      reject(new Error("Timeout Photoshop"));
    }, timeoutMs);
    const poll = setInterval(() => {
      if (fs.existsSync(doneFile)) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve();
      }
    }, 1000);
    proc.on("error", (e) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(e);
    });
    // Optionnel : log si Photoshop écrit quelque chose
    proc.stdout && proc.stdout.on("data", (d) => process.stdout.write(d));
    proc.stderr && proc.stderr.on("data", (d) => process.stderr.write(d));
  });
}

// --- Routes
app.get("/", (_req, res) =>
  res.type("text/plain").send("API OK — /api/process (texte seul)")
);

app.get("/api/test-jpg", (_req, res) => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Disposition", 'attachment; filename="test.jpg"');
  res.send(jpg);
});

app.post("/api/process", upload.single("single_psd"), async (req, res) => {
  try {
    const psdFile = req.file;
    if (!psdFile) return res.status(400).send("PSD manquant.");

    const {
      info_poids = "",
      info_ddm = "",
      info_nlot = "",
      info_adresse = "",
    } = req.body;

    const job = tempDir("tea2_text_");
    const inPsd = path.join(
      job,
      psdFile.originalname.replace(/[\\/:*?"<>|]+/g, "_")
    );
    fs.writeFileSync(inPsd, psdFile.buffer);

    const outDir = path.join(job, "out");
    ensureDir(outDir);
    const outName = path.basename(inPsd, path.extname(inPsd)) + "_modifie";

    const jsxPath = path.join(job, "update_text.jsx");
    const doneFile = path.join(outDir, "done.txt");

    fs.writeFileSync(
      jsxPath,
      makeJsxUpdateTextOnly({
        psdPath: inPsd,
        outDir,
        outName,
        info_poids,
        info_ddm,
        info_nlot,
        info_adresse,
        jpegQuality: 12,
      }),
      "utf8"
    );

    await runPhotoshopJsx(jsxPath, doneFile);

    const errFile = path.join(outDir, "error.txt");
    if (fs.existsSync(errFile)) {
      return res.status(500).send(fs.readFileSync(errFile, "utf8"));
    }

    const outJpg = path.join(outDir, outName + "_export.jpg");
    if (!fs.existsSync(outJpg))
      return res.status(500).send("Fichier JPG exporté introuvable.");
    const buf = fs.readFileSync(outJpg);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(outJpg)}"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).send(e?.message || "Erreur serveur");
  }
});

// --- Un SEUL listen
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur prêt : http://0.0.0.0:${PORT}`);
  if (!PS_EXE) {
    console.warn("⚠️ PHOTOSHOP_EXE manquant dans .env");
  } else {
    console.log("Photoshop:", PS_EXE);
  }
});

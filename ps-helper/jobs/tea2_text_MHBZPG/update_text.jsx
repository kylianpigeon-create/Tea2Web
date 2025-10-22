#target photoshop
app.bringToFront();
var _psdPath = File("C:\\ps-helper\\jobs\\tea2_text_MHBZPG\\PROD_58_20251022_115902.psd");
var _outDir  = Folder("C:\\ps-helper\\jobs\\tea2_text_MHBZPG\\out");
var _outName = "PROD_58_20251022_115902_modifie";
var _jpgQ    = 12;

var INFO_POIDS = "100g";
var INFO_DDM   = "22/10/2027";
var INFO_NLOT  = "WO22102025";
var INFO_ADDR  = "";

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
  try{ var f=File(_outDir.fsName+"/report.txt"); f.open("w"); f.write(_log.join("\n")); f.close(); }catch(e){}
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
  var txt = String(newText).replace(/\r\n|\n/g, "\r");
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

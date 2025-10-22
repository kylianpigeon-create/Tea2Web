#target photoshop

function exportJPEG(doc, outFile, quality) {
  var opts = new JPEGSaveOptions();
  opts.quality = quality || 10;
  opts.embedColorProfile = true;
  opts.matte = MatteType.NONE;
  doc.flatten();
  doc.saveAs(new File(outFile), opts, true);
}

function setTextIfExists(doc, layerName, value) {
  if (!value) return;
  var found = null;
  try {
    // cherche par nom exact dans tout le document
    function walk(lyrSet) {
      for (var i=0; i<lyrSet.layers.length; i++) {
        var L = lyrSet.layers[i];
        if (L.typename === "ArtLayer" && L.kind === LayerKind.TEXT) {
          if (L.name === layerName) { found = L; return; }
        } else if (L.typename === "LayerSet") {
          if (L.name === layerName && L.layers.length > 0) {
            // si le groupe porte le nom, on prend le 1er calque texte dedans
            for (var j=0; j<L.layers.length; j++) {
              var C = L.layers[j];
              if (C.typename === "ArtLayer" && C.kind === LayerKind.TEXT) { found = C; return; }
            }
          }
          walk(L);
        }
        if (found) return;
      }
    }
    walk(doc);
    if (found) {
      found.textItem.contents = value;
    }
  } catch (e) {}
}

(function () {
  // ⬇️ Ces variables sont injectées par Node au moment du lancement
  var PSD_PATH    = "%PSD_PATH%";
  var OUT_JPG     = "%OUT_JPG%";
  var INFO_POIDS  = "%INFO_POIDS%";
  var INFO_DDM    = "%INFO_DDM%";
  var INFO_LOT    = "%INFO_LOT%";
  var INFO_ADR    = "%INFO_ADR%";

  // ouvre le PSD
  var f = new File(PSD_PATH);
  if (!f.exists) { throw new Error("PSD introuvable: " + PSD_PATH); }
  var doc = app.open(f);

  // Remplissage des calques texte (noms fixes à adapter à votre PSD)
  setTextIfExists(doc, "poids", INFO_POIDS);
  if (INFO_DDM) setTextIfExists(doc, "ddm", "DDM : " + INFO_DDM);
  if (INFO_LOT) setTextIfExists(doc, "lot", "LOT : " + INFO_LOT);
  setTextIfExists(doc, "adresse", INFO_ADR);

  // export JPEG
  exportJPEG(doc, OUT_JPG, 10);

  // ferme sans sauvegarder le PSD d'origine
  doc.close(SaveOptions.DONOTSAVECHANGES);
})();

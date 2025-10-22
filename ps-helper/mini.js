const express = require("express");
const app = express();
const PORT = 5174;
app.get("/", (_req, res) => res.type("text/plain").send("MINI OK"));
app.listen(PORT, "0.0.0.0", () => console.log("Mini prêt:", PORT));

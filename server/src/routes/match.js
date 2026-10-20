/**
 * routes/match.js
 * --------------------------------------------------
 * GET /match/:id[?league=esp.1] -> detalle de un partido específico.
 * Con ?league= se consulta directamente esa competición (recomendado);
 * sin él se intenta localizarla.
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");
const { buildMeta } = require("./meta");

router.get("/match/:id", async (req, res, next) => {
  try {
    const result = await espnService.getMatchByIdDetailed(req.params.id, req.query.league || null);
    res.json({ success: true, data: result.data, meta: buildMeta(res, { ...result, data: [result.data] }) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

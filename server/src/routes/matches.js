/**
 * routes/matches.js
 * --------------------------------------------------
 * GET /matches?league=eng.1&date=YYYYMMDD            -> partidos de una liga (o todas) en un día
 * GET /matches?league=eng.1&from=YYYYMMDD&to=YYYYMMDD -> partidos en un RANGO de fechas
 * GET /live                                           -> partidos en vivo de todas las ligas
 *
 * Respuesta: { success, count, league, date, data, meta }.
 * `meta` es aditivo (ver routes/meta.js). Errores: { success:false, error, code }.
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");
const { ApiError } = require("../utils/errors");
const { buildMeta } = require("./meta");

router.get("/matches", async (req, res, next) => {
  try {
    const { league, date, from, to } = req.query;

    if ((from && !to) || (!from && to)) {
      throw new ApiError("Se requieren ambos parámetros 'from' y 'to' (YYYYMMDD)", 400, {
        code: "invalid_date_range"
      });
    }

    let result;
    if (from && to) {
      result = league
        ? await espnService.getScoreboardRangeDetailed(league, from, to)
        : await espnService.getAllMatchesRangeDetailed(from, to);
    } else {
      result = league
        ? await espnService.getScoreboardDetailed(league, date)
        : await espnService.getAllMatchesDetailed(date);
    }

    res.json({
      success: true,
      count: result.data.length,
      league: league || "all",
      date: date || (from && to ? `${from}-${to}` : "today"),
      data: result.data,
      meta: buildMeta(res, result)
    });
  } catch (err) {
    next(err);
  }
});

router.get("/live", async (req, res, next) => {
  try {
    const result = await espnService.getLiveMatchesDetailed();
    res.json({
      success: true,
      count: result.data.length,
      data: result.data,
      meta: buildMeta(res, result)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

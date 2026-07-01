/**
 * routes/matches.js
 * --------------------------------------------------
 * GET /matches?league=eng.1&date=YYYYMMDD            -> partidos de una liga (o todas) en un día
 * GET /matches?league=eng.1&from=YYYYMMDD&to=YYYYMMDD -> partidos en un RANGO de fechas
 *                                                        (histórico + futuro combinados)
 * GET /live                                           -> partidos en vivo de todas las ligas
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");

// GET /matches
// Query params opcionales:
//   league=eng.1   -> filtra por una competición específica (ver /competitions)
//   date=20260630  -> filtra por fecha exacta (formato YYYYMMDD, como lo espera ESPN)
//   from=YYYYMMDD / to=YYYYMMDD -> rango de fechas (recomendado para historial + próximos)
router.get("/matches", async (req, res, next) => {
  try {
    const { league, date, from, to } = req.query;

    let matches;
    if (from && to) {
      matches = league
        ? await espnService.getScoreboardRange(league, from, to)
        : await espnService.getAllMatchesRange(from, to);
    } else {
      matches = league
        ? await espnService.getScoreboard(league, date)
        : await espnService.getAllMatches(date);
    }

    res.json({
      success: true,
      count: matches.length,
      league: league || "all",
      date: date || (from && to ? `${from}-${to}` : "today"),
      data: matches
    });
  } catch (err) {
    next(err);
  }
});

// GET /live
router.get("/live", async (req, res, next) => {
  try {
    const live = await espnService.getLiveMatches();
    res.json({
      success: true,
      count: live.length,
      data: live
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

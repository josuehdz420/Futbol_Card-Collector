/**
 * routes/standings.js
 * --------------------------------------------------
 * GET /standings?league=eng.1 -> tabla de posiciones de una liga
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");
const { DEFAULT_LEAGUE } = require("../config/competitions");
const { buildMeta } = require("./meta");

router.get("/standings", async (req, res, next) => {
  try {
    const league = req.query.league || DEFAULT_LEAGUE;
    const result = await espnService.getStandingsDetailed(league);
    res.json({
      success: true,
      league,
      count: result.data.length,
      data: result.data,
      meta: buildMeta(res, result)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

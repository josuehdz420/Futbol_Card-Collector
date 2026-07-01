/**
 * routes/competitions.js
 * --------------------------------------------------
 * GET /competitions -> lista de competiciones/ligas soportadas por la API
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");

router.get("/competitions", (req, res) => {
  const competitions = espnService.getCompetitions();
  res.json({
    success: true,
    count: competitions.length,
    data: competitions
  });
});

module.exports = router;

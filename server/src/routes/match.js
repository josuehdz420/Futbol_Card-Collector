/**
 * routes/match.js
 * --------------------------------------------------
 * GET /match/:id -> detalle de un partido específico
 */

const express = require("express");
const router = express.Router();
const espnService = require("../services/espnService");

router.get("/match/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const match = await espnService.getMatchById(id);
    res.json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

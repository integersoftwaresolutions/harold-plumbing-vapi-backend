'use strict';

const spamService = require('../services/spamService');
const { logSpamSchema, parseOrThrow } = require('../utils/validation');

async function logSpam(req, res) {
  const data = parseOrThrow(logSpamSchema, req.body);
  const result = await spamService.logSpam(data);
  res.status(200).json(result);
}

module.exports = {
  logSpam,
};

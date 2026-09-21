'use strict';

const { getDatabaseStatus } = require('../config/database');

function health(req, res) {
  const dbStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    service: 'harolds-plumbing-vapi-backend',
    status: 'ok',
    mongodb: dbStatus,
  });
}

module.exports = {
  health,
};

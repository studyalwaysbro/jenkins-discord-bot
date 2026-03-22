// logger.js — Structured logging for Jenkins via Pino
// Phase 1 of v3.0: instrument everything first, then build on top.

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'jenkins' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

// Wrap .child() so callers can pass a string shorthand:
//   require('./logger').child('Voice')  →  pino.child({ module: 'Voice' })
const originalChild = logger.child.bind(logger);
logger.child = function (arg) {
  if (typeof arg === 'string') return originalChild({ module: arg });
  return originalChild(arg);
};

module.exports = logger;

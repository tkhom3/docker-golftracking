const requests = {};

/**
 * Simple in-memory rate limiter
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Max requests per window
 */
function createRateLimiter(windowMs, max) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requests[ip]) {
      requests[ip] = [];
    }

    // Remove old requests outside the window
    requests[ip] = requests[ip].filter(time => now - time < windowMs);

    if (requests[ip].length >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    requests[ip].push(now);
    next();
  };
}

module.exports = createRateLimiter;

// inputSanitizers.js (or utils.js)
function validateReviewInput(req, res, next) {
  const allowedPattern = /^[A-Za-z0-9 ]+$/;
  const { review } = req.body;

  if (typeof review !== 'string' || !allowedPattern.test(review)) {
    return res.status(400).json({
      error: "Review contains invalid characters. Only letters, numbers, and spaces are allowed.",
    });
  }

  req.body.review = review.trim();
  next();
}

function sanitizeOutput(str) {
  if (typeof str !== 'string') return str;

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  validateReviewInput,
  sanitizeOutput
};

function requireAuth(req, res, next) {
    if (req.session.user) {
        req.userid = req.session.user.userid;
        req.type = req.session.user.type;
        next();
    } else {
        res.status(401).json({ message: 'Authentication required. Please log in.' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.type.toLowerCase() === 'admin') {
        req.userid = req.session.user.userid;
        req.type = req.session.user.type;
        next();
    } else {
        res.status(403).json({ message: 'Admin access required.' });
    }
}

module.exports = { requireAuth, requireAdmin };
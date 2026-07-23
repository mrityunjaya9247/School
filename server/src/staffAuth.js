// This project has no real backend auth today — the frontend's whole "sess"
// concept is a client-side-only object (see index.html's own
// "Firestore only — NO AUTH" comment), never a verified token. So this is
// NOT cryptographic verification; it mirrors the exact same trust level the
// rest of the app already runs on (trusting the client's claimed role),
// applied consistently to this one new endpoint rather than inventing a
// stronger auth model unprompted. Upgrade path if you want real
// server-verified auth later: check req.body.staffId against the school's
// `staff` collection via the Firebase Admin SDK before calling next().
'use strict';

function requireStaff(req, res, next) {
  const { staffId, role, code } = req.body || {};
  if (!staffId || !code || (role !== 'teacher' && role !== 'principal')) {
    return res.status(401).json({ error: 'Sign in as a teacher or principal to use this feature.' });
  }
  req.staff = { staffId, role, code };
  next();
}

module.exports = { requireStaff };

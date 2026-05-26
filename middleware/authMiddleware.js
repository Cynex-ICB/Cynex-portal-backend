import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ message: "Not authorized. Token missing." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Not authorized. User not found." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized. Token invalid." });
  }
}

function adminOnly(req, res, next) {
  if (!["admin", "master-admin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
}

function masterAdminOnly(req, res, next) {
  if (req.user?.role !== "master-admin") {
    return res.status(403).json({ message: "Master admin access required." });
  }

  next();
}

export { adminOnly, masterAdminOnly };
export default protect;

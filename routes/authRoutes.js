import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";
import { buildPasswordResetEmail } from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
const PASSWORD_RESET_EXPIRY_MS = 5 * 60 * 1000;

function parseEmailList(value = "") {
  return value
    .split(/[,;\s]+/)
    .map((email) => email.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .filter(Boolean);
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
const masterAdminEmails = parseEmailList(process.env.MASTER_ADMIN_EMAILS || process.env.HOD_EMAILS);

function getAdminEmails() {
  return adminEmails;
}

function getMasterAdminEmails() {
  return masterAdminEmails;
}

function getRoleForEmail(email) {
  if (getMasterAdminEmails().includes(email)) {
    return "master-admin";
  }

  if (getAdminEmails().includes(email)) {
    return "admin";
  }

  return "student";
}

function createToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    collegeEmail: user.collegeEmail,
    role: user.role,
    usn: user.usn || "",
    semester: user.semester || 1,
    teacherId: user.teacherId || "",
    coordinatorSemesters: user.coordinatorSemesters || [],
    mentorAssignments: user.mentorAssignments || [],
    classCoordinatorName: user.classCoordinatorName || "",
    mentorName: user.mentorName || "",
  };
}

function sendAuthResponse(res, user, statusCode = 200) {
  return res.status(statusCode).json({
    token: createToken(user._id),
    user: serializeUser(user),
  });
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getClientUrl() {
  return (process.env.CLIENT_URL || "http://cynexicb.com")
    .split(",")[0]
    .replace(/^https?:\/\/www\.cynexicb\.com/i, "http://cynexicb.com")
    .replace(/\/$/, "");
}

router.post("/email-access", async (req, res) => {
  return res.json({ allowed: true });
});

router.post("/signup", async (req, res) => {
  return res.status(410).json({ message: "Public signup is disabled. Contact the master admin for account access." });
});

router.post("/verify-signup", async (req, res) => {
  return res.status(410).json({ message: "Public signup is disabled. Contact the master admin for account access." });
});

router.post("/login", async (req, res) => {
  try {
    const { collegeEmail, password } = req.body;

    if (!collegeEmail || !password) {
      return res.status(400).json({ message: "College email and password are required." });
    }

    const normalizedEmail = collegeEmail.toLowerCase().trim();

    const user = await User.findOne({ collegeEmail: normalizedEmail }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid college email or password." });
    }

    const configuredRole = getRoleForEmail(user.collegeEmail);
    if (user.role !== configuredRole && configuredRole !== "student") {
      user.role = configuredRole;
      await user.save({ validateBeforeSave: false });
    }

    return sendAuthResponse(res, user);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Login failed." });
  }
});

router.get("/me", protect, (req, res) => {
  return res.json({ user: serializeUser(req.user) });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { collegeEmail } = req.body;
    const user = await User.findOne({ collegeEmail: collegeEmail?.toLowerCase().trim() }).select(
      "+passwordResetToken +passwordResetExpires"
    );

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = hashValue(resetToken);

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = Date.now() + PASSWORD_RESET_EXPIRY_MS;
      await user.save({ validateBeforeSave: false });

      const clientUrl = getClientUrl();
      const resetUrl = `${clientUrl}/reset?resetToken=${resetToken}`;

      await sendEmail({
        to: user.collegeEmail,
        ...buildPasswordResetEmail({ name: user.name, resetUrl }),
      });
    }

    return res.json({
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not send reset link." });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const hashedToken = hashValue(req.params.token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or expired." });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return sendAuthResponse(res, user);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Password reset failed." });
  }
});

export default router;

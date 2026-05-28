import crypto from "crypto";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import SignupOtp from "../models/SignupOtp.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";
import { buildPasswordResetEmail, buildSignupOtpEmail } from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
const STUDENT_EMAIL_ID_PATTERN = /^4AL\d{2}IC0\d{2}$/i;
const PASSWORD_RESET_EXPIRY_MS = 5 * 60 * 1000;

function parseEmailList(value = "") {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAdminEmails() {
  return parseEmailList(process.env.ADMIN_EMAILS);
}

function getMasterAdminEmails() {
  return parseEmailList(process.env.MASTER_ADMIN_EMAILS || process.env.HOD_EMAILS);
}

function getEmailPatternExemptions() {
  return new Set([
    ...getAdminEmails(),
    ...getMasterAdminEmails(),
    ...parseEmailList(process.env.EMAIL_PATTERN_EXEMPT_EMAILS),
  ]);
}

function getEmailIdFromAddress(email) {
  return email.split("@")[0] || "";
}

function isEmailPatternExempt(email) {
  return getEmailPatternExemptions().has(email);
}

function hasAllowedStudentEmailId(email) {
  return STUDENT_EMAIL_ID_PATTERN.test(getEmailIdFromAddress(email));
}

function isAllowedCollegeEmail(email) {
  return isEmailPatternExempt(email) || hasAllowedStudentEmailId(email);
}

function isAdminRole(role) {
  return ["admin", "master-admin"].includes(role);
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

function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function getClientUrl() {
  return (process.env.CLIENT_URL || "https://cynexicb.com").replace(/\/$/, "");
}

router.post("/email-access", async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.collegeEmail || "").toLowerCase().trim();

    if (!normalizedEmail) {
      return res.json({ allowed: false });
    }

    if (isAllowedCollegeEmail(normalizedEmail)) {
      return res.json({ allowed: true });
    }

    const adminUser = await User.findOne({
      collegeEmail: normalizedEmail,
      role: { $in: ["admin", "master-admin"] },
    }).select("_id");

    return res.json({ allowed: Boolean(adminUser) });
  } catch {
    return res.json({ allowed: false });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, collegeEmail, password, usn, semester } = req.body;

    if (!name || !collegeEmail || !password) {
      return res.status(400).json({ message: "Name, college email, and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const normalizedEmail = collegeEmail.toLowerCase().trim();

    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "College email ID must match the 4ALXXIC0XX pattern.",
      });
    }

    const role = getRoleForEmail(normalizedEmail);

    const existingUser = await User.findOne({ collegeEmail: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this college email already exists." });
    }

    const semesterNumber = parseInt(semester);

    if (role === "student" && (!usn || Number.isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8)) {
      return res.status(400).json({ message: "USN and semester are required for student signup." });
    }

    const otp = createOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pendingSignup = {
      name,
      collegeEmail: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      otpHash: hashValue(otp),
      role,
      expiresAt,
    };

    // Add student-specific fields if not admin
    if (role === "student") {
      pendingSignup.usn = usn ? usn.trim().toUpperCase() : "";
      pendingSignup.semester = semesterNumber;
    }

    await SignupOtp.findOneAndUpdate(
      { collegeEmail: normalizedEmail },
      pendingSignup,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendEmail({
      to: normalizedEmail,
      ...buildSignupOtpEmail({ name, otp }),
    });

    return res.status(200).json({
      message: "OTP sent to your college email. Enter it to complete signup.",
      requiresOtp: true,
      collegeEmail: normalizedEmail,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Signup failed." });
  }
});

router.post("/verify-signup", async (req, res) => {
  try {
    const { collegeEmail, otp } = req.body;

    if (!collegeEmail || !otp) {
      return res.status(400).json({ message: "College email and OTP are required." });
    }

    const normalizedEmail = collegeEmail.toLowerCase().trim();

    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "College email ID must match the 4ALXXIC0XX pattern.",
      });
    }

    const pendingSignup = await SignupOtp.findOne({ collegeEmail: normalizedEmail });

    if (!pendingSignup || pendingSignup.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP is invalid or expired. Please signup again." });
    }

    if (pendingSignup.otpHash !== hashValue(String(otp).trim())) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const existingUser = await User.findOne({ collegeEmail: normalizedEmail });
    if (existingUser) {
      await pendingSignup.deleteOne();
      return res.status(409).json({ message: "An account with this college email already exists." });
    }

    const user = await User.create({
      name: pendingSignup.name,
      collegeEmail: pendingSignup.collegeEmail,
      password: pendingSignup.passwordHash,
      role: pendingSignup.role,
      usn: pendingSignup.usn,
      semester: pendingSignup.semester,
    });

    await pendingSignup.deleteOne();
    return sendAuthResponse(res, user, 201);
  } catch (error) {
    return res.status(500).json({ message: error.message || "OTP verification failed." });
  }
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

    if (!isAllowedCollegeEmail(normalizedEmail) && !isAdminRole(user.role)) {
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

    if (!isAllowedCollegeEmail(user.collegeEmail) && !isAdminRole(user.role)) {
      return res.status(401).json({ message: "Invalid college email or password." });
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

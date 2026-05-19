import crypto from "crypto";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import SignupOtp from "../models/SignupOtp.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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

function isDepartmentStudentEmail(email) {
  return /^4al\d{2}ic\d{3}@aiet\.org\.in$/i.test(email);
}

router.post("/signup", async (req, res) => {
  try {
    const { name, collegeEmail, password, usn, semester } = req.body;

    if (!name || !collegeEmail || !password) {
      return res.status(400).json({ message: "Name, college email, and password are required." });
    }

    if (!isDepartmentStudentEmail(collegeEmail)) {
      return res.status(400).json({ 
        message: "Use your department email format: 4ALxxICxxx@aiet.org.in." 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const normalizedEmail = collegeEmail.toLowerCase().trim();
    const existingUser = await User.findOne({ collegeEmail: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this college email already exists." });
    }

    const role = getAdminEmails().includes(normalizedEmail) ? "admin" : "student";
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
      subject: "Verify your CSE (ICB) portal account",
      text: `Your verification OTP is ${otp}. It expires in 10 minutes.`,
      html: `
        <p>Hello ${name},</p>
        <p>Your verification OTP is:</p>
        <h2>${otp}</h2>
        <p>This OTP expires in 10 minutes.</p>
      `,
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

    const user = await User.findOne({ collegeEmail: collegeEmail.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid college email or password." });
    }

    if (user.role !== "admin" && getAdminEmails().includes(user.collegeEmail)) {
      user.role = "admin";
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
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const resetUrl = `${clientUrl}/reset?resetToken=${resetToken}`;

      await sendEmail({
        to: user.collegeEmail,
        subject: "Reset your CSE (ICB) portal password",
        text: `Use this link to reset your password: ${resetUrl}`,
        html: `
          <p>Hello ${user.name},</p>
          <p>Use the link below to reset your password. It expires in 1 hour.</p>
          <p><a href="${resetUrl}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
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

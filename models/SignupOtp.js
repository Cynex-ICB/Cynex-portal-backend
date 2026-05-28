import mongoose from "mongoose";

const signupOtpSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    collegeEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    usn: {
      type: String,
      trim: true,
      default: "",
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
      default: 1,
    },
    role: {
      type: String,
      enum: ["student", "admin", "master-admin"],
      default: "student",
    },
    passwordHash: {
      type: String,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

const SignupOtp = mongoose.model("SignupOtp", signupOtpSchema);

export default SignupOtp;

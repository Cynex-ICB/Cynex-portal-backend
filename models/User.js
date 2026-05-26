import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
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
    teacherId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    coordinatorSemesters: {
      type: [Number],
      default: [],
    },
    classCoordinatorName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    classCoordinatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    mentorName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    mentorAssignments: {
      type: [
        {
          startUsn: {
            type: String,
            trim: true,
            uppercase: true,
          },
          endUsn: {
            type: String,
            trim: true,
            uppercase: true,
          },
          assignedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["student", "admin", "master-admin"],
      default: "student",
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function matchPassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;

import mongoose from "mongoose";

const aptitudeAttemptSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AptitudeAssessment",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    extraTimeMinutes: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
      index: true,
    },
  },
  { timestamps: true }
);

const AptitudeAttempt = mongoose.model("AptitudeAttempt", aptitudeAttemptSchema);

export default AptitudeAttempt;

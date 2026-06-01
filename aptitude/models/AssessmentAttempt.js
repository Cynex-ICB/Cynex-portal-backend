import mongoose from "mongoose";

const assessmentAttemptSchema = new mongoose.Schema(
  {
    assessment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    started_at: { type: Date, default: Date.now },
    submitted_at: { type: Date, default: null },
    extra_time_minutes: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const AssessmentAttempt = mongoose.model("AssessmentAttempt", assessmentAttemptSchema);
export default AssessmentAttempt;

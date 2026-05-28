import mongoose from "mongoose";

const aptitudeAssessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    concept: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      required: true,
    },
    durationMinutes: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 0, default: 0 },
    passingMarks: { type: Number, required: true, min: 0 },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const AptitudeAssessment = mongoose.model("AptitudeAssessment", aptitudeAssessmentSchema);

export default AptitudeAssessment;

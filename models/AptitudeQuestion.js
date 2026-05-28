import mongoose from "mongoose";

const aptitudeQuestionSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AptitudeAssessment",
      required: true,
      index: true,
    },
    questionText: { type: String, required: true, trim: true },
    optionA: { type: String, required: true, trim: true },
    optionB: { type: String, required: true, trim: true },
    optionC: { type: String, required: true, trim: true },
    optionD: { type: String, required: true, trim: true },
    correctOption: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true,
    },
    explanation: { type: String, required: true, trim: true },
    shortcut: { type: String, default: "" },
    concept: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      required: true,
    },
    marks: { type: Number, required: true, min: 0 },
    negativeMarks: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

const AptitudeQuestion = mongoose.model("AptitudeQuestion", aptitudeQuestionSchema);

export default AptitudeQuestion;

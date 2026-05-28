import mongoose from "mongoose";

const aptitudeAnswerSchema = new mongoose.Schema(
  {
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AptitudeAttempt",
      required: true,
      index: true,
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AptitudeQuestion",
      required: true,
      index: true,
    },
    selectedOption: {
      type: String,
      enum: ["A", "B", "C", "D", null],
      default: null,
    },
    isCorrect: { type: Boolean, default: false },
    marksAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aptitudeAnswerSchema.index({ attempt: 1, question: 1 }, { unique: true });

const AptitudeAnswer = mongoose.model("AptitudeAnswer", aptitudeAnswerSchema);

export default AptitudeAnswer;

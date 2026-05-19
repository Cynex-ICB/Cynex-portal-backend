import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
    instructor: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure unique subject code per semester
subjectSchema.index({ code: 1, semester: 1 }, { unique: true });

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;

import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    category: {
      type: String,
      required: true,
      enum: ["assignment", "note", "study-material", "notification"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: false,
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
      required: false,
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    file: {
      originalName: {
        type: String,
        default: "",
      },
      filename: {
        type: String,
        default: "",
      },
      url: {
        type: String,
        default: "",
      },
      mimetype: {
        type: String,
        default: "",
      },
      size: {
        type: Number,
        default: 0,
      },
      path: {
        type: String,
        default: "",
      },
    },
    dueDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Material = mongoose.model("Material", materialSchema);

export default Material;

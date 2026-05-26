import mongoose from "mongoose";

const contentPostSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["achievement", "placement", "internship", "activity-alert"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1400,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    roleTitle: {
      type: String,
      trim: true,
      default: "",
      maxlength: 140,
    },
    ctcLpa: {
      type: String,
      trim: true,
      default: "",
      maxlength: 60,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
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
    link: {
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

const ContentPost = mongoose.model("ContentPost", contentPostSchema);

export default ContentPost;

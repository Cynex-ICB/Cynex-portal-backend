import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import ContentPost from "../models/ContentPost.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
const allowedTypes = new Set(["achievement", "placement", "internship", "activity-alert"]);
const uploadDir = path.join(process.cwd(), "server", "uploads", "content");
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDir);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    callback(null, `${Date.now()}-${safeBaseName || "content-image"}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedImageExtensions.has(extension) || !allowedImageTypes.has(file.mimetype)) {
      callback(new Error("Only JPG, PNG, and WEBP images are allowed."));
      return;
    }

    callback(null, true);
  },
});

function uploadContentImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "Image upload failed." });
    }

    next();
  });
}

function removeUploadedFile(filePath) {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Could not delete uploaded image:", error.message);
    }
  });
}

router.get("/", protect, async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      if (!allowedTypes.has(req.query.type)) {
        return res.status(400).json({ message: "Invalid content type." });
      }
      filter.type = req.query.type;
    }

    const posts = await ContentPost.find(filter)
      .populate("createdBy", "name collegeEmail")
      .sort({ createdAt: -1 });

    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch content." });
  }
});

router.post("/", protect, adminOnly, uploadContentImage, async (req, res) => {
  try {
    const { type, title, description, name, roleTitle, ctcLpa, link } = req.body;

    if (!allowedTypes.has(type)) {
      removeUploadedFile(req.file?.path);
      return res.status(400).json({ message: "Invalid content type." });
    }

    if (!title) {
      removeUploadedFile(req.file?.path);
      return res.status(400).json({ message: "Title is required." });
    }

    const post = await ContentPost.create({
      type,
      title,
      description: description || "",
      name: name || "",
      roleTitle: roleTitle || "",
      ctcLpa: ctcLpa || "",
      imageUrl: req.file ? `/uploads/content/${req.file.filename}` : "",
      image: req.file
        ? {
            originalName: req.file.originalname,
            filename: req.file.filename,
            url: `/uploads/content/${req.file.filename}`,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
          }
        : undefined,
      link: link || "",
      createdBy: req.user._id,
    });

    const populatedPost = await post.populate("createdBy", "name collegeEmail");
    return res.status(201).json({ post: populatedPost });
  } catch (error) {
    removeUploadedFile(req.file?.path);
    return res.status(500).json({ message: error.message || "Could not create content." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const post = await ContentPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Content not found." });
    }

    removeUploadedFile(post.image?.path);
    return res.json({ message: "Content deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete content." });
  }
});

export default router;

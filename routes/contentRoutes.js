import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import { ensureUploadDir } from "../utils/uploadStorage.js";

const router = express.Router();
const allowedTypes = new Set(["achievement", "placement", "internship", "activity-alert"]);
const uploadDir = ensureUploadDir("content");
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function serializePost(post) {
  if (!post) return null;
  const item = withMongoId(post);
  if (item.createdBy) {
    item.createdBy = withMongoId(item.createdBy);
    if (item.createdBy.collegeEmail && !item.createdBy.email) {
      item.createdBy.email = item.createdBy.collegeEmail;
    }
  }
  return item;
}

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

router.get("/", async (req, res) => {
  try {
    const where = {};

    if (req.query.type) {
      if (!allowedTypes.has(req.query.type)) {
        return res.status(400).json({ message: "Invalid content type." });
      }
      where.type = req.query.type;
    }

    const posts = await prisma.contentPost.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ posts: posts.map(serializePost) });
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

    const post = await prisma.contentPost.create({
      data: {
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
          : null,
        link: link || "",
        createdById: req.user.id || req.user._id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    return res.status(201).json({ post: serializePost(post) });
  } catch (error) {
    removeUploadedFile(req.file?.path);
    return res.status(500).json({ message: error.message || "Could not create content." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const post = await prisma.contentPost.findUnique({
      where: { id: req.params.id },
    });

    if (!post) {
      return res.status(404).json({ message: "Content not found." });
    }

    await prisma.contentPost.delete({
      where: { id: req.params.id },
    });

    if (post.image && typeof post.image === "object" && post.image.path) {
      removeUploadedFile(post.image.path);
    }
    return res.json({ message: "Content deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete content." });
  }
});

export default router;

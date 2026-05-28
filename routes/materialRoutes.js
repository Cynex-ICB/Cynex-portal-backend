import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { Readable } from "stream";
import { del, get, put } from "@vercel/blob";
import Material from "../models/Material.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import sendEmail from "../utils/sendEmail.js";
import { buildAcademicContentEmail } from "../utils/emailTemplates.js";

const router = express.Router();
const allowedExtensions = new Set([".pdf", ".ppt", ".pptx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const categoryLabels = {
  assignment: "assignment",
  note: "note",
  "study-material": "study material",
  notification: "notification",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(new Error("Only PDF, PPT, and PPTX files are allowed."));
      return;
    }

    if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Unsupported file type."));
      return;
    }

    callback(null, true);
  },
});

function uploadMaterialFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "File upload failed." });
    }

    next();
  });
}

function getSafeMaterialFilename(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  const safeBaseName = path
    .basename(originalName, extension)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${Date.now()}-${safeBaseName || "material"}${extension}`;
}

async function uploadMaterialToBlob(file) {
  if (!file) {
    return undefined;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Add your Vercel Blob read/write token to the backend environment.");
  }

  const filename = getSafeMaterialFilename(file.originalname);
  const blob = await put(`materials/${filename}`, file.buffer, {
    access: "private",
    contentType: file.mimetype,
    addRandomSuffix: true,
  });

  return {
    originalName: file.originalname,
    filename,
    url: blob.url,
    mimetype: file.mimetype,
    size: file.size,
    path: "",
    pathname: blob.pathname || "",
  };
}

function getDownloadFilename(file = {}) {
  return String(file.originalName || file.filename || "material-file").replace(/["\r\n]/g, "");
}

async function removeMaterialFile(file = {}) {
  if (file.pathname || file.url?.startsWith("http")) {
    try {
      await del(file.pathname || file.url);
    } catch (error) {
      console.error("Could not delete Vercel Blob material file:", error.message);
    }

    return;
  }

  const filePath = file.path;
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Could not delete uploaded file:", error.message);
    }
  });
}

function getClientUrl() {
  return (process.env.CLIENT_URL || "https://www.cynexicb.com").replace(/\/$/, "");
}

function chunkList(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function notifyStudentsAboutMaterial(material) {
  if (!material.semester) {
    return { notified: 0, previewOnly: false };
  }

  const students = await User.find(
    { role: "student", semester: material.semester },
    "collegeEmail"
  ).lean();
  const emails = students.map((student) => student.collegeEmail).filter(Boolean);

  if (!emails.length) {
    return { notified: 0, previewOnly: false };
  }

  const materialUrl = `${getClientUrl()}/materials`;
  const typeLabel = categoryLabels[material.category] || "update";
  const emailContent = buildAcademicContentEmail({
    title: material.title,
    category: typeLabel,
    description: material.description,
    semester: material.semester,
    subject: material.subject,
    dueDate: material.dueDate,
    link: material.link,
    hasFile: Boolean(material.file?.url),
    materialUrl,
  });

  let previewOnly = false;
  const batches = chunkList(emails, 50);

  for (const batch of batches) {
    const result = await sendEmail({
      to: process.env.EMAIL_FROM || process.env.SMTP_USER,
      bcc: batch,
      ...emailContent,
    });

    previewOnly = previewOnly || Boolean(result.previewOnly);
  }

  return { notified: emails.length, previewOnly };
}

router.get("/", protect, async (req, res) => {
  const filter = {};

  if (req.user.role !== "admin") {
    filter.semester = req.user.semester;
  } else if (req.query.semester) {
    filter.semester = parseInt(req.query.semester);
  }

  const materials = await Material.find(filter)
    .sort({ createdAt: -1 })
    .populate("subject", "code name semester instructor")
    .populate("createdBy", "name collegeEmail");

  res.json({ materials });
});

router.get("/:id/file", protect, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material?.file?.url) {
      return res.status(404).json({ message: "File not found." });
    }

    if (req.user.role === "student" && material.semester !== req.user.semester) {
      return res.status(403).json({ message: "You do not have access to this file." });
    }

    if (material.file.pathname || material.file.url?.startsWith("http")) {
      const blob = await get(material.file.pathname || material.file.url, {
        access: "private",
      });

      if (!blob?.stream) {
        return res.status(404).json({ message: "File not found in Blob storage." });
      }

      res.setHeader("Content-Type", blob.blob.contentType || material.file.mimetype || "application/octet-stream");
      if (blob.blob.size || material.file.size) {
        res.setHeader("Content-Length", String(blob.blob.size || material.file.size));
      }
      res.setHeader("Content-Disposition", `attachment; filename="${getDownloadFilename(material.file)}"`);
      return Readable.fromWeb(blob.stream).pipe(res);
    }

    return res.redirect(material.file.url);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not download file." });
  }
});

router.post("/", protect, adminOnly, uploadMaterialFile, async (req, res) => {
  let blobFile;

  try {
    const { title, category, description, link, dueDate, subject, semester } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ message: "Title, type, and description are required." });
    }

    let resolvedSemester = semester ? parseInt(semester) : undefined;

    if (subject) {
      const selectedSubject = await Subject.findById(subject);
      if (!selectedSubject) {
        return res.status(400).json({ message: "Selected subject was not found." });
      }
      resolvedSemester = selectedSubject.semester;
    }

    blobFile = await uploadMaterialToBlob(req.file);

    const material = await Material.create({
      title,
      category,
      description,
      subject: subject || undefined,
      semester: resolvedSemester,
      link,
      dueDate: dueDate || undefined,
      file: blobFile,
      createdBy: req.user._id,
    });

    const populatedMaterial = await material.populate([
      { path: "subject", select: "code name semester instructor" },
      { path: "createdBy", select: "name email" },
    ]);

    try {
      const notification = await notifyStudentsAboutMaterial(populatedMaterial);
      return res.status(201).json({ material: populatedMaterial, notification });
    } catch (emailError) {
      console.error("Material created, but notification email failed:", emailError.message);
      return res.status(201).json({
        material: populatedMaterial,
        notification: {
          notified: 0,
          error: "Post was created, but email notification failed.",
        },
      });
    }
  } catch (error) {
    await removeMaterialFile(blobFile);
    return res.status(500).json({ message: error.message || "Could not create post." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  const material = await Material.findById(req.params.id);

  if (!material) {
    return res.status(404).json({ message: "Post not found." });
  }

  await removeMaterialFile(material.file);
  await material.deleteOne();
  return res.json({ message: "Post deleted." });
});

export default router;

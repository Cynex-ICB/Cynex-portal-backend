import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import Material from "../models/Material.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "server", "uploads", "materials");
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
    callback(null, `${Date.now()}-${safeBaseName || "material"}${extension}`);
  },
});

const upload = multer({
  storage,
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

function removeUploadedFile(filePath) {
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
  const subjectLine = `New ${typeLabel} posted for Semester ${material.semester}`;
  const text = [
    `A new ${typeLabel} has been posted for Semester ${material.semester}.`,
    `Title: ${material.title}`,
    `Description: ${material.description}`,
    material.dueDate ? `Due date: ${new Date(material.dueDate).toLocaleDateString("en-IN")}` : "",
    `Open the portal: ${materialUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <p>Hello,</p>
    <p>A new <strong>${typeLabel}</strong> has been posted for Semester ${material.semester}.</p>
    <p><strong>Title:</strong> ${material.title}</p>
    <p><strong>Description:</strong> ${material.description}</p>
    ${material.dueDate ? `<p><strong>Due date:</strong> ${new Date(material.dueDate).toLocaleDateString("en-IN")}</p>` : ""}
    <p><a href="${materialUrl}">Open the portal</a></p>
  `;

  let previewOnly = false;
  const batches = chunkList(emails, 50);

  for (const batch of batches) {
    const result = await sendEmail({
      to: process.env.EMAIL_FROM || process.env.SMTP_USER,
      bcc: batch,
      subject: subjectLine,
      text,
      html,
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

router.post("/", protect, adminOnly, uploadMaterialFile, async (req, res) => {
  try {
    const { title, category, description, link, dueDate, subject, semester } = req.body;

    if (!title || !category || !description) {
      removeUploadedFile(req.file?.path);
      return res.status(400).json({ message: "Title, type, and description are required." });
    }

    let resolvedSemester = semester ? parseInt(semester) : undefined;

    if (subject) {
      const selectedSubject = await Subject.findById(subject);
      if (!selectedSubject) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({ message: "Selected subject was not found." });
      }
      resolvedSemester = selectedSubject.semester;
    }

    const material = await Material.create({
      title,
      category,
      description,
      subject: subject || undefined,
      semester: resolvedSemester,
      link,
      dueDate: dueDate || undefined,
      file: req.file
        ? {
            originalName: req.file.originalname,
            filename: req.file.filename,
            url: `/uploads/materials/${req.file.filename}`,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
          }
        : undefined,
      createdBy: req.user._id,
    });

    const populatedMaterial = await material.populate([
      { path: "subject", select: "code name semester instructor" },
      { path: "createdBy", select: "name email" },
    ]);

    try {
      const notification = await notifyStudentsAboutMaterial(material);
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
    removeUploadedFile(req.file?.path);
    return res.status(500).json({ message: error.message || "Could not create post." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  const material = await Material.findById(req.params.id);

  if (!material) {
    return res.status(404).json({ message: "Post not found." });
  }

  removeUploadedFile(material.file?.path);
  await material.deleteOne();
  return res.json({ message: "Post deleted." });
});

export default router;

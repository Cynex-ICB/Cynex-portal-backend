import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { Readable } from "stream";
import { del, get, put } from "@vercel/blob";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import { getClientUrl } from "../utils/clientUrl.js";
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

function serializeMaterial(material) {
  if (!material) return null;
  const item = withMongoId(material);
  if (item.createdBy) {
    item.createdBy = withMongoId(item.createdBy);
    if (item.createdBy.collegeEmail && !item.createdBy.email) {
      item.createdBy.email = item.createdBy.collegeEmail;
    }
  }
  if (item.subject) {
    item.subject = withMongoId(item.subject);
  }
  return item;
}

function runInBackground(label, task) {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`${label} failed:`, error.message);
      });
  });
}

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
  if (!file) return;
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

  const students = await prisma.user.findMany({
    where: { role: "student", semester: material.semester },
    select: { collegeEmail: true },
  });
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
  try {
    const where = {};

    if (req.user.role !== "admin") {
      where.semester = req.user.semester;
    } else if (req.query.semester) {
      where.semester = parseInt(req.query.semester);
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        subject: {
          select: { id: true, code: true, name: true, semester: true, instructor: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ materials: materials.map(serializeMaterial) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not fetch materials." });
  }
});

router.get("/:id/file", protect, async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
    });

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

    let resolvedSemester = semester ? parseInt(semester) : null;

    if (subject) {
      const selectedSubject = await prisma.subject.findUnique({
        where: { id: subject },
      });
      if (!selectedSubject) {
        return res.status(400).json({ message: "Selected subject was not found." });
      }
      resolvedSemester = selectedSubject.semester;
    }

    blobFile = await uploadMaterialToBlob(req.file);

    const material = await prisma.material.create({
      data: {
        title,
        category,
        description,
        subjectId: subject || null,
        semester: resolvedSemester,
        link: link || "",
        dueDate: dueDate ? new Date(dueDate) : null,
        file: blobFile || null,
        createdById: req.user.id || req.user._id,
      },
      include: {
        subject: {
          select: { id: true, code: true, name: true, semester: true, instructor: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    const serialized = serializeMaterial(material);

    runInBackground("Academic content notification", async () => {
      const notification = await notifyStudentsAboutMaterial(material);
      console.log(
        `Academic content notification queued post ${material.id}: ${notification.notified} recipient(s).`
      );
    });

    return res.status(201).json({
      material: serialized,
      notification: {
        queued: true,
        message: "Post created. Student email notification is being sent in the background.",
      },
    });
  } catch (error) {
    await removeMaterialFile(blobFile);
    return res.status(500).json({ message: error.message || "Could not create post." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
    });

    if (!material) {
      return res.status(404).json({ message: "Post not found." });
    }

    const materialFile = material.file;
    await prisma.material.delete({
      where: { id: req.params.id },
    });

    runInBackground("Material file cleanup", () => removeMaterialFile(materialFile));
    return res.json({ message: "Post deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete post." });
  }
});

export default router;

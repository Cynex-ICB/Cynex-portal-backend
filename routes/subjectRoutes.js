import express from "express";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { masterAdminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

function serializeSubject(subject) {
  if (!subject) return null;
  const item = withMongoId(subject);
  if (item.createdBy) {
    item.createdBy = withMongoId(item.createdBy);
    if (item.createdBy.collegeEmail && !item.createdBy.email) {
      item.createdBy.email = item.createdBy.collegeEmail;
    }
  }
  return item;
}

// Get all subjects (with optional filtering by semester)
router.get("/", protect, async (req, res) => {
  try {
    const { semester } = req.query;
    const where = {};

    if (semester) {
      where.semester = parseInt(semester);
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
    });

    return res.json({ subjects: subjects.map(serializeSubject) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch subjects." });
  }
});

// Get subjects for a specific semester
router.get("/semester/:semester", protect, async (req, res) => {
  try {
    const semester = parseInt(req.params.semester);

    if (isNaN(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8." });
    }

    const subjects = await prisma.subject.findMany({
      where: { semester },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: { code: "asc" },
    });

    return res.json({ subjects: subjects.map(serializeSubject) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch subjects." });
  }
});

// Get a single subject
router.get("/:id", protect, async (req, res) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({ subject: serializeSubject(subject) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch subject." });
  }
});

// Create a new subject (master admin only)
router.post("/", protect, masterAdminOnly, async (req, res) => {
  try {
    const { code, name, semester, credits, instructor, description } = req.body;

    if (!code || !name || !semester || !credits) {
      return res.status(400).json({
        message: "Code, name, semester, and credits are required.",
      });
    }

    const semesterNum = parseInt(semester);
    if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8." });
    }

    const creditsNum = parseInt(credits);
    if (creditsNum < 1 || creditsNum > 6) {
      return res.status(400).json({ message: "Credits must be between 1 and 6." });
    }

    const upperCode = code.toUpperCase().trim();

    // Check if subject with same code and semester already exists
    const existingSubject = await prisma.subject.findUnique({
      where: {
        code_semester: {
          code: upperCode,
          semester: semesterNum,
        },
      },
    });

    if (existingSubject) {
      return res.status(409).json({
        message: `Subject with code ${code} already exists for semester ${semester}.`,
      });
    }

    const subject = await prisma.subject.create({
      data: {
        code: upperCode,
        name: name.trim(),
        semester: semesterNum,
        credits: creditsNum,
        instructor: instructor || "",
        description: description || "",
        createdById: req.user.id || req.user._id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    return res.status(201).json({ subject: serializeSubject(subject) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not create subject." });
  }
});

// Update a subject (master admin only)
router.patch("/:id", protect, masterAdminOnly, async (req, res) => {
  try {
    const { name, credits, instructor, description } = req.body;
    const existingSubject = await prisma.subject.findUnique({
      where: { id: req.params.id },
    });

    if (!existingSubject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (credits) {
      const creditsNum = parseInt(credits);
      if (creditsNum < 1 || creditsNum > 6) {
        return res.status(400).json({ message: "Credits must be between 1 and 6." });
      }
      updateData.credits = creditsNum;
    }
    if (instructor !== undefined) updateData.instructor = instructor;
    if (description !== undefined) updateData.description = description;

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    return res.json({ subject: serializeSubject(subject) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not update subject." });
  }
});

// Delete a subject (master admin only)
router.delete("/:id", protect, masterAdminOnly, async (req, res) => {
  try {
    const existingSubject = await prisma.subject.findUnique({
      where: { id: req.params.id },
    });

    if (!existingSubject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    await prisma.subject.delete({
      where: { id: req.params.id },
    });

    return res.json({ message: "Subject deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete subject." });
  }
});

export default router;

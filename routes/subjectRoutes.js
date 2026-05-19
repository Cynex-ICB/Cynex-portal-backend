import express from "express";
import Subject from "../models/Subject.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all subjects (with optional filtering by semester)
router.get("/", protect, async (req, res) => {
  try {
    const { semester } = req.query;
    const filter = {};

    if (semester) {
      filter.semester = parseInt(semester);
    }

    const subjects = await Subject.find(filter)
      .populate("createdBy", "name email")
      .sort({ semester: 1, code: 1 });

    return res.json({ subjects });
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

    const subjects = await Subject.find({ semester })
      .populate("createdBy", "name email")
      .sort({ code: 1 });

    return res.json({ subjects });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch subjects." });
  }
});

// Get a single subject
router.get("/:id", protect, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate("createdBy", "name email");

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({ subject });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch subject." });
  }
});

// Create a new subject (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
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

    if (parseInt(credits) < 1 || parseInt(credits) > 6) {
      return res.status(400).json({ message: "Credits must be between 1 and 6." });
    }

    // Check if subject with same code and semester already exists
    const existingSubject = await Subject.findOne({
      code: code.toUpperCase(),
      semester: semesterNum,
    });

    if (existingSubject) {
      return res.status(409).json({
        message: `Subject with code ${code} already exists for semester ${semester}.`,
      });
    }

    const subject = await Subject.create({
      code: code.toUpperCase(),
      name,
      semester: semesterNum,
      credits: parseInt(credits),
      instructor: instructor || "",
      description: description || "",
      createdBy: req.user._id,
    });

    return res.status(201).json({ subject });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not create subject." });
  }
});

// Update a subject (admin only)
router.patch("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, credits, instructor, description } = req.body;
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    if (name) subject.name = name;
    if (credits) {
      const creditsNum = parseInt(credits);
      if (creditsNum < 1 || creditsNum > 6) {
        return res.status(400).json({ message: "Credits must be between 1 and 6." });
      }
      subject.credits = creditsNum;
    }
    if (instructor !== undefined) subject.instructor = instructor;
    if (description !== undefined) subject.description = description;

    await subject.save();
    return res.json({ subject });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not update subject." });
  }
});

// Delete a subject (admin only)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({ message: "Subject deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete subject." });
  }
});

export default router;

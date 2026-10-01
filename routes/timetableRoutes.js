import express from "express";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { masterAdminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

function serializeTimetable(timetable) {
  if (!timetable) return null;
  const item = withMongoId(timetable);
  if (item.createdBy) {
    item.createdBy = withMongoId(item.createdBy);
    if (item.createdBy.collegeEmail && !item.createdBy.email) {
      item.createdBy.email = item.createdBy.collegeEmail;
    }
  }
  return item;
}

// GET /api/timetables - fetch all or filter by semester/section/academicYear
router.get("/", protect, async (req, res) => {
  try {
    const { semester, section, academicYear } = req.query;
    const where = {};

    if (semester !== undefined && semester !== "") {
      const semNum = Number(semester);
      if (!isNaN(semNum)) where.semester = semNum;
    }

    if (section) {
      where.section = String(section).toUpperCase();
    }

    if (academicYear) {
      where.academicYear = String(academicYear);
    }

    const timetables = await prisma.timetable.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: [{ semester: "asc" }, { section: "asc" }, { updatedAt: "desc" }],
    });

    return res.json({ timetables: timetables.map(serializeTimetable) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch timetables." });
  }
});

// GET /api/timetables/by-semester/:semester - get timetable for a given semester
router.get("/by-semester/:semester", protect, async (req, res) => {
  try {
    const semester = Number(req.params.semester);
    const { section = "A" } = req.query;

    if (isNaN(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8." });
    }

    const timetable = await prisma.timetable.findFirst({
      where: {
        semester,
        section: String(section).toUpperCase(),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ timetable: serializeTimetable(timetable) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch timetable." });
  }
});

// GET /api/timetables/:id - get single timetable
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const timetable = await prisma.timetable.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found." });
    }

    return res.json({ timetable: serializeTimetable(timetable) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch timetable." });
  }
});

// POST /api/timetables - create or upsert timetable (Super/Master Admin only)
router.post("/", protect, masterAdminOnly, async (req, res) => {
  try {
    const {
      academicYear = "2026-27",
      scheme = "2022",
      semester,
      section = "A",
      classCoordinator = "",
      roomNo = "",
      effectiveDate = "",
      timeSlots = [],
      grid = {},
      courses = [],
    } = req.body;

    const semesterNum = Number(semester);
    if (!semesterNum || semesterNum < 1 || semesterNum > 8) {
      return res.status(400).json({ message: "Valid semester (1-8) is required." });
    }

    const cleanSection = String(section || "A").trim().toUpperCase();
    const cleanAcademicYear = String(academicYear || "2026-27").trim();

    const timetable = await prisma.timetable.upsert({
      where: {
        semester_section_academicYear: {
          semester: semesterNum,
          section: cleanSection,
          academicYear: cleanAcademicYear,
        },
      },
      update: {
        scheme: String(scheme || "2022").trim(),
        classCoordinator: String(classCoordinator || "").trim(),
        roomNo: String(roomNo || "").trim(),
        effectiveDate: String(effectiveDate || "").trim(),
        timeSlots,
        grid,
        courses,
        createdById: req.user.id,
      },
      create: {
        academicYear: cleanAcademicYear,
        scheme: String(scheme || "2022").trim(),
        semester: semesterNum,
        section: cleanSection,
        classCoordinator: String(classCoordinator || "").trim(),
        roomNo: String(roomNo || "").trim(),
        effectiveDate: String(effectiveDate || "").trim(),
        timeSlots,
        grid,
        courses,
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    return res.status(201).json({
      message: "Timetable saved successfully.",
      timetable: serializeTimetable(timetable),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save timetable." });
  }
});

// DELETE /api/timetables/:id - remove timetable
router.delete("/:id", protect, masterAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timetable.delete({
      where: { id },
    });

    return res.json({ message: "Timetable deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete timetable." });
  }
});

export default router;

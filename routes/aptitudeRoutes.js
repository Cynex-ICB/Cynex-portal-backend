import express from "express";
import AptitudeAnswer from "../models/AptitudeAnswer.js";
import AptitudeAssessment from "../models/AptitudeAssessment.js";
import AptitudeAttempt from "../models/AptitudeAttempt.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();
const concepts = [
  "Percentages",
  "Profit and Loss",
  "Ratio and Proportion",
  "Time and Work",
  "Time, Speed and Distance",
  "Number System",
  "Simplification",
  "Averages",
  "Logical Reasoning",
  "Verbal Ability",
  "Data Interpretation",
];
const difficulties = ["Easy", "Medium", "Hard", "Mixed"];
const statuses = ["draft", "published"];
const optionKeys = ["A", "B", "C", "D"];

function isAdmin(user) {
  return ["admin", "master-admin"].includes(user?.role);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
}

function requireStudent(req, res, next) {
  if (req.user?.role !== "student") {
    return res.status(403).json({ message: "Student access required." });
  }

  next();
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value) {
  return value ? new Date(value) : null;
}

async function serializeAssessment(assessment) {
  const totalQuestions = await AptitudeQuestion.countDocuments({ assessment: assessment._id });

  return {
    id: assessment._id,
    title: assessment.title,
    description: assessment.description || "",
    concept: assessment.concept,
    difficulty: assessment.difficulty,
    durationMinutes: assessment.durationMinutes,
    totalMarks: assessment.totalMarks,
    passingMarks: assessment.passingMarks,
    startTime: assessment.startTime,
    endTime: assessment.endTime,
    status: assessment.status,
    totalQuestions,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
  };
}

function serializeQuestion(question, includeAnswer = false) {
  const base = {
    id: question._id,
    questionText: question.questionText,
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    },
    concept: question.concept,
    difficulty: question.difficulty,
    marks: question.marks,
  };

  if (!includeAnswer) return base;

  return {
    ...base,
    correctOption: question.correctOption,
    explanation: question.explanation,
    shortcut: question.shortcut || "",
    negativeMarks: question.negativeMarks,
  };
}

function normalizeQuestion(raw, defaults) {
  const options = raw.options || {};

  return {
    questionText: String(raw.questionText || raw.question_text || "").trim(),
    optionA: String(raw.optionA || raw.option_a || options.A || "").trim(),
    optionB: String(raw.optionB || raw.option_b || options.B || "").trim(),
    optionC: String(raw.optionC || raw.option_c || options.C || "").trim(),
    optionD: String(raw.optionD || raw.option_d || options.D || "").trim(),
    correctOption: String(raw.correctOption || raw.correct_option || "").trim().toUpperCase(),
    explanation: String(raw.explanation || "").trim(),
    shortcut: String(raw.shortcut || "").trim(),
    concept: String(raw.concept || defaults.concept || "").trim(),
    difficulty: difficulties.includes(raw.difficulty) ? raw.difficulty : defaults.difficulty,
    marks: parseNumber(raw.marks, defaults.marks),
    negativeMarks: parseNumber(raw.negativeMarks ?? raw.negative_marks, defaults.negativeMarks),
  };
}

function validateQuestions(rawQuestions, defaults) {
  const questions = Array.isArray(rawQuestions)
    ? rawQuestions.map((question) => normalizeQuestion(question, defaults))
    : [];
  const errors = [];
  const seen = new Set();

  questions.forEach((question, index) => {
    const number = index + 1;
    if (!question.questionText) errors.push(`Question ${number}: question text is required.`);
    if (seen.has(question.questionText.toLowerCase())) errors.push(`Question ${number}: duplicate question.`);
    seen.add(question.questionText.toLowerCase());
    if (!question.optionA || !question.optionB || !question.optionC || !question.optionD) {
      errors.push(`Question ${number}: all four options are required.`);
    }
    if (!optionKeys.includes(question.correctOption)) errors.push(`Question ${number}: correct option must be A, B, C, or D.`);
    if (!question.explanation) errors.push(`Question ${number}: explanation is required.`);
    if (!question.concept) errors.push(`Question ${number}: concept is required.`);
    if (!difficulties.includes(question.difficulty)) errors.push(`Question ${number}: invalid difficulty.`);
  });

  return { valid: errors.length === 0, questions, errors };
}

function parseAssessmentPayload(body) {
  const title = String(body.title || "").trim();
  const concept = String(body.concept || "").trim();
  const difficulty = String(body.difficulty || "Medium").trim();
  const durationMinutes = parseNumber(body.durationMinutes ?? body.duration_minutes);
  const passingMarks = parseNumber(body.passingMarks ?? body.passing_marks);
  const marks = parseNumber(body.marks, 1);
  const negativeMarks = parseNumber(body.negativeMarks ?? body.negative_marks, 0.25);
  const status = String(body.status || "draft").toLowerCase();
  const errors = [];

  if (!title) errors.push("Assessment title is required.");
  if (!concept) errors.push("Concept is required.");
  if (!difficulties.includes(difficulty)) errors.push("Difficulty must be Easy, Medium, Hard, or Mixed.");
  if (durationMinutes < 1) errors.push("Duration must be at least 1 minute.");
  if (passingMarks < 0) errors.push("Passing marks cannot be negative.");
  if (!statuses.includes(status)) errors.push("Invalid status.");

  return {
    config: {
      title,
      description: String(body.description || "").trim(),
      concept,
      difficulty,
      durationMinutes,
      passingMarks,
      marks,
      negativeMarks,
      status,
      startTime: parseDate(body.startTime ?? body.start_time),
      endTime: parseDate(body.endTime ?? body.end_time),
    },
    errors,
  };
}

function ensureAvailable(assessment) {
  const now = new Date();

  if (assessment.isDeleted) return "Assessment is no longer available.";
  if (assessment.status !== "published") return "Assessment is not published.";
  if (assessment.startTime && now < assessment.startTime) return "Assessment has not started yet.";
  if (assessment.endTime && now > assessment.endTime) return "Assessment has ended.";
  return "";
}

async function evaluateAttempt(attempt, assessment) {
  const questions = await AptitudeQuestion.find({ assessment: assessment._id });
  const answers = await AptitudeAnswer.find({ attempt: attempt._id });
  const answerMap = new Map(answers.map((answer) => [answer.question.toString(), answer]));
  let score = 0;
  const updates = [];

  questions.forEach((question) => {
    const answer = answerMap.get(question._id.toString());
    const selectedOption = answer?.selectedOption || null;
    const isCorrect = selectedOption === question.correctOption;
    const marksAwarded = !selectedOption ? 0 : isCorrect ? question.marks : -question.negativeMarks;
    score += marksAwarded;

    updates.push({
      updateOne: {
        filter: { attempt: attempt._id, question: question._id },
        update: { $set: { selectedOption, isCorrect, marksAwarded } },
        upsert: true,
      },
    });
  });

  if (updates.length) await AptitudeAnswer.bulkWrite(updates);

  const totalMarks = assessment.totalMarks || questions.reduce((sum, question) => sum + question.marks, 0);
  attempt.score = Number(score.toFixed(2));
  attempt.percentage = totalMarks ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
  attempt.status = "submitted";
  attempt.submittedAt = new Date();
  await attempt.save();
  return attempt;
}

router.use(protect);

router.get("/meta", (req, res) => {
  return res.json({ concepts, difficulties, statuses });
});

router.get("/admin/dashboard", requireAdmin, async (req, res) => {
  const [assessments, published, students, submittedAttempts, inProgressAttempts] = await Promise.all([
    AptitudeAssessment.countDocuments({ isDeleted: { $ne: true } }),
    AptitudeAssessment.countDocuments({ status: "published", isDeleted: { $ne: true } }),
    User.countDocuments({ role: "student" }),
    AptitudeAttempt.countDocuments({ status: "submitted" }),
    AptitudeAttempt.countDocuments({ status: "in_progress" }),
  ]);

  return res.json({ assessments, published, students, submittedAttempts, inProgressAttempts });
});

router.get("/admin/assessments", requireAdmin, async (req, res) => {
  const assessments = await AptitudeAssessment.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
  return res.json({ assessments: await Promise.all(assessments.map(serializeAssessment)) });
});

router.post("/admin/assessments", requireAdmin, async (req, res) => {
  const { config, errors } = parseAssessmentPayload(req.body);
  const validation = validateQuestions(req.body.questions, config);

  if (errors.length || !validation.valid) {
    return res.status(400).json({ message: "Validation failed.", details: [...errors, ...validation.errors] });
  }

  const totalMarks = validation.questions.reduce((sum, question) => sum + question.marks, 0);
  const assessment = await AptitudeAssessment.create({
    ...config,
    totalMarks,
    createdBy: req.user._id,
  });

  await AptitudeQuestion.insertMany(
    validation.questions.map((question) => ({
      ...question,
      assessment: assessment._id,
    }))
  );

  return res.status(201).json({ assessment: await serializeAssessment(assessment) });
});

router.get("/admin/assessments/:id", requireAdmin, async (req, res) => {
  const assessment = await AptitudeAssessment.findById(req.params.id);
  if (!assessment || assessment.isDeleted) return res.status(404).json({ message: "Assessment not found." });

  const questions = await AptitudeQuestion.find({ assessment: assessment._id }).sort({ createdAt: 1 });
  return res.json({
    assessment: await serializeAssessment(assessment),
    questions: questions.map((question) => serializeQuestion(question, true)),
  });
});

router.patch("/admin/assessments/:id/status", requireAdmin, async (req, res) => {
  const status = String(req.body.status || "").toLowerCase();
  if (!statuses.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const assessment = await AptitudeAssessment.findById(req.params.id);
  if (!assessment || assessment.isDeleted) return res.status(404).json({ message: "Assessment not found." });

  assessment.status = status;
  await assessment.save();
  return res.json({ assessment: await serializeAssessment(assessment) });
});

router.delete("/admin/assessments/:id", requireAdmin, async (req, res) => {
  const assessment = await AptitudeAssessment.findById(req.params.id);
  if (!assessment || assessment.isDeleted) return res.status(404).json({ message: "Assessment not found." });

  assessment.isDeleted = true;
  assessment.deletedAt = new Date();
  assessment.status = "draft";
  await assessment.save();
  return res.status(204).end();
});

router.get("/admin/assessments/:id/results", requireAdmin, async (req, res) => {
  const assessment = await AptitudeAssessment.findById(req.params.id);
  if (!assessment) return res.status(404).json({ message: "Assessment not found." });

  const attempts = await AptitudeAttempt.find({ assessment: assessment._id })
    .populate("student", "name collegeEmail usn semester")
    .sort({ submittedAt: -1, startedAt: -1 });

  return res.json({
    results: attempts.map((attempt) => ({
      id: attempt._id,
      studentName: attempt.student?.name || "Unknown",
      collegeEmail: attempt.student?.collegeEmail || "",
      usn: attempt.student?.usn || "",
      semester: attempt.student?.semester || "",
      score: attempt.score,
      percentage: attempt.percentage,
      status: attempt.status,
      passed: attempt.status === "submitted" && attempt.score >= assessment.passingMarks,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    })),
  });
});

router.get("/student/dashboard", requireStudent, async (req, res) => {
  const [availableAssessments, submittedAttempts] = await Promise.all([
    AptitudeAssessment.countDocuments({ status: "published", isDeleted: { $ne: true } }),
    AptitudeAttempt.countDocuments({ student: req.user._id, status: "submitted" }),
  ]);

  return res.json({ availableAssessments, submittedAttempts });
});

router.get("/student/assessments", requireStudent, async (req, res) => {
  const assessments = await AptitudeAssessment.find({ status: "published", isDeleted: { $ne: true } }).sort({ createdAt: -1 });
  return res.json({ assessments: await Promise.all(assessments.map(serializeAssessment)) });
});

router.post("/student/assessments/:id/start", requireStudent, async (req, res) => {
  const assessment = await AptitudeAssessment.findById(req.params.id);
  if (!assessment) return res.status(404).json({ message: "Assessment not found." });
  const unavailableReason = ensureAvailable(assessment);
  if (unavailableReason) return res.status(403).json({ message: unavailableReason });

  let attempt = await AptitudeAttempt.findOne({
    assessment: assessment._id,
    student: req.user._id,
    status: "in_progress",
  });

  if (!attempt) {
    attempt = await AptitudeAttempt.create({ assessment: assessment._id, student: req.user._id });
  }

  const [questions, answers] = await Promise.all([
    AptitudeQuestion.find({ assessment: assessment._id }).sort({ createdAt: 1 }),
    AptitudeAnswer.find({ attempt: attempt._id }),
  ]);
  const selectedAnswers = Object.fromEntries(answers.map((answer) => [answer.question.toString(), answer.selectedOption]));

  return res.json({
    assessment: await serializeAssessment(assessment),
    attempt: {
      id: attempt._id,
      startedAt: attempt.startedAt,
      extraTimeMinutes: attempt.extraTimeMinutes,
      status: attempt.status,
    },
    questions: questions.map((question) => serializeQuestion(question)),
    selectedAnswers,
  });
});

router.put("/student/attempts/:attemptId/answers", requireStudent, async (req, res) => {
  const selectedOption = req.body.selectedOption ?? req.body.selected_option ?? null;
  if (![...optionKeys, null].includes(selectedOption)) return res.status(400).json({ message: "Selected option must be A, B, C, D, or null." });

  const attempt = await AptitudeAttempt.findById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ message: "Attempt not found." });
  if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You do not have permission to access this attempt." });
  if (attempt.status !== "in_progress") return res.status(400).json({ message: "Attempt already submitted." });

  const question = await AptitudeQuestion.findById(req.body.questionId ?? req.body.question_id);
  if (!question || question.assessment.toString() !== attempt.assessment.toString()) {
    return res.status(400).json({ message: "Question does not belong to this attempt." });
  }

  await AptitudeAnswer.findOneAndUpdate(
    { attempt: attempt._id, question: question._id },
    { selectedOption },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ saved: true });
});

router.post("/student/attempts/:attemptId/submit", requireStudent, async (req, res) => {
  const attempt = await AptitudeAttempt.findById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ message: "Attempt not found." });
  if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You do not have permission to access this attempt." });

  const assessment = await AptitudeAssessment.findById(attempt.assessment);
  if (!assessment) return res.status(404).json({ message: "Assessment not found." });

  const evaluated = attempt.status === "submitted" ? attempt : await evaluateAttempt(attempt, assessment);
  return res.json({ attempt: evaluated });
});

router.get("/student/results", requireStudent, async (req, res) => {
  const attempts = await AptitudeAttempt.find({ student: req.user._id, status: "submitted" })
    .populate("assessment", "title concept difficulty passingMarks totalMarks")
    .sort({ submittedAt: -1 });

  return res.json({
    results: attempts.map((attempt) => ({
      id: attempt._id,
      assessmentTitle: attempt.assessment?.title || "Assessment",
      concept: attempt.assessment?.concept || "",
      difficulty: attempt.assessment?.difficulty || "",
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.score >= (attempt.assessment?.passingMarks || 0),
      submittedAt: attempt.submittedAt,
    })),
  });
});

router.get("/student/results/:attemptId", requireStudent, async (req, res) => {
  const attempt = await AptitudeAttempt.findById(req.params.attemptId).populate("assessment");
  if (!attempt) return res.status(404).json({ message: "Attempt not found." });
  if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You do not have permission to access this result." });
  if (attempt.status !== "submitted") return res.status(403).json({ message: "Results are available after submission." });

  const [questions, answers] = await Promise.all([
    AptitudeQuestion.find({ assessment: attempt.assessment._id }).sort({ createdAt: 1 }),
    AptitudeAnswer.find({ attempt: attempt._id }),
  ]);
  const answerMap = new Map(answers.map((answer) => [answer.question.toString(), answer]));

  return res.json({
    attempt,
    assessment: await serializeAssessment(attempt.assessment),
    answers: questions.map((question) => {
      const answer = answerMap.get(question._id.toString());
      return {
        ...serializeQuestion(question, true),
        selectedOption: answer?.selectedOption || null,
        isCorrect: Boolean(answer?.isCorrect),
        marksAwarded: answer?.marksAwarded || 0,
      };
    }),
  });
});

export default router;

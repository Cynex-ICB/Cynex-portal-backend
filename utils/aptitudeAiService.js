import OpenAI from "openai";

export const APTITUDE_CONCEPTS = [
  "Percentages",
  "Profit and Loss",
  "Ratio and Proportion",
  "Time and Work",
  "Time, Speed and Distance",
  "Number System",
  "Simplification",
  "Averages",
  "Mixtures and Allegations",
  "Permutation and Combination",
  "Probability",
  "Simple Interest",
  "Compound Interest",
  "Data Interpretation",
  "Logical Reasoning",
  "Verbal Ability",
  "Coding-Decoding",
  "Blood Relations",
  "Seating Arrangement",
  "Puzzles",
];

function badRequest(message, details = []) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = Array.isArray(details) ? details : [details];
  return error;
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return extractJson(fenceMatch[1]);

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw badRequest("AI response did not contain valid JSON.");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

export function buildAptitudePrompt(config, fileContext = "") {
  const maxContextChars = Number(process.env.AI_FILE_CONTEXT_CHARS || 5000);
  const contextBlock = fileContext
    ? `\nUse this uploaded study material as optional context. Do not copy it verbatim unless needed for a question:\n${fileContext.slice(0, maxContextChars)}\n`
    : "";

  return `Generate aptitude assessment questions for placement preparation and interview preparation.

Concept: ${config.concept}
Difficulty: ${config.difficulty}
Number of questions: ${config.questionCount}
Marks per question: ${config.marks}
Negative marks: ${config.negativeMarks}
${contextBlock}
Requirements:

* Generate only MCQ questions
* Each question must contain exactly 4 options: A, B, C, D
* Only one correct answer
* Include detailed step-by-step explanation
* Include shortcut solving method where applicable
* Include concept name
* Include difficulty level
* Avoid repeated questions
* Avoid ambiguity
* Questions should match placement aptitude standards
* Return ONLY valid JSON
* Do NOT return markdown

JSON structure:

{
"assessment_title": "",
"concept": "",
"difficulty": "",
"total_questions": 0,
"questions": [
{
"question_text": "",
"options": {
"A": "",
"B": "",
"C": "",
"D": ""
},
"correct_option": "",
"explanation": "",
"shortcut": "",
"concept": "",
"difficulty": "",
"marks": 1,
"negative_marks": 0.25
}
]
}`;
}

function getAiConfig() {
  const provider = (process.env.AI_PROVIDER || "nvidia").toLowerCase();
  const apiKey =
    process.env.NVIDIA_NIM_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const rawBaseUrl =
    process.env.NVIDIA_NIM_BASE_URL ||
    process.env.AI_BASE_URL ||
    process.env.NVIDIA_NIM_API_URL ||
    process.env.AI_API_URL ||
    process.env.OPENAI_API_URL ||
    "https://integrate.api.nvidia.com/v1";
  const model =
    process.env.NVIDIA_NIM_MODEL ||
    process.env.AI_MODEL ||
    process.env.OPENAI_MODEL ||
    "minimaxai/minimax-m2.7";
  const useResponseFormat =
    process.env.AI_USE_RESPONSE_FORMAT === "true" ||
    (provider === "openai" && process.env.AI_USE_RESPONSE_FORMAT !== "false");

  return {
    provider,
    apiKey,
    baseURL: rawBaseUrl.replace(/\/chat\/completions\/?$/, "").replace(/\/$/, ""),
    model,
    useResponseFormat,
    batchSize: Math.max(1, Number(process.env.AI_BATCH_SIZE || 5)),
    concurrency: Math.max(1, Number(process.env.AI_BATCH_CONCURRENCY || 2)),
    timeout: Math.max(15000, Number(process.env.AI_TIMEOUT_MS || 120000)),
  };
}

function pseudoRandom(seed) {
  return Number(`0.${Math.abs(Math.sin(seed)).toString().slice(6, 16)}`);
}

function randomInt(min, max, seed) {
  return Math.floor(pseudoRandom(seed) * (max - min + 1)) + min;
}

function buildOptions(correctValue, seed) {
  const delta = Math.max(1, Math.round(Math.abs(correctValue) * 0.12) || 1);
  const values = new Set([correctValue]);
  let attempt = 0;

  while (values.size < 4 && attempt < 20) {
    const offset = randomInt(1, delta * 3, seed + attempt);
    const candidate = correctValue + (attempt % 2 === 0 ? offset : -offset);
    if (candidate !== correctValue) values.add(candidate);
    attempt += 1;
  }

  let fallbackValue = correctValue + delta;
  while (values.size < 4) {
    values.add(fallbackValue);
    fallbackValue += delta;
  }

  const distractors = Array.from(values).filter((value) => value !== correctValue);
  const correctIndex = randomInt(0, 3, seed + 100);
  const ordered = [...distractors.slice(0, 3)];
  ordered.splice(correctIndex, 0, correctValue);

  return {
    options: {
      A: String(ordered[0]),
      B: String(ordered[1]),
      C: String(ordered[2]),
      D: String(ordered[3]),
    },
    correct_option: ["A", "B", "C", "D"][correctIndex],
  };
}

function buildQuestionTemplate(concept, difficulty, index, marks, negativeMarks) {
  const conceptSeed = Math.max(1, APTITUDE_CONCEPTS.indexOf(concept) + 1);
  const seed = index + 1 + conceptSeed * 1000;
  let questionText = "";
  let correctValue = 0;
  let explanation = "";
  let shortcut = "";

  switch (concept) {
    case "Percentages": {
      const base = randomInt(80, 260, seed);
      const percent = randomInt(5, 35, seed + 1);
      correctValue = Math.round((base * percent) / 100);
      questionText = `If ${percent}% of ${base} students passed the aptitude test, how many students passed?`;
      explanation = `Calculate ${percent}% of ${base}: multiply ${base} by ${percent} and divide by 100 to get ${correctValue}.`;
      shortcut = `Use ${base} x ${percent}/100.`;
      break;
    }
    case "Profit and Loss": {
      const cost = randomInt(250, 900, seed);
      const profit = randomInt(10, 45, seed + 1);
      correctValue = Math.round((cost * profit) / 100);
      questionText = `A product is bought for Rs. ${cost} and sold at a profit of ${profit}%. What is the profit amount?`;
      explanation = `Profit = ${profit}% of Rs. ${cost} = Rs. ${correctValue}.`;
      shortcut = "Multiply cost price by profit percent and divide by 100.";
      break;
    }
    case "Ratio and Proportion": {
      const a = randomInt(2, 8, seed);
      const b = randomInt(3, 12, seed + 1);
      const multiple = randomInt(5, 15, seed + 2);
      correctValue = a * multiple;
      questionText = `If the ratio of A to B is ${a}:${b} and B is ${b * multiple}, what is A?`;
      explanation = `B has been scaled by ${multiple}, so A = ${a} x ${multiple} = ${correctValue}.`;
      shortcut = "Scale both ratio terms by the same multiplier.";
      break;
    }
    case "Time and Work": {
      const rateA = randomInt(4, 10, seed);
      const rateB = randomInt(6, 14, seed + 1);
      correctValue = Math.round((rateA * rateB) / (rateA + rateB));
      questionText = `A can finish a job in ${rateA} days and B in ${rateB} days. In how many days will they finish together?`;
      explanation = `Combined time = AB/(A+B) = (${rateA} x ${rateB}) / (${rateA} + ${rateB}) = ${correctValue}.`;
      shortcut = "Use AB/(A+B) for two workers.";
      break;
    }
    case "Time, Speed and Distance": {
      const speed = randomInt(30, 70, seed);
      const time = randomInt(2, 5, seed + 1);
      correctValue = speed * time;
      questionText = `A vehicle travels at ${speed} km/h for ${time} hours. How many kilometers does it cover?`;
      explanation = `Distance = speed x time = ${speed} x ${time} = ${correctValue} km.`;
      shortcut = "Multiply rate by time.";
      break;
    }
    case "Averages": {
      const count = randomInt(3, 6, seed);
      const average = randomInt(15, 45, seed + 1);
      correctValue = average * count;
      questionText = `The average of ${count} numbers is ${average}. What is their sum?`;
      explanation = `Sum = average x count = ${average} x ${count} = ${correctValue}.`;
      shortcut = "Average multiplied by count gives the sum.";
      break;
    }
    default: {
      const a = randomInt(7, 18, seed);
      const b = randomInt(3, 12, seed + 1);
      correctValue = a * b;
      questionText = `If one student solves ${a} questions each hour, how many questions will they solve in ${b} hours?`;
      explanation = `Multiply rate by time: ${a} x ${b} = ${correctValue}.`;
      shortcut = "Use direct multiplication.";
    }
  }

  const { options, correct_option } = buildOptions(correctValue, seed + 50);
  return {
    question_text: questionText,
    options,
    correct_option,
    explanation,
    shortcut,
    concept,
    difficulty,
    marks,
    negative_marks: negativeMarks,
  };
}

function generateLocalAssessmentJson(config) {
  const questions = [];
  const concepts =
    config.concept === "All Concepts" ? APTITUDE_CONCEPTS : [config.concept];
  const baseCount = Math.floor(config.questionCount / concepts.length);
  const remainder = config.questionCount % concepts.length;

  concepts.forEach((concept, conceptIndex) => {
    const conceptCount = baseCount + (conceptIndex < remainder ? 1 : 0);
    for (let index = 0; index < conceptCount; index += 1) {
      questions.push(
        buildQuestionTemplate(
          concept,
          config.difficulty,
          index,
          config.marks,
          config.negativeMarks
        )
      );
    }
  });

  return {
    assessment_title: config.title,
    concept: config.concept,
    difficulty: config.difficulty,
    total_questions: questions.length,
    questions,
  };
}

function estimateMaxTokens(questionCount) {
  return Math.min(8192, Math.max(1800, questionCount * 700));
}

function getAiErrorMessage(error) {
  return (
    error?.error?.message ||
    error?.error?.code ||
    error?.response?.data?.error?.message ||
    error?.message ||
    "AI generation failed"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

function buildGenerationJobs(config, batchSize) {
  const concepts = config.concept === "All Concepts" ? APTITUDE_CONCEPTS : [config.concept];
  return concepts.flatMap((concept, conceptIndex) => {
    const baseCount = Math.floor(config.questionCount / concepts.length);
    const remainder = config.questionCount % concepts.length;
    let remaining = baseCount + (conceptIndex < remainder ? 1 : 0);
    const jobs = [];

    while (remaining > 0) {
      const questionCount = Math.min(batchSize, remaining);
      jobs.push({ ...config, concept, questionCount });
      remaining -= questionCount;
    }

    return jobs;
  });
}

async function generateBatchJson(openai, ai, config, fileContext, batchLabel) {
  const prompt = `${buildAptitudePrompt(config, fileContext)}

Batch instruction:
Generate batch ${batchLabel}. Make every question unique within this batch.
Return exactly ${config.questionCount} questions.`;

  const request = {
    model: ai.model,
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: estimateMaxTokens(config.questionCount),
    messages: [
      {
        role: "system",
        content: "You are an expert aptitude assessment generator. Return strict JSON only.",
      },
      { role: "user", content: prompt },
    ],
  };

  if (ai.useResponseFormat) request.response_format = { type: "json_object" };

  let lastMessage = "AI generation failed";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create(request);
      const content = completion?.choices?.[0]?.message?.content;
      if (!content) throw badRequest("AI response was empty.");
      return extractJson(content);
    } catch (error) {
      lastMessage = getAiErrorMessage(error);
      if (attempt === 3) throw badRequest(`AI batch ${batchLabel} failed.`, [lastMessage]);
      await sleep(attempt * 800);
      request.temperature = 0.3;
      request.messages = [
        ...request.messages,
        {
          role: "user",
          content: "Retry with only one valid JSON object. No markdown, comments, or prose.",
        },
      ];
    }
  }

  throw badRequest(`AI batch ${batchLabel} failed.`, [lastMessage]);
}

async function generateJobWithRecovery(openai, ai, job, fileContext, jobIndex) {
  const batchLabel = String(jobIndex + 1);

  try {
    return await generateBatchJson(openai, ai, job, fileContext, batchLabel);
  } catch (error) {
    if (job.questionCount <= 1) throw error;

    const individualJobs = Array.from({ length: job.questionCount }, () => ({
      ...job,
      questionCount: 1,
    }));

    const batches = [];
    for (let index = 0; index < individualJobs.length; index += 1) {
      batches.push(
        await generateBatchJson(openai, ai, individualJobs[index], fileContext, `${batchLabel}.${index + 1}`)
      );
    }

    return {
      assessment_title: job.title,
      concept: job.concept,
      difficulty: job.difficulty,
      total_questions: batches.reduce((sum, batch) => sum + (batch.questions?.length || 0), 0),
      questions: batches.flatMap((batch) => batch.questions || []),
    };
  }
}

export async function generateAptitudeAssessmentJson(config, fileContext = "") {
  if (config.generationMode === "fast") {
    return generateLocalAssessmentJson(config);
  }

  const ai = getAiConfig();
  if (!ai.apiKey) {
    if (process.env.NODE_ENV !== "production") {
      return generateLocalAssessmentJson(config);
    }

    throw badRequest(
      "AI API credentials are missing. Set NVIDIA_NIM_API_KEY, AI_API_KEY, or OPENAI_API_KEY in .env."
    );
  }

  const openai = new OpenAI({
    apiKey: ai.apiKey,
    baseURL: ai.baseURL,
    maxRetries: 1,
    timeout: ai.timeout,
  });
  const jobs = buildGenerationJobs(config, ai.batchSize);
  const batches = await runWithConcurrency(jobs, ai.concurrency, (job, index) =>
    generateJobWithRecovery(openai, ai, job, fileContext, index)
  );
  const questions = batches.flatMap((batch) => batch.questions || []);

  return {
    assessment_title: config.title || batches[0]?.assessment_title || "",
    concept: config.concept,
    difficulty: config.difficulty,
    total_questions: questions.length,
    questions,
  };
}

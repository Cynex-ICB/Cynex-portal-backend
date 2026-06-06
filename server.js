import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cieRoutes from "./routes/cieRoutes.js";
import { getUploadRoot } from "./utils/uploadStorage.js";

dotenv.config({ path: ["server/.env", ".env"] });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Add it to your .env file.");
}

const app = express();
const port = process.env.PORT || 5000;
const isVercel = Boolean(process.env.VERCEL);
const corsOptions = {
  origin(origin, callback) {
    const originEntries = [
      process.env.CLIENT_URL,
      "https://cynexicb.com",
      "https://www.cynexicb.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ].filter(Boolean);

    const allowedOrigins = originEntries.flatMap((entry) =>
      entry
        .split(",")
        .map((item) => item.trim())
    );

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(path.join(process.cwd(), "assets")));
app.use(
  "/uploads",
  express.static(getUploadRoot(), {
    setHeaders(res, filePath) {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cie-marks", cieRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Server error.",
    details: err.details || null,
  });
});

connectDB()
  .then(() => {
    if (isVercel) {
      console.log("API server initialized for Vercel.");
      return;
    }

    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not start server:", error.message);
    process.exit(1);
  });

export default app;

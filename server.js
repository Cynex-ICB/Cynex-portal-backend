import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";

dotenv.config({ path: ["server/.env", ".env"] });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Add it to your .env file.");
}

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "https://www.cynexicb.com",
        "https://cynexicb.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static("server/uploads", {
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error." });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not start server:", error.message);
    process.exit(1);
  });

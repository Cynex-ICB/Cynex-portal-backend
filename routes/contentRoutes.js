import express from "express";
import ContentPost from "../models/ContentPost.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
const allowedTypes = new Set(["achievement", "placement", "internship", "activity-alert"]);

router.get("/", protect, async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      if (!allowedTypes.has(req.query.type)) {
        return res.status(400).json({ message: "Invalid content type." });
      }
      filter.type = req.query.type;
    }

    const posts = await ContentPost.find(filter)
      .populate("createdBy", "name collegeEmail")
      .sort({ createdAt: -1 });

    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch content." });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { type, title, description, name, roleTitle, ctcLpa, imageUrl, link } = req.body;

    if (!allowedTypes.has(type)) {
      return res.status(400).json({ message: "Invalid content type." });
    }

    if (!title) {
      return res.status(400).json({ message: "Title is required." });
    }

    const post = await ContentPost.create({
      type,
      title,
      description: description || "",
      name: name || "",
      roleTitle: roleTitle || "",
      ctcLpa: ctcLpa || "",
      imageUrl: imageUrl || "",
      link: link || "",
      createdBy: req.user._id,
    });

    const populatedPost = await post.populate("createdBy", "name collegeEmail");
    return res.status(201).json({ post: populatedPost });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not create content." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const post = await ContentPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Content not found." });
    }

    return res.json({ message: "Content deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete content." });
  }
});

export default router;

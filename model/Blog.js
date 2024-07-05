// blog.js
import mongoose, { Schema } from "mongoose";

// Blog schema
const BlogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["blog", "qna"], // Allowed values for type
  },
  title: { type: String },
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: "User" },
  likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
  createAt:{type : Date, default:Date.now}
});

BlogSchema.index({ content: 'text', title: 'text' });

// Create and export the Blog model
export const Blog = mongoose.model("Blog", BlogSchema);

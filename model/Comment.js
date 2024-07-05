import mongoose, { Schema } from 'mongoose';

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  parentComment: { type: Schema.Types.ObjectId, ref: 'Comment', default: null }, // Reference to parent comment (optional)
  nestedComments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }], // Array of nested comment IDs
});

export const Comment = mongoose.model('Comment', CommentSchema);

// No need for a separate NestedComment schema (removed)
  
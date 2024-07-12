// route.js
import express from "express";
import {
  authenticate,
  getBlogs,
  login,
  postBlog,
  signUp,
  postComment,
  getAllComments,
  deleteComment,
  handleLike,
  userInfo,
  updateNotification,
  getBlogById,
  deleteBlog,
  updateBlog,
  setProfile,
  savesPost,
  search,
  updateProfile,  
  forgotPassword,
  resetPassword,
  verifyOtp,
} from "../controller/myControllers.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/signup", signUp);
router.post("/login", login);

// Private route (authentication required)
router.get("/protected", authenticate, (req, res) => {
  // This route is protected by authentication middleware
  // Only authenticated users can access it
  return res
    .status(200)
    .json({
      userId: req.userId,
      info: req.userInfo,
      message: "Authenticated user",
    });
});
router.put("/setProfile", setProfile);
router.put("/updateBlog/:blogId", updateBlog);
router.post("/postBlog", authenticate, postBlog);
router.get("/getBlogs", getBlogs);
router.delete(`/deleteBlog/:blogId`, deleteBlog);
router.get("/blogById/:blogId", getBlogById);
router.get("/profileInfo", userInfo);
router.put("/postComment", postComment);
router.delete(`/deleteComment/:commentId`, authenticate, deleteComment);
router.get("/getAllComments/:blogId", getAllComments);
// router.get("/getReplies/:commentId", getReplies);
router.post("/handleLike/:blogId", handleLike);
router.put("/notification", updateNotification);
router.put("/savePost/:blogId", savesPost);
router.get("/blogs/search", search);

router.post("/logout", (req, res) => {
res.clearCookie("token", {
    httpOnly: true,
    sameSite: "Strict", // Ensure the sameSite attribute matches how the cookie was set
    path: "/", // Ensure the path matches how the cookie was set
  });
  res.status(200).send({ message: "Logged out successfully" });
});

router.put('/updateProfile', updateProfile);
router.post('/forgotpassword', forgotPassword);
router.post('/verify-otp', verifyOtp );
router.put('/resetPassword', resetPassword);




export default router;

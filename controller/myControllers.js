import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv, { populate } from "dotenv";
import { User } from "../model/User.js";
import { Blog } from "../model/Blog.js";
import { Comment } from "../model/Comment.js";
import Notification from "../model/Notification.js";
import { sendNotification, sendPostnotification } from "../index.js";
import nodemailer from 'nodemailer';
dotenv.config();
import Fuse from 'fuse.js';

export async function savesPost(req, res){
  try{

    const userId = req.body.data;
    const {blogId} = req.params;
    const user = await User.findById(userId);

    if(!user){
      throw new error("user not found")
    }

    const isSaved = user.savedPosts.includes(blogId);

    if(isSaved){
      user.savedPosts.pull(blogId)
    }
    else{
      user.savedPosts.push(blogId);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: isSaved ? "post removed from saved": "post added to saved",
      savedPosts: user.savedPosts
    })

  }catch(error){
    return res.status(500).json({
    success: false,
    message: error.message
    })    
  }
}

export async function search(req, res) {
  const { query } = req.query;

  try {
    const blogs = await Blog.find({})
      .populate("author", "name profilePicture")
      .populate({
        path: "comments",
        populate: { path: "postedBy", select: "name profilePicture" }, // Populate the postedBy field in comments
      });; // Fetch all blogs

    // Initialize Fuse.js with options for fuzzy search
    const fuse = new Fuse(blogs, {
      keys: [
        "title",
        "content",
        { name: "author.name", weight: 0.3 } // Include author.name in search keys with lower weight
      ], // Fields to search
      includeScore: true,
      threshold: 0.4, // Adjust to fine-tune fuzzy matching sensitivity
      ignoreLocation: true, // Ignore search term position in text
      distance: 100, // Maximum edit distance for fuzzy matches
    });

    // Search with the query
    const results = fuse.search(query);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results.map(result => result.item) // Extract matched items from Fuse.js result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to search blogs',
      error: error.message
    });
  }
};

async function populateNestedComments(comment) {
  await comment.populate({
    path: 'nestedComments',
    populate: { path: 'postedBy', select:'name profilePicture' }
  });

  for (const nestedComment of comment.nestedComments) {
    await populateNestedComments(nestedComment);
  }
}

export async function getBlogById(req, res) {
  try {
    const { blogId } = req.params;
    const response = await Blog.findById(blogId)
      .populate("author")
      .populate({
        path : "comments",
        populate:{path : "postedBy", select: "name profilePicture "}
      })
      .exec();

  
    if (response.comments && response.comments.length > 0) {
        for (const comment of response.comments) {
          await populateNestedComments(comment);
        }
      }
    

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {}
}

export async function updateNotification(req, res) {
  try {
    const userId = req.body.data;
    await Notification.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    res.status(200);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
}

export async function setProfile(req, res) {
  try {
    const userId = req.body.data;
    const userProfile = req.body.profile;

    if (!userProfile) {
      return res.status(400).json({ error: "Profile picture URL is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: userProfile },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.log("error in updating user profile", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
export async function userInfo(req, res) {
  try {
    const userId = req.query.data;

    // Fetch the user information
    const response = await User.findById(userId);
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.log("error in getting userInfo", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleLike(req, res) {
  try {
    const blogId = req.params.blogId;
    const userId = req.body.data;

    const user = await User.findById(userId);

    if(!user){
      return res.status(404).json({message:"user not found "})
    }

    const blog = await Blog.findById(blogId); // Find the blog by ID

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const existingLike = blog.likes.includes(userId); // Check if user already liked

    if (existingLike) {
      // Unlike scenario
      const updatedBlog = await Blog.findOneAndUpdate(
        { _id: blogId },
        { $pull: { likes: userId } },
        { new: true }
      );
      return res.status(200).json({ message: "Like removed", updatedBlog });
    } else {
      // Like scenario: Add userId to likes array
      const updatedBlog = await Blog.findOneAndUpdate(
        { _id: blogId },
        { $addToSet: { likes: userId } },
        { new: true }
      );

      const blogOwnerId = updatedBlog.author.toString();

      // if (blogOwnerId != userId) {
      const notification = new Notification({
        user: updatedBlog.author,
        type: "like",
        message: `${user.name} liked your post.`,
        post: blogId,
        fromUser: user,
      });

      await notification.save();
      sendNotification(blogOwnerId, notification);
      // }

      return res.status(200).json({ message: "Like successful", updatedBlog });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteComment(req, res) {
  try {
    const commentId = req.params.commentId;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.parentComment) {
      // Delete the comment first
      await Comment.deleteOne({ _id: commentId });

      // Then, safely remove the comment ID from the parent's nestedComments array
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        await parentComment.updateOne({ $pull: { nestedComments: commentId } });
      }
    } else {
      // If comment doesn't have a parent, delete it directly
      await Comment.deleteOne({ _id: commentId });
    }

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

export async function postComment(req, res) { 
  try {
    const { comment, blogId, parentCommentId, userId } = req.body;

    const user = await User.findById(userId).select("name profilePicture");

    const blog = await Blog.findById(blogId)
        .populate("author", "name profilePicture")
        .populate("comments")
        .populate({
          path: "comments",
          populate: { path: "postedBy", select: "name profilePicture" }, 
        });

    // Create a new comment
    const newComment = new Comment({
      text: comment,
      postedBy: userId,
      createdAt: new Date(),
      parentComment: parentCommentId, // Reference to parent comment (if provided)
    });

    await newComment.save(); 

    // Update the parent comment (if applicable)
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { nestedComments: newComment._id }, // Push new comment ID to parent's nestedComments array
      });

      //notification
      // if (parentComment.postedBy.toString() !== userId) {
      const parentCommentUser = await User.findById(parentComment.postedBy);
      const notification = new Notification({
        user: parentCommentUser._id,
        type: "comment_reply",
        message: `${user.name} replied to your comment.`,
        post: blogId,
        fromUser: user,
        comment: newComment._id,
      });

      await notification.save();
      sendNotification(parentCommentUser._id, notification);
      // }
    }

    // Update the blog schema (using middleware is recommended, see below)
    if (!parentCommentId) {
      await Blog.findByIdAndUpdate(
        blogId,
        { $push: { comments: newComment._id } },
        { new: true }
      );

      const blogOwner = await Blog.findById(blogId).populate("author");
      const blogOwnerId = blogOwner.author._id.toString();

      // Notify the blog owner
      // if (blogOwnerId !== userId) {
      const notification = new Notification({
        user: blogOwnerId,
        type: "comment",
        message: `${user.name} commented on your post.`,
        post: blogId,
        fromUser: user,
        comment: newComment._id,
      });

      await notification.save();
      sendNotification(blogOwnerId, notification);
      // }
    }

    res.status(200).json({
      success: true,
      comment: newComment, // Return the newly created comment
      message: "Comment added successfully",
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
      error: error.message, // Include the error message in the response
    });
  }
}

export async function getAllComments(req, res) {
  try {
    const { blogId } = req.params;
    const userId = req.body.data;

    const blog = await Blog.findById(blogId)
      .populate({
        path: "comments",
        populate: { path: "postedBy", select: "name profilePicture" } // Include user details for top-level comments
      })
      .exec();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const comments = blog.comments || []; // Ensure comments array exists even if empty

    // Populate nested comments recursively
    for (const comment of comments) {
      await populateNestedComments(comment);
    }

    res.status(200).json({
      success: true,
      comments, // Return all comments (including nested)
      userId,
    });
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
    });
  }
}

export async function getBlogs(req, res) {
  try {
    const data = await Blog.find()
      .populate("author")
      .populate({
        path : "comments",
        populate:{path : "postedBy", select: "name profilePicture "}
      })
      .exec();

    for (const blog of data) {
      if (blog.comments && blog.comments.length > 0) {
        for (const comment of blog.comments) {
          await populateNestedComments(comment);
        }
      }
    }

    return res.status(200).json({
      success: true,
      Blogs: data,
      message: "Blogs are here",
    });
  } catch (error) {
    console.error("Failed to fetch data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch data",
    });
  }
}
export async function signUp(req, res) {
  try {
    const { name, email, password, college, company, linkedin } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Check if the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Assign default role ("Member") to new users
    const role = "Member";

    // Create a new user record
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      college,
      company,
      linkedin,
      role,
    });

    // Respond with success message and user data
    res.status(200).json({
      success: true,
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user, please try again",
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find the user by email
    const user = await User.findOne({ email })
    .populate({
      path: "notifications",
      populate: [
        {
          path: "fromUser",
          select: "name profilePicture",
        },
        // {
        //   path: "post",
        //   populate: [
        //     {
        //       path: "author",
        //       select: "name profilePicture",
        //     },
        //     {
        //       path: "comments",
        //       populate: {
        //         path: "postedBy",
        //         select: "name profilePicture",
        //       },
        //     },
        //   ],
        // },
      ],
    });

    // If user not found, return error
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    req.userId = user._id;
    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If passwords don't match, return error
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "8d",
    });

    // Send the token in a cookie
    res.cookie("token", token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production', // Ensure secure in production
      maxAge: 8 * 24 * 60 * 60 * 1000,
      sameSite: "Strict", // Can also try "Lax" or "None" (with Secure flag)
    });
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function authenticate(req, res, next) {
  try {
    // Get the token from the request cookies
    const token = req.cookies.token;

    // If token is not provided, return 999 and then direct to login page in frontend
    if (!token) {
      return res.status(999);
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate([
      {
      path: 'savedPosts',

      populate:[ {
        path: 'comments',
        populate: {
          path: 'postedBy',
          select: 'name profilePicture'
        }
      },
      {path: 'author',
       select : 'name profilePicture'
      }
      ]
      },      
      {
      path: "notifications",
      populate: [
        {
          path: "fromUser",
          select: "profilePicture",
        },
        // {
        //   path: "post",
        //   populate: [
        //     {
        //       path: "author",
        //       select: "name profilePicture",
        //     },
        //     {
        //       path: "comments",
        //       populate: {
        //         path: "postedBy",
        //         select: "name profilePicture",
        //       },
        //     },
        //   ],
        // },
      ],
    }
    ]);
    // Set the user ID in the req object for further use
    req.userId = decoded.userId;
    req.userInfo = user;
    next(); // Call the next middleware
  } catch (error) {
    console.error("Error authenticating:", error);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid token",
    });
  }
}

export async function postBlog(req, res) {
  try {
    let userId = req.userId;
    const blogOwner = await User.findById(userId)
      .select("name profilePicture")
      .exec();
    if (!blogOwner) {
      console.log("no user found ");
      return res.status(401).json({
        success: false,
        message: "user not found ",
      });
    }

    const { title, content, type } = req.body;

    const newBlog = new Blog({ author: userId, title, content, type });

    await newBlog.save();

    let notification;
    if (type === "blog") {
      notification = new Notification({
        user: blogOwner._id,
        type: "newBlog",
        message: `New blog by ${blogOwner.name} : ${title}, check it out !`,
        post: newBlog,
        fromUser: blogOwner,
        createdAt: new Date(),
        read: false,
      });
    } else {
      notification = new Notification({
        user: blogOwner._id,
        type: "newQnA",
        message: `${blogOwner.name} has asked for help with: "${content}". Please contribute your insights if you can.`,
        post: newBlog._id,
        fromUser: blogOwner,
        createdAt: new Date(),
        read: false,
      });
    }

    await notification.save();
    const allUsers = await User.find();
    for (const user of allUsers) {
      await sendPostnotification(user._id, notification);
    }

    return res.status(201).json({
      success: true,
      message: "Blog saved successfully",
    });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ success: false, message: "Failed to save Blog" });
  }
}

export async function deleteBlog(req, res) {
  try {
    const blogId = req.params.blogId;
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({ message: "blog not found" });
    } else {
      // If comment doesn't have a parent, delete it directly
      await Blog.deleteOne({ _id: blogId });
    }

    res.json({ message: "blog deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

export async function updateBlog(req, res) {
  const blogId = req.params.blogId;
  const { title, content } = req.body;

  try {
    const blogId = req.params.blogId;
    const { title, content } = req.body;

    try {
      const blog = await Blog.findByIdAndUpdate(
        blogId,
        { title, content },
        { new: true }
      )
        .populate("author")
        .populate("comments")
        .populate({
          path: "comments",
          populate: { path: "postedBy", select: "name" }, // Populate the postedBy field in comments
        });

      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }
      res.status(200).json({ message: "Blog updated successfully", blog });
    } catch (error) {
      console.error("Error updating blog:", error);
      res.status(500).json({ message: "Failed to update blog" });
    }
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({ message: "Failed to update blog" });
  }
}

// Update Profile Function in your backend controller

export async function updateProfile(req, res) {
  try {
    const { userId, name, college, company, linkedin } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, college, company, linkedin },
      { new: true, select: 'name profilePicture college company linkedin' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
}


export async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
    user.otp = otp;
    user.otpExpiration = Date.now() + 3600000; // OTP valid for 1 hour
    await user.save();

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL, // Your email
        pass: process.env.EMAIL_PASSWORD, // Your email password
      },
    });

    // Send email
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'OTP sent' });
  } catch (error) {
    console.error('Failed to send OTP:', error); // Log the error
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request data:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
}

export async function resetPassword(req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.otp !== req.body.otp || Date.now() > user.otpExpiration) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiration = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
}


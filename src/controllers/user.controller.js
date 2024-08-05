import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import sendMail from "../utils/SendMail.js";
import jwt from "jsonwebtoken";
import crypto from 'crypto';



// Helper function to generate tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        return { accessToken, refreshToken };
    } catch (error) {
        throw new Error(`Something went wrong while generating tokens: ${error.message}`);
    }
};

//Register Function
const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    if ([fullName, email, password].some((field) => field?.trim() === "")) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const existedUser = await User.findOne({ email })

    if (existedUser) {
        return res.status(400).json({ message: 'User with email already exists.' });
    }

    const user = await User.create({
        fullName,
        email,
        password
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        return res.status(500).json({ message: 'Something went wrong while registering the user.' });
    }

    return res.status(201).json(
        { status: 201, data: createdUser, message: "User registered successfully" }
    );
});

//Login Function
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // const email = "talha.kh18@gmail.com"
    // const password = "talhakhawaja"

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'User does not exist' });
        
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid user credentials' });
        
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: false,
        secure: process.env.NODE_ENV,
    };


    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            { status: 200, data: { user: loggedInUser, accessToken, refreshToken }, message: "User logged in successfully" }
        );
});

//Logout Function
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json({ status: 200, data: {}, message: "User logged out" });
});

//forgot password
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = crypto.randomInt(10000, 100000).toString();
        const token = jwt.sign({ email, otp }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
        
        await sendMail(
            user.email,
            'Password Reset',
            `You are receiving this email because you have requested to reset your password. Please use the following OTP to reset your password: ${otp}.`
        );

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV
        }
        
        res
            .status(200)
            .cookie('resetToken', token, options)
            .json({ message: 'OTP has been sent to your email.' });

    } catch (error) {
        res.status(500).json({ message: 'An error occurred' });
    }
});

//verify otp
const verifyOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const token = req.cookies.resetToken;

    if (!token) {
        return res.status(400).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (decoded.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        res.status(200).json({ message: 'OTP verified' });
    } catch (error) {
        res.status(400).json({ message: 'Token is invalid or has expired' });
    }
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
    const { password, email } = req.body;
  
    try {

      const user = await User.findOne({email});

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      user.password = password;
  
      await user.save();
  
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(400).json({ message: 'error while updating' });
    }
  });

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly: false,
            secure: process.env.NODE_ENV,
        };

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                { status: 200, data: { accessToken, refreshToken: newRefreshToken }, message: "Access token refreshed" }
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json({ status: 200, data: {}, message: "Password changed successfully" });
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json({ status: 200, data: req.user, message: "User fetched successfully" });
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { fullName, email } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json({ status: 200, data: user, message: "Account details updated successfully" });
});

//Exporting functions
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    forgotPassword,
    verifyOtp,
    resetPassword
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import sendMail from "../utils/SendMail.js";
import jwt from "jsonwebtoken";
import crypto from 'crypto';

// Helper functions....

// To generate tokens
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

// Route functions....

// Register Function
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

// Login Function
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });

    if (!user)
        return res.status(404).json({ message: 'User does not exist' });

    if (!user.email_verified)
        return res.status(402).json({ message: 'User is not verified' });

    let isPasswordValid = false
    if (!user.via_google) {
        isPasswordValid = await user.isPasswordCorrect(password);
    }

    if (!isPasswordValid)
        return res.status(401).json({ message: 'Invalid user credentials' });

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

// Logout Function
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

const googleSignup = asyncHandler(async (req, res) => {
    const { email, name } = req.googleUser;

    try {

        // Check if user already exists
        let existedUser = await User.findOne({ email });

        if (existedUser) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Create a new user
        const user = await User.create({
            fullName: name,
            email,
            email_verified: true, // Assuming the email is verified by Google
            via_google: true
        });

        const createdUser = await User.findById(user._id).select('-password -refreshToken');

        if (!createdUser) {
            return res.status(500).json({ message: 'User registration failed' });
        }

        // Respond to the client
        return res.status(201).json({
            status: 201,
            data: createdUser,
            message: "User registered successfully"
        });

    } catch (error) {
        console.error('Error during Google sign-up:', error);
        return res.status(400).json({ message: 'Google sign-up failed', error: error.message });
    }
});

const googleSignin = asyncHandler(async (req, res) => {
    const { email, name } = req.googleUser;

    try {

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                fullName: name,
                email,
                email_verified: true,
                via_google: true
            });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

        const loggedInUser = await User.findById(user._id).select(" -refreshToken");

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

    } catch (error) {
        console.error('Google sign-in error:', error);
        res.status(400).json({ message: 'Google sign-in failed' });
    }
});

// send code 
const sendOTP = asyncHandler(async (req, res) => {
    const { email, action } = req.body;

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
            action === 'forgot' ?
                `You are receiving this email because you have requested to reset your password. Please use the following OTP to reset your password: ${otp}.` :
                `Please complete your account verification by using the following OTP: ${otp}.`
        );

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV
        }

        res
            .status(200)
            .cookie('verificationToken', token, options)
            .json({ message: 'OTP has been sent to your email.' });

    } catch (error) {
        res.status(500).json({ message: 'An error occurred' });
    }
});

// Verify otp
const verifyOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const token = req.cookies.verificationToken;

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
    const token = req.cookies.verificationToken;

    if (!token) {
        return res.status(400).json({ message: 'No token provided' });
    }

    try {

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (decoded.email !== email)
            return res.status(400).json({ message: 'unauth email' });

        const user = await User.findOne({ email });

        if (!user)
            return res.status(404).json({ message: 'User not found' });

        user.password = password;

        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(400).json({ message: 'error while updating' });
    }
});

// Change Current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect)
        res.status(400).json({ message: 'Invalid Current password' });



    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json({ status: 200, data: {}, message: "Password changed successfully" });
});

// Get Current User
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json({ status: 200, data: req.user, message: "User fetched successfully" });
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

// To Verify Email Account 
const verifyAccount = asyncHandler(async (req, res) => {
    try {
        const { email } = req.body;
        const token = req.cookies.verificationToken;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!token) {
            return res.status(400).json({ message: 'No token provided' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (decoded.email !== email) {
            return res.status(400).json({ message: 'Unauthorized email' });
        }

        // Update the user's email verification status
        const user = await User.findOneAndUpdate(
            { email },
            { $set: { email_verified: true } },
            { new: true } // Return the updated user
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({ status: 200, message: "Account verified successfully" });
    } catch (error) {
        // Handle errors
        console.error('Error verifying account:', error);
        return res.status(500).json({ message: 'An error occurred while verifying the account' });
    }
});


//Exporting functions
export {
    registerUser,
    loginUser,
    logoutUser,
    googleSignup,
    googleSignin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    verifyAccount,
    sendOTP,
    verifyOtp,
    resetPassword
};

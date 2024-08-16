import { Router } from "express";
import {
    loginUser,
    logoutUser,
    registerUser,
    googleSignup,
    googleSignin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    verifyAccount,
    sendOTP,
    verifyOtp,
    resetPassword
} from "../controllers/user.controller.js";
import { verifyJWT, verifyGoogleToken } from "../middlewares/auth.middleware.js";


const router = Router()

router.route("/register").post(registerUser)
router.route("/login").post(loginUser)
router.route("/send-code").post(sendOTP)
router.route("/verify-otp").post(verifyOtp)
router.route("/reset-password").post(resetPassword)
router.route("/verify-account").post(verifyAccount)

router.route('/google-signup').post(verifyGoogleToken, googleSignup);
router.route('/google-signin').post(verifyGoogleToken, googleSignin);

//secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)

router.route("/refresh-token").post(refreshAccessToken)


export default router
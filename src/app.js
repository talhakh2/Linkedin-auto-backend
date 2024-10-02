import express from "express"
import cookieParser from "cookie-parser"
import cors from 'cors'


const app = express()

app.use(cors({origin: process.env.CORS_ORIGIN, credentials: true}))
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes import
import userRouter from './routes/user.route.js'
import campaignRouter from './routes/campaigns.routes.js'
import campaignStatesRouter from './routes/campaignStates.routes.js'
import stripeCheckoutRouter from './routes/stripeCheckout.route.js'

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/campaign", campaignRouter)
app.use("/api/v1/campaignStates", campaignStatesRouter)
app.use("/api/v1/checkout", stripeCheckoutRouter)



app.get('/api/check', (req, res) => {
    res.status(200).json({ message: 'Connection successful' });
});


export { app }
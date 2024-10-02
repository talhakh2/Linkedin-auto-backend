import { Router } from "express";
import {
    start_campaign,
    stop_campaign,
} from "../controllers/campaignStates.controller.js";



const router = Router()

router.post('/start-campaign', start_campaign);
router.post('/stop-campaign', stop_campaign);


export default router
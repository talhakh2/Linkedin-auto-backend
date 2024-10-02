import { Router } from "express";
import {
    save_campaign,
    getCampaignsByUserId,
    getConnectionCampaignData,
    getCommentCampaignData,
    updateCommentCampaignComment,
    updateCommentCampaignStaus
} from "../controllers/campaigns.controller.js";



const router = Router()

router.post('/save-campaign', save_campaign);

router.get('/getAll/:userId', getCampaignsByUserId);
router.get('/getConnectionCampaignData/:campaign_id', getConnectionCampaignData);
router.get('/getCommentCampaignData/:campaign_id', getCommentCampaignData);

router.put('/updateCommentCampaignStatus/:campaignId/posts/:postId', updateCommentCampaignStaus)
router.put('/updateCommentCampaignComment/:campaignId/posts/:postId', updateCommentCampaignComment)



export default router
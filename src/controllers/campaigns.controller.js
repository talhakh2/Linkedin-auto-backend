
import { asyncHandler } from "../utils/asyncHandler.js";
import Campaign from "../models/connectionCampaign.model.js";
import CommentCampaign from "../models/commentCampaign.model.js";

// Save campaign
const save_campaign = asyncHandler(async (req, res) => {
    try {
        const { userId, name, createdOn, users, Connection_Request_Message, Follow_up_Message, dm_time, posts } = req.body;

        // Validate the required fields
        if (!name || !createdOn) {
            return res.status(400).json({ message: "Name and createdOn are required." });
        }

        // If posts exist in the request body, handle it as a "post campaign"
        if (posts && posts.length > 0) {
            const commentCampaign = await CommentCampaign.create({
                userId,
                name,
                createdOn,
                posts,           // Save posts specifically for post campaigns
                comment: req.body.comment || '', // Save the comment
                isToggled: req.body.isToggled || false,
            });

            return res.status(201).json({ message: "Post campaign created successfully", commentCampaign });
        }

        // Otherwise, proceed with the standard campaign creation
        const newCampaign = await Campaign.create({
            userId,
            name,
            createdOn,
            users,
            Connection_Request_Message,
            Follow_up_Message,
            dm_time,
        });

        res.status(201).json({ message: "Standard campaign created successfully", newCampaign });
    } catch (error) {
        res.status(500).json({ message: "Error saving campaign", error: error.message });
    }
});

// get all campaigns by user ID
const getCampaignsByUserId = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const campaigns = await Campaign.find({ userId }); // Adjust the field name based on your schema
    const commentCampaigns = await CommentCampaign.find({ userId });
    res.status(201).json({ campaigns, commentCampaigns });
});

// get Connection Campaign data by campaign ID
const getConnectionCampaignData = asyncHandler(async (req, res) => {
    const { campaign_id } = req.params;
    const invitedUsers = await Campaign.find({ _id: campaign_id }); // Adjust the field name based on your schema
    res.status(201).json({ invitedUsers: invitedUsers });
});

// get Comment Campaign data by campaign ID
const getCommentCampaignData = asyncHandler(async (req, res) => {
    const { campaign_id } = req.params;
    const commentCampaignData = await CommentCampaign.find({ _id: campaign_id }); // Adjust the field name based on your schema
    res.status(201).json({ commentCampaignData: commentCampaignData });
});

// update Status by Post ID of specific commentcampaign
const updateCommentCampaignStaus = asyncHandler(async (req, res) => {
    const { campaignId, postId } = req.params;
    const { action } = req.body;

    try {
        const updatedCampaign = await CommentCampaign.findOneAndUpdate(
            { _id: campaignId, 'posts._id': postId },
            { $set: { 'posts.$.action': action } },
            { new: true }
        );

        if (!updatedCampaign) {
            return res.status(404).send('Campaign or post not found');
        }

        res.status(200).json(updatedCampaign);
    } catch (error) {
        console.error('Error updating post action:', error);
        res.status(500).send('Server error');
    }
});

// Update comment for a specific comment campaign
const updateCommentCampaignComment = asyncHandler(async (req, res) => {
    const { campaignId, postId } = req.params;
    const { comment } = req.body;

    try {
        const updatedCampaign = await CommentCampaign.findOneAndUpdate(
            { _id: campaignId, 'posts._id': postId },
            { $set: { 'posts.$.comment': comment } },
            { new: true }
        );

        if (!updatedCampaign) {
            return res.status(404).send('Campaign or post not found');
        }

        res.status(200).json(updatedCampaign);
    } catch (error) {
        console.error('Error updating post action:', error);
        res.status(500).send('Server error');
    }
});


export { save_campaign, getCampaignsByUserId, getConnectionCampaignData, getCommentCampaignData, updateCommentCampaignStaus,  updateCommentCampaignComment};

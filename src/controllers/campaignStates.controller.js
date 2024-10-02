import axios from 'axios';
import { asyncHandler } from "../utils/asyncHandler.js";
import CampaignState from "../models/campaignStates.model.js";
import Campaign from "../models/connectionCampaign.model.js";
import CommentCampaign from "../models/commentCampaign.model.js";

const API_BASE_URI = process.env.API_BASE_URI;

// delays
const DAILY_INTERVAL = 5 * 60 * 1000;  // 5 minutes interval for daily campaign
const MAX_RANDOM_BATCH_DELAY = 3 * 60 * 1000;  // Maximum delay of 3 minutes for batch

// Utility function to create data batches
const createBatches = (data, batchSize) => {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
    }
    return batches;
};

// Save campaign state after processing each batch
const saveCampaignState = async (campaignState) => {
    try {
        await campaignState.save();
    } catch (error) {
        console.error(`Error saving campaign state: ${error.message}`);
    }
};

// Error logging helper
const logError = (message, error) => {
    console.error(`${message}: ${error.message}`);
};

// Handle Comment Campaign Logic
const handleCommentCampaign = async (data, account_id, campaign_id, campaignState) => {
    const delay = Math.random() * MAX_RANDOM_BATCH_DELAY;
    const timeoutId = setTimeout(async () => {
        if (data.action === "Approved"){
            try {
                console.log(`Posting comment on Post ID: ${data.id} after ${(delay / 1000).toFixed(1)} seconds`);
                const response = await axios.post(`${API_BASE_URI}/comment`, {
                    account_id,
                    post_id: data.id,
                    text: data.comment,
                });
                console.log(`Comment posted: ${JSON.stringify(response.data)}`);

                // Update post status to true in the database
                await CommentCampaign.findOneAndUpdate(
                    { _id: campaign_id, 'posts._id': data._id },
                    { $set: { 'posts.$.status': 'Sent' } },
                    { new: true }
                );
                console.log(`Updated status for post ID: ${data.id}`);
            } catch (err) {
                // Update post status to true in the database
                await CommentCampaign.findOneAndUpdate(
                    { _id: campaign_id, 'posts._id': data._id },
                    { $set: { 'posts.$.status': 'Post not found' } },
                    { new: true }
                );
                logError('Error posting comment', err);
            } finally {
                campaignState.requestsSentToday++;
                campaignState.processedPosts.push(data.id);
                await saveCampaignState(campaignState);
            }
        } else {
            console.log(`Comment having Post ID: ${data.id} is not approved yet, waiting for approval `);
        }
    }, delay);
    if (data.action === "Approved") {
        // Calculate the future date and time after the delay
        const sendTime = new Date(Date.now() + delay); // `delay` is in milliseconds
    
        // Update post status to include the exact time when the post will be sent
        await CommentCampaign.findOneAndUpdate(
            { _id: campaign_id, 'posts._id': data._id },
            { $set: { 
                'posts.$.status': `Send at ${sendTime.toLocaleString()}`, // Store the exact time
                'posts.$.sendTime': sendTime // You can also store the timestamp separately if needed
            }},
            { new: true }
        );
    }
    
    campaignState.timeoutIds.push(timeoutId);  // Store timeoutId to clear later when user stops the campaign
};

// Handle Connection Campaign Logic
const handleConnectionCampaign = async (data, account_id, message, campaign_id, campaignState, dm_time, Follow_up_Message) => {
    const delay = Math.random() * MAX_RANDOM_BATCH_DELAY;
    const timeoutId = setTimeout(async () => {
        try {
            if (data.public_identifier !== null){
                console.log(`Sending connection request to ${data.public_identifier} after ${(delay / 1000).toFixed(1)} seconds`);
                const response = await axios.post(`${API_BASE_URI}/send-connection-request`, {
                    account_id,
                    identifier: data.public_identifier,
                    message,
                });
                console.log(`Connection request sent: ${JSON.stringify(response.data)}`);

                // Update user status in the database
                await Campaign.findOneAndUpdate(
                    { _id: campaign_id, 'users._id': data._id },
                    { $set: { 'users.$.status': true } },
                    { new: true }
                );
                console.log(`Updated status for user ${data.public_identifier}`);

                // Schedule follow-up message
                const followUpDelay = dm_time * 60 * 1000;  // Convert dm_time to minutes
                setTimeout(async () => {
                    try {
                        console.log(`Sending follow-up message to ${data.public_identifier} after ${dm_time} minutes`);
                        const dmResponse = await axios.post(`${API_BASE_URI}/dm`, {
                            account_id,
                            identifier: data.public_identifier,
                            text: Follow_up_Message,
                        });
                        console.log(`Follow-up message sent: ${JSON.stringify(dmResponse.data)}`);
                    } catch (err) {
                        logError('Error sending follow-up message', err);
                    }
                }, followUpDelay);
            }
        } catch (err) {
            logError('Error sending connection request', err);
        } finally {
            campaignState.requestsSentToday++;
            campaignState.processedUsers.push(data.public_identifier);
            await saveCampaignState(campaignState);
        }
    
    }, delay);
    campaignState.timeoutIds.push(timeoutId);  // Store timeoutId to clear later when user stops the campaign
};

// Process batch of data (users/posts)
const processBatch = async (batch, type, campaignDetails, campaignState) => {
    console.log("Total requests in this batch: ", batch.length);
    for (const data of batch) {
        if (campaignState.requestsSentToday >= 25) {
            console.log('Daily limit reached, halting further requests.');
            return;
        }

        try {
            if (type === "Commenting") {
                await handleCommentCampaign(
                    data,
                    campaignDetails.account_id,
                    campaignDetails.campaign_id,
                    campaignState
                );
            } else {
                await handleConnectionCampaign(
                    data,
                    campaignDetails.account_id,
                    campaignDetails.message,
                    campaignDetails.campaign_id,
                    campaignState,
                    campaignDetails.dm_time,
                    campaignDetails.Follow_up_Message
                );
            }
        } catch (error) {
            logError(`Error processing batch for campaign ${campaignDetails.campaign_id}`, error);
        }
    }
};

// Main Campaign Processing
const processCampaign = async (type, campaignDetails, campaignState) => {
    try {
        const remainingPosts = campaignDetails.posts?.filter(post => !campaignState.processedPosts.includes(post.id)) || [];
        const remainingUsers = campaignDetails.users?.filter(user => !campaignState.processedUsers.includes(user.public_identifier)) || [];

        const dataBatches = createBatches(type === "Commenting" ? remainingPosts : remainingUsers, 25);
        console.log("Batches Left: ", dataBatches.length);
        for (const batch of dataBatches) {
            if (campaignState.requestsSentToday >= 25) {
                console.log('Daily limit reached, scheduling next batch.');
                setTimeout(() => {
                    campaignState.requestsSentToday = 0;
                    processBatch(batch, type, campaignDetails, campaignState);
                }, DAILY_INTERVAL);
                return;
            }
            await processBatch(batch, type, campaignDetails, campaignState);
        }

        if ((remainingPosts.length || remainingUsers.length) && dataBatches.length > 1) {
            console.log('Next Batch is scheduled for tomorrow');
            setTimeout(() => processCampaign(type, campaignDetails, campaignState), DAILY_INTERVAL);
        } else if (dataBatches.length === 0){
            console.log('All Batches are processed');
        }
    } catch (error) {
        logError(`Error processing campaign ${campaignDetails.campaign_id}`, error);
    }
};

// Restart campaigns on server start
const restartCampaignsOnServerStart = asyncHandler(async () => {
    console.log("Attempting to restart all running campaigns on server start, if any..."); // Add this line
    try {
        const runningCampaigns = await CampaignState.find({ isRunning: true });

        for (const campaignState of runningCampaigns) {
            console.log(`Restarting campaign: ${campaignState.campaign_id}`);

            let campaignDetails;
            let type;

            // Check if the campaign is a Commenting campaign
            const commentCampaign = await CommentCampaign.findById(campaignState.campaign_id);
            if (commentCampaign) {
                campaignDetails = {
                    campaign_id: commentCampaign._id,
                    account_id: 'HuHnWG2vSwicMoYZhVNTvg',
                    posts: commentCampaign.posts,
                };
                type = "Commenting";
            }

            // Check if the campaign is a Connection campaign
            const connectionCampaign = await Campaign.findById(campaignState.campaign_id);
            if (connectionCampaign) {
                campaignDetails = {
                    campaign_id: connectionCampaign._id,
                    account_id: 'HuHnWG2vSwicMoYZhVNTvg',
                    users: connectionCampaign.users,
                    message: connectionCampaign.message,
                    Follow_up_Message: connectionCampaign.Follow_up_Message,
                    dm_time: connectionCampaign.dm_time,  // Delay for follow-up messages
                };
                type = "Connection";
            }

            // If campaignDetails are found, start processing
            if (campaignDetails) {
                processCampaign(type, campaignDetails, campaignState);
            } else {
                console.log(`No campaign details found for campaign ID: ${campaignState.campaign_id}`);
            }
        }
    } catch (error) {
        logError('Error restarting campaigns on server start', error);
    }
});


// Routes Controller

// Start Campaign Controller
const start_campaign = asyncHandler(async (req, res) => {
    try {
        const { campaign_id, account_id, type, posts, users, message, Follow_up_Message, dm_time } = req.body;
        let campaignState = await CampaignState.findOne({ campaign_id });

        // Toggle the campaign in the database
        if (type === "Commenting") {
            await CommentCampaign.findByIdAndUpdate(campaign_id, { isToggled: true });
        } else {
            await Campaign.findByIdAndUpdate(campaign_id, { isToggled: true });
        }

        // Initialize or resume campaign state
        if (!campaignState) {
            console.log(`Starting new campaign: ${campaign_id}`);
            campaignState = new CampaignState({
                campaign_id,
                account_id,
                timeoutIds: [],
                isRunning: true,
                requestsSentToday: 0,
                lastResetDate: new Date(),
                processedPosts: [],
                processedUsers: [],
            });
        } else {
            console.log(`Resuming campaign: ${campaign_id}`);
            campaignState.isRunning = true;
            campaignState.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        }

        const campaignDetails = { campaign_id, account_id, posts, users, message, Follow_up_Message, dm_time };
        processCampaign(type, campaignDetails, campaignState);

        console.log(`Campaign ${campaign_id} scheduled successfully.`);
        res.status(200).json({ success: true, message: `Campaign ${campaign_id} scheduled successfully!` });
    } catch (error) {
        logError('Error starting campaign', error);
        res.status(500).json({ success: false, message: 'Error starting campaign' });
    }
});

// Stop Campaign Controller
const stop_campaign = asyncHandler(async (req, res) => {
    try {
        const { campaign_id, type } = req.body;

        // Log the incoming request data
        console.log(`Stopping campaign with ID: ${campaign_id}, Type: ${type}`);

        // Toggle the campaign in the database
        let updateResult;
        if (type === "Commenting") {
            updateResult = await CommentCampaign.findByIdAndUpdate(campaign_id, { isToggled: false });
        } else {
            updateResult = await Campaign.findByIdAndUpdate(campaign_id, { isToggled: false });
        }

        // Check if the update was successful
        if (!updateResult) {
            console.log(`Campaign not found for ID: ${campaign_id}`);
            return res.status(404).json({ success: false, message: `Campaign ${campaign_id} not found.` });
        }

        // Stop the running campaign
        const campaignState = await CampaignState.findOne({ campaign_id });
        if (campaignState) {
            console.log(`Campaign state found for ID: ${campaign_id}, isRunning: ${campaignState.isRunning}`);
            if (campaignState.isRunning) {
                // Clear any active timeouts
                if (campaignState.timeoutIds) {
                    campaignState.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
                    console.log(`Cleared timeouts for campaign ID: ${campaign_id}`);
                }

                // Update the campaign state to not running
                campaignState.isRunning = false;
                campaignState.timeoutIds = [];
                await campaignState.save();
                console.log(`Campaign with ID: ${campaign_id} stopped successfully.`);
                return res.status(200).json({ success: true, message: `Campaign ${campaign_id} stopped successfully!` });
            }
        }

        res.status(200).json({ success: true, message: `Campaign ${campaign_id} is not running.` });
    } catch (error) {
        logError('Error stopping campaign', error);
        res.status(500).json({ success: false, message: 'Error stopping campaign' });
    }
});



export { start_campaign, stop_campaign, restartCampaignsOnServerStart };



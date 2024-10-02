import mongoose from 'mongoose';

const campaignStateSchema = new mongoose.Schema({
    campaign_id: { type: String, required: true, unique: true },
    account_id: { type: String, required: true },
    timeoutIds: { type: [Number], default: [] },
    isRunning: { type: Boolean, default: true },
    lastProcessedIndex: { type: Number, default: 0 },
    processedUsers: { type: [String], default: [] },
    processedPosts: { type: [String], default: [] },
    requestsSentToday: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: new Date() },
}, { timestamps: true });

const CampaignState = mongoose.model('CampaignState', campaignStateSchema);

export default CampaignState;
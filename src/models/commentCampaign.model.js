import mongoose from 'mongoose';

// Define the user schema
const postSchema = new mongoose.Schema({
    headline: {
        type: String
    },
    id: {
        type: String,
        default: null
    }, //post id
    name: {
        type: String,
        required: true
    },
    share_url: {
        type: String,
        required: true
    },
    text: {
        type: String,
    },
    comment: {
        type: String,
        default: '' //AI Comment Generated
    },

    action: {
      type: String,
      default: 'Pending'
    },
    status: {
        type: String,
        default: 'Waiting for approval'
    }
});

const postCampaignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true,
    },
    name: {
        type: String,
        required: true,
    }, // campaign name
    createdOn: {
        type: Date,
        default: Date.now,
    },
    posts: {
        type: [postSchema], // List of posts for the campaign
        default: [],
    },
    isToggled: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        default: 'Commenting'
    }

});

const CommentCampaign = mongoose.model('CommentCampaign', postCampaignSchema);
export default CommentCampaign;

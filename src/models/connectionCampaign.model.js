import mongoose from 'mongoose';

// Define the user schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    headline: {
        type: String
    },
    status: {
        type: Boolean,
        default: false
    },
    public_identifier: {
        type: String,
        default: null
    }
});

// Define the campaign schema
const campaignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    users: {
        type: [userSchema], // Use the userSchema to define the structure of the users array
        default: []
    },
    Connection_Request_Message: {
        type: String,
        default: ''
    },
    Follow_up_Message: {
        type: String,
        default: ''
    },
    dm_time: {
        type: Number,
        default: 0
    },
    isToggled: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        default: 'Connection'
    }
});

// Export the Campaign model
const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;

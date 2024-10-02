import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';
import { restartCampaignsOnServerStart } from './controllers/campaignStates.controller.js'; // Adjust the import path accordingly

dotenv.config({
    path: '../env'
});

connectDB()
    .then(async () => {
        // Start the server
        app.listen(process.env.PORT || 3000, async () => { 
            console.log(`Server is Running on PORT: ${process.env.PORT}`); 
            try {
                await restartCampaignsOnServerStart(); // Ensure that campaigns are restarted after the server starts
            } catch (error) {
                console.error("Error restarting campaigns: ", error);
            }
        });
    })
    .catch((error) => {
        console.log("MongoDB Connection ERROR (src): ", error);
    });

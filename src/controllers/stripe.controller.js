import stripe from 'stripe';
import { User } from '../models/user.model.js';
import sendMail from "../utils/SendMail.js";

// const stripeInstance = stripe("sk_test_51P7LLsLwSbXuk7vlss14tXpYT1bpq93ocxlpn3J72HGpFqBQyjzprEc4RfdlTgUnvuRXYF7dK8I14te1reVkqafn00JTwjHRIC");
const stripeInstance = stripe("sk_test_51MWxXhJVh0QyQWfRDxE9VXrXQIDNoJT2D2R6QxyBqUPViWMX4ZdzJ3mLbtdD6iwNLEFuiD1pQp764hIYwVJQboMP00ad5SCDwQ");

export const StarterSessionCheckout = async (req, res) => {
    const { userId } = req.query;

    try {
        const user = await User.findById(userId);
        const customerId = user.stripeCustomerId;

        if (!customerId) {
            return res.json({ status: 200, message: "Activate Free Trial" });
        } else {
            console.log("Customer ID DB:", customerId);

            // Retrieve user's active subscriptions
            const subscriptions = await stripeInstance.subscriptions.list({
                customer: customerId,
                status: 'active',
                expand: ['data.default_payment_method'],
            });

            console.log("Subscriptions:", subscriptions);

            // If the user has an active subscription, cancel it
            if (subscriptions.data.length > 0) {
                const currentSubscription = subscriptions.data[0]; // Assuming only one subscription is active
                await stripeInstance.subscriptions.cancel(currentSubscription.id);
                console.log(`Canceled existing subscription: ${currentSubscription.id}`);
                
                // Optionally clear the customer ID if you want to remove it
                user.plan = "Free"
                user.stripeCustomerId = null;
                await user.save();
            } else {
                console.log("No active subscriptions found for this customer.");
            }
            
            // Proceed with the logic to activate the free trial
            return res.json({ status: 200, message: "Current Plan Canceled, and activated free trial" });
        }

    } catch (error) {
        console.error('Error handling subscription:', error);
        return res.status(500).json({ error: 'Failed to process request' });
    }
};


export const SessionCheckout = async (req, res) => {
    const { userId, plan, priceId } = req.query;

    try {
        const user = await User.findById(userId);
        const customerId = user.stripeCustomerId;

        if (!customerId) {

            const customer = await stripeInstance.customers.create({
                email: user.email,
                name: user.fullName,
            });

            console.log("New ID: ", customer.id);

            // const user = await User.findById(userId);
            user.stripeCustomerId = customer.id;  // Save the Stripe customer ID
            await user.save();

        } else {
            console.log("Customer ID DB:", customerId);

            // Retrieve user's active subscriptions
            const subscriptions = await stripeInstance.subscriptions.list({
                customer: customerId,
                status: 'active',
                expand: ['data.default_payment_method'],
            });

            console.log("Subscriptions:", subscriptions);

            // If the user has an active subscription, cancel it
            if (subscriptions.data.length > 0) {
                const currentSubscription = subscriptions.data[0]; // Assuming only one subscription is active
                await stripeInstance.subscriptions.cancel(currentSubscription.id);
                console.log(`Canceled existing subscription: ${currentSubscription.id}`);
            } else {
                console.log("No active subscriptions found for this customer.");
            }
        }

        const session = await stripeInstance.checkout.sessions.create({
            mode: 'subscription',
            success_url: `${process.env.BASE_URI}/success?sessionId={CHECKOUT_SESSION_ID}&plan=${plan}`,
            cancel_url: `${process.env.BASE_URI}`,
            line_items: [
                {
                    price: priceId,  // Use Stripe Price ID for subscriptions
                    quantity: 1,
                },
            ],
            metadata: {
                plan: plan,
                userId: userId
            },
            customer: customerId, // Attach the customer to the session
        });

        return res.json({ session: session });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return res.status(500).json({ error: "Failed to create checkout session" });
    }
};

export const completePayment = async (req, res) => {
    const sessionId = req.query.sessionId;

    try {
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
        const userData = session.metadata;

        const user = await User.findById(userData.userId);
        user.plan = userData.plan;
        user.planExpiryDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // Set plan expiry date for 30 days from now

        await user.save();

        return res.json({ success: true });
    } catch (error) {
        console.error('Error completing payment:', error);
        return res.status(500).json({ error: 'Failed to complete payment' });
    }
};

export const EnterprisePlan = async (req, res) => {
    const { userId, email, fullName } = req.query;

    try {
        await sendMail(
            'hugozhan0802@gmail.com',
            'Custom Plan Request',
            `Customer Name: ${fullName} and Email: ${email} wants an enterprise plan, reach out to them to discuss the deal.`
        );

        return res.json({ success: true });
    } catch (error) {
        console.error('Error sending custom plan request email:', error);
        return res.status(500).json({ error: 'Failed to send custom plan request' });
    }
};

// src/services/payment/stripe.js
import Stripe from "stripe";

// Lazy-loaded Stripe client
let stripe = null;

// Initialize Stripe client when needed
const getStripeClient = () => {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

export const createCustomer = async (userData) => {
  try {
    const stripeClient = getStripeClient();

    // Ensure userId is converted to string (MongoDB ObjectId needs conversion)
    const userIdString = userData.id?.toString() || String(userData.id || "");

    const customerData = {
      email: userData.email,
      name: userData.name,
      metadata: {
        userId: userIdString,
      },
    };

    // Add billing address for Indian regulations (required for export transactions)
    // If address is provided, use it; otherwise use default address
    if (userData.address) {
      customerData.address = {
        line1: userData.address.line1 || "Not provided",
        line2: userData.address.line2 || null,
        city: userData.address.city || "Not provided",
        state: userData.address.state || null,
        postal_code:
          userData.address.postalCode ||
          userData.address.postal_code ||
          "000000",
        country: userData.address.country || "US", // Default to US if not provided
      };
    } else {
      // Default address for Indian regulations (can be updated later)
      customerData.address = {
        line1: "Not provided",
        city: "Not provided",
        postal_code: "000000",
        country: "US", // Default country code (ISO-3166)
      };
    }

    const customer = await stripeClient.customers.create(customerData);
    return customer;
  } catch (error) {
    throw new Error(`Stripe Customer Creation Error: ${error.message}`);
  }
};

export const createPaymentIntent = async (
  customerId,
  amount,
  currency = "usd",
  metadata = {},
  description = null
) => {
  try {
    const stripeClient = getStripeClient();
    const paymentIntentData = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Add description if provided (required for Indian Stripe accounts)
    if (description) {
      paymentIntentData.description = description;
    }

    const paymentIntent = await stripeClient.paymentIntents.create(
      paymentIntentData
    );
    return paymentIntent;
  } catch (error) {
    throw new Error(`Stripe PaymentIntent Error: ${error.message}`);
  }
};

export const createSubscription = async (customerId, priceId) => {
  try {
    const stripeClient = getStripeClient();
    const subscription = await stripeClient.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });
    return subscription;
  } catch (error) {
    throw new Error(`Stripe Subscription Error: ${error.message}`);
  }
};

export const handleWebhook = async (payload, signature) => {
  try {
    const stripeClient = getStripeClient();
    const event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    throw new Error(`Webhook Error: ${error.message}`);
  }
};

import SubscriptionPlan from "../../models/subscriptionPlan.model.js";
import { safeLogger as logger } from "../../utils/logger.js";

// Optional: force-reset PayPal IDs (useful once when rotating sandbox/live or fixing bad IDs)
const forceResetPayPalIds = process.env.FORCE_RESET_PAYPAL_IDS === "true";

// Initialize default subscription plans
export const initializeSubscriptionPlans = async () => {
  try {
    logger.info("🔄 Initializing subscription plans...");

    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans > 0) {
      logger.info("✅ Subscription plans already exist");
      // Update existing plans to match latest configuration
      await updateExistingPlans();
      return;
    }

    // Create default plans
    const defaultPlans = [
      {
        name: "free",
        displayName: "Free Plan",
        description:
          "Perfect for trying out our AI services with basic features - Always free!",
        price: {
          monthly: 0,
          yearly: 0,
          currency: "USD",
        },
        type: "free",
        features: {
          aiTextWriter: {
            wordsPerDay: 500,
            requestsPerDay: 10,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 3,
            requestsPerDay: 3,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 1,
            requestsPerDay: 1,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 10,
            requestsPerDay: 10,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 1, // Free plan: 1 chatbot only
            messagesPerDay: 20, // 20 queries/day = ~10 queries/hour
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 10,
            maxFiles: 5,
            runsPerDay: 5,
            aiCallsPerDay: 5,
            maxRunTimeoutMs: 15000,
          },
          prioritySupport: false,
          apiAccess: false,
          customBranding: false,
          analytics: false,
        },
        status: "active",
        displayOrder: 1,
        isPopular: false,
      },
      {
        name: "basic",
        displayName: "Basic Plan",
        description:
          "Perfect for individuals and small teams getting started with AI",
        price: {
          monthly: 29, // Updated to match UI: $29/month
          yearly: 290, // ~$24.17/month with yearly discount
          currency: "USD",
        },
        type: "basic",
        features: {
          aiTextWriter: {
            wordsPerDay: 10000, // UI: 10,000 words/day
            requestsPerDay: 100,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 25, // Updated to match UI: 25 images/day
            requestsPerDay: 25,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 3,
            requestsPerDay: 3,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 100, // Updated to match UI: 100 searches/day
            requestsPerDay: 100,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 5,
            messagesPerDay: 500, // Updated to match UI: 500 messages/day
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 100,
            maxFiles: 50,
            runsPerDay: 50,
            aiCallsPerDay: 50,
            maxRunTimeoutMs: 20000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: false,
          analytics: true,
        },
        status: "active",
        displayOrder: 2,
        isPopular: true, // UI shows "Most Popular"
      },
      {
        name: "pro",
        displayName: "Pro Plan",
        description: "Advanced features for growing businesses and power users",
        price: {
          monthly: 79, // Updated to match UI: $79/month
          yearly: 790, // ~$65.83/month with yearly discount
          currency: "USD",
        },
        type: "pro",
        features: {
          aiTextWriter: {
            wordsPerDay: 50000, // UI: 50,000 words/day ✅
            requestsPerDay: 500,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 150, // UI: 150 images/day ✅
            requestsPerDay: 150,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 10,
            requestsPerDay: 10,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 500, // UI: 500 searches/day ✅
            requestsPerDay: 500,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 10,
            messagesPerDay: 3000, // UI: 3000 messages/day ✅
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 500,
            maxFiles: 200,
            runsPerDay: 200,
            aiCallsPerDay: 200,
            maxRunTimeoutMs: 25000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
        status: "active",
        displayOrder: 3,
        isPopular: false,
      },
      {
        name: "enterprise",
        displayName: "Enterprise Plan",
        description:
          "Unlimited access with premium support and custom branding",
        price: {
          monthly: 99.99,
          yearly: 999.99,
          currency: "USD",
        },
        type: "enterprise",
        features: {
          aiTextWriter: {
            wordsPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 999999999, // Enterprise: Unlimited chatbots
            messagesPerDay: 999999999, // Enterprise: Unlimited queries
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 1000,
            maxFiles: 500,
            runsPerDay: 500,
            aiCallsPerDay: 500,
            maxRunTimeoutMs: 30000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
        status: "active",
        displayOrder: 4,
        isPopular: false,
      },
      {
        name: "unlimited",
        displayName: "Unlimited Plan",
        description:
          "Unlimited access to all features - The ultimate plan for power users",
        price: {
          monthly: 149,
          yearly: 1490, // ~$124.17/month with yearly discount
          currency: "USD",
        },
        type: "enterprise", // Using enterprise type as it's the closest match
        features: {
          aiTextWriter: {
            wordsPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 999999999, // Unlimited chatbots
            messagesPerDay: 999999999, // Unlimited queries
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 999999999,
            maxFiles: 999999999,
            runsPerDay: 999999999,
            aiCallsPerDay: 999999999,
            maxRunTimeoutMs: 30000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
        status: "active",
        displayOrder: 5,
        isPopular: false,
      },
    ];

    // Insert all plans
    await SubscriptionPlan.insertMany(defaultPlans);

    logger.info("✅ Default subscription plans created successfully");
    logger.info(`📊 Created ${defaultPlans.length} subscription plans:`);
    defaultPlans.forEach((plan) => {
      logger.info(`   - ${plan.displayName}: $${plan.price.monthly}/month`);
    });
  } catch (error) {
    logger.error("❌ Error creating subscription plans:", error);
    throw error;
  }
};

/**
 * Update existing plans to match latest configuration
 * This ensures plans are synced with UI pricing
 */
const updateExistingPlans = async () => {
  try {
    logger.info("🔄 Updating existing subscription plans...");

    // Updated plan configurations (matching UI)
    const planUpdates = {
      free: {
        price: { monthly: 0, yearly: 0, currency: "USD" },
        features: {
          aiTextWriter: { wordsPerDay: 500, requestsPerDay: 10, enabled: true },
          aiImageGenerator: {
            imagesPerDay: 3,
            requestsPerDay: 3,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 1,
            requestsPerDay: 1,
            enabled: true,
          },
          aiSearch: { searchesPerDay: 10, requestsPerDay: 10, enabled: true },
          aiChatbot: {
            chatbotsPerAccount: 1,
            messagesPerDay: 20,
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 10,
            maxFiles: 5,
            runsPerDay: 5,
            aiCallsPerDay: 5,
            maxRunTimeoutMs: 15000,
          },
          prioritySupport: false,
          apiAccess: false,
          customBranding: false,
          analytics: false,
        },
      },
      basic: {
        price: { monthly: 29, yearly: 290, currency: "USD" }, // UI: $29/month
        features: {
          aiTextWriter: {
            wordsPerDay: 10000,
            requestsPerDay: 100,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 25,
            requestsPerDay: 25,
            enabled: true,
          }, // UI: 25 images/day
          aiSearch: { searchesPerDay: 100, requestsPerDay: 100, enabled: true }, // UI: 100 searches/day
          aiChatbot: {
            chatbotsPerAccount: 5,
            messagesPerDay: 500,
            enabled: true,
          }, // UI: 500 messages/day
          codeEditor: {
            enabled: true,
            maxStorageMb: 100,
            maxFiles: 50,
            runsPerDay: 50,
            aiCallsPerDay: 50,
            maxRunTimeoutMs: 20000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: false,
          analytics: true,
        },
        isPopular: true, // UI shows "Most Popular"
      },
      pro: {
        price: { monthly: 79, yearly: 790, currency: "USD" }, // UI: $79/month
        features: {
          aiTextWriter: {
            wordsPerDay: 50000,
            requestsPerDay: 500,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 150,
            requestsPerDay: 150,
            enabled: true,
          },
          aiSearch: { searchesPerDay: 500, requestsPerDay: 500, enabled: true },
          aiChatbot: {
            chatbotsPerAccount: 10,
            messagesPerDay: 3000,
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 500,
            maxFiles: 200,
            runsPerDay: 200,
            aiCallsPerDay: 200,
            maxRunTimeoutMs: 25000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
      },
      enterprise: {
        price: { monthly: 99.99, yearly: 999.99, currency: "USD" },
        features: {
          aiTextWriter: {
            wordsPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 999999999,
            messagesPerDay: 999999999,
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 1000,
            maxFiles: 500,
            runsPerDay: 500,
            aiCallsPerDay: 500,
            maxRunTimeoutMs: 30000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
      },
      unlimited: {
        price: { monthly: 149, yearly: 1490, currency: "USD" },
        features: {
          aiTextWriter: {
            wordsPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiImageGenerator: {
            imagesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiVideoGenerator: {
            videosPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiSearch: {
            searchesPerDay: 999999999,
            requestsPerDay: 999999999,
            enabled: true,
          },
          aiChatbot: {
            chatbotsPerAccount: 999999999,
            messagesPerDay: 999999999,
            enabled: true,
          },
          codeEditor: {
            enabled: true,
            maxStorageMb: 999999999,
            maxFiles: 999999999,
            runsPerDay: 999999999,
            aiCallsPerDay: 999999999,
            maxRunTimeoutMs: 30000,
          },
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          analytics: true,
        },
      },
    };

    // Update each plan
    for (const [planType, updateData] of Object.entries(planUpdates)) {
      // For unlimited plan, search by name instead of type
      const plan =
        planType === "unlimited"
          ? await SubscriptionPlan.findOne({ name: "unlimited" })
          : await SubscriptionPlan.findOne({ type: planType });

      if (plan) {
        // Update price
        plan.price = updateData.price;

        // Update features
        plan.features = updateData.features;

        // Update isPopular if specified
        if (updateData.isPopular !== undefined) {
          plan.isPopular = updateData.isPopular;
        }

        // Optional one-time reset of PayPal IDs for unlimited plan
        if (planType === "unlimited" && forceResetPayPalIds) {
          plan.paypalProductId = undefined;
          plan.paypalPlanId = undefined;
          logger.warn(
            "   ⚠️ FORCE_RESET_PAYPAL_IDS=true -> Clearing PayPal IDs for unlimited plan"
          );
        }

        await plan.save();
        logger.info(
          `   ✅ Updated ${plan.displayName}: $${plan.price.monthly}/month`
        );
      } else {
        // If plan doesn't exist, create it (for unlimited plan)
        if (planType === "unlimited") {
          const newPlan = new SubscriptionPlan({
            name: "unlimited",
            displayName: "Unlimited Plan",
            description:
              "Unlimited access to all features - The ultimate plan for power users",
            price: updateData.price,
            type: "enterprise",
            features: updateData.features,
            status: "active",
            displayOrder: 5,
            isPopular: false,
          });
          await newPlan.save();
          logger.info(
            `   ✅ Created ${newPlan.displayName}: $${newPlan.price.monthly}/month`
          );
        } else {
          logger.warn(`   ⚠️  Plan '${planType}' not found, skipping update`);
        }
      }
    }

    logger.info("✅ Existing plans updated successfully");
  } catch (error) {
    logger.error("❌ Error updating existing plans:", error);
    // Don't throw - this is not critical, plans will work with old values
  }
};

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // Payment Information
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "INR"],
    },

    // Payment Status
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },

    // Stripe Information
    stripe: {
      paymentIntentId: String,
      customerId: String,
      subscriptionId: String,
      invoiceId: String,
      chargeId: String,
    },
    // PayPal Information
    paypal: {
      subscriptionId: String,
      planId: String,
      orderId: String,
      captureId: String,
      payerId: String,
      approvalUrl: String,
    },

    // Payment Method
    paymentMethod: {
      type: {
        type: String,
        enum: ["card", "bank_transfer", "wallet", "crypto"],
        default: "card",
      },
      last4: String,
      brand: String,
      expiryMonth: Number,
      expiryYear: Number,
    },

    // Subscription Details
    subscription: {
      plan: {
        type: String,
        enum: ["monthly", "yearly", "lifetime"],
        default: "monthly",
      },
      startDate: Date,
      endDate: Date,
      autoRenew: {
        type: Boolean,
        default: true,
      },
    },

    // Billing Information
    billing: {
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      tax: {
        amount: Number,
        rate: Number,
      },
    },

    // Error Information
    error: {
      code: String,
      message: String,
      details: String,
    },

    // Metadata
    metadata: {
      source: String,
      campaign: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ "stripe.paymentIntentId": 1 });

// Instance methods
paymentSchema.methods.isSuccessful = function () {
  return this.status === "completed";
};

paymentSchema.methods.isPending = function () {
  return ["pending", "processing"].includes(this.status);
};

paymentSchema.methods.getFormattedAmount = function () {
  return `${this.currency} ${(this.amount / 100).toFixed(2)}`;
};

export default mongoose.model("Payment", paymentSchema);

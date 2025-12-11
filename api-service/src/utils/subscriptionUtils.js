// Utility function for creating default usage object
export const createDefaultUsage = () => ({
  wordsUsed: 0,
  imagesUsed: 0,
  minutesUsed: 0,
  charactersUsed: 0,
  pagesUsed: 0,
  chatbotsUsed: 0,
  voiceClonesUsed: 0,
  lastResetDate: new Date(),
});

// Utility function for creating subscription object
export const createSubscriptionData = (
  userId,
  planId,
  plan,
  billingCycle,
  amount,
  currency,
  limits,
  features
) => ({
  userId: userId,
  planId: planId,
  plan: plan.type,
  status: "active",
  billingCycle: billingCycle,
  currentPeriodStart: new Date(),
  currentPeriodEnd: calculatePeriodEnd(billingCycle),
  amount: amount,
  currency: currency,
  limits: limits,
  features: features,
  usage: createDefaultUsage(),
});

// Utility function for calculating period end
export const calculatePeriodEnd = (billingCycle) => {
  const now = new Date();
  const periodEnd = new Date(now);

  if (billingCycle === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  return periodEnd;
};

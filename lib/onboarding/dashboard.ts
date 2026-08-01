export const ONBOARDING_STORAGE_KEY = "inventra_onboarding_complete";

export const DASHBOARD_FEATURES = [
  { titleKey: "dashboard.featurePatentTitle", descriptionKey: "dashboard.featurePatentDescription", actionKey: "dashboard.featurePatentAction", href: "/dashboard/inventions?intent=patent-workspace", requiresInvention: true },
  { titleKey: "dashboard.featureGrantsTitle", descriptionKey: "dashboard.featureGrantsDescription", actionKey: "dashboard.featureGrantsAction", href: "/dashboard/grants", requiresInvention: true },
  { titleKey: "dashboard.featureManufacturingTitle", descriptionKey: "dashboard.featureManufacturingDescription", actionKey: "dashboard.featureManufacturingAction", href: "/dashboard/manufacturing", requiresInvention: true },
  { titleKey: "dashboard.featureTrademarkTitle", descriptionKey: "dashboard.featureTrademarkDescription", actionKey: "dashboard.featureTrademarkAction", href: "/dashboard/trademarks", requiresInvention: false },
] as const;

export const TOUR_STEPS = [
  { titleKey: "dashboard.tourDashboardTitle", descriptionKey: "dashboard.tourDashboardDescription" },
  { titleKey: "dashboard.tourStartTitle", descriptionKey: "dashboard.tourStartDescription" },
  { titleKey: "dashboard.tourWorkflowTitle", descriptionKey: "dashboard.tourWorkflowDescription" },
  { titleKey: "dashboard.tourToolsTitle", descriptionKey: "dashboard.tourToolsDescription" },
  { titleKey: "dashboard.tourReportsTitle", descriptionKey: "dashboard.tourReportsDescription" },
] as const;

export function dashboardInventionProgress(aiStatus: string | null) {
  if (aiStatus === "APPROVED") return { stage: "Features approved", stageKey: "dashboard.stageFeaturesApproved", percent: 50, section: "patent-search", actionKey: "dashboard.actionSearch", recommendationKey: "dashboard.recommendSearch" } as const;
  if (aiStatus === "NEEDS_REVIEW") return { stage: "Feature review", stageKey: "dashboard.stageFeatureReview", percent: 38, section: "feature-review", actionKey: "dashboard.actionReview", recommendationKey: "dashboard.recommendReview" } as const;
  if (aiStatus === "PROCESSING") return { stage: "Technical analysis", stageKey: "dashboard.stageAnalysis", percent: 28, section: "analysis", actionKey: "dashboard.actionAnalysis", recommendationKey: "dashboard.recommendAnalysis" } as const;
  if (aiStatus === "FAILED") return { stage: "Analysis needs attention", stageKey: "dashboard.stageAnalysisAttention", percent: 20, section: "analysis", actionKey: "dashboard.actionRetryAnalysis", recommendationKey: "dashboard.recommendRetryAnalysis" } as const;
  return { stage: "Invention details", stageKey: "dashboard.stageDetails", percent: 12, section: "images", actionKey: "dashboard.actionContinueSetup", recommendationKey: "dashboard.recommendSetup" } as const;
}

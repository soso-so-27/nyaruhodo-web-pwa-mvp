export function isPublicProductionDeployment(
  environment: {
    vercelEnv?: string;
    nodeEnv?: string;
  } = {
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  },
) {
  if (environment.vercelEnv) {
    return !["preview", "development"].includes(environment.vercelEnv);
  }

  return environment.nodeEnv === "production";
}

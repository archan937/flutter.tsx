export interface Deployment {
  version: string;
  minutesAgo: number;
  author: string;
}

export interface Service {
  id: number;
  name: string;
  status: string;
  region: string;
  requestsPerMinute: number;
  errorRate: number;
  dashboardUrl: string;
  deployments: Deployment[];
}

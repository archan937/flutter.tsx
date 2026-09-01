import type { Service } from '../models/service';

/**
 * The services this console watches.
 *
 * Module data becomes a top-level Dart constant, so the window has something
 * real to render before it is pointed at an API. Swap it for `useAsync` with
 * an `http.get` and the rest of the app does not change.
 */
export const SERVICES: Service[] = [
  {
    id: 1,
    name: 'checkout-api',
    status: 'live',
    region: 'eu-west-1',
    requestsPerMinute: 12480,
    errorRate: 0.004,
    dashboardUrl: 'https://flutter.dev',
    deployments: [
      { version: '2.14.0', minutesAgo: 18, author: 'ada' },
      { version: '2.13.6', minutesAgo: 320, author: 'grace' },
      { version: '2.13.5', minutesAgo: 1460, author: 'ada' },
    ],
  },
  {
    id: 2,
    name: 'search-indexer',
    status: 'live',
    region: 'eu-west-1',
    requestsPerMinute: 940,
    errorRate: 0.021,
    dashboardUrl: 'https://dart.dev',
    deployments: [
      { version: '0.9.2', minutesAgo: 92, author: 'linus' },
      { version: '0.9.1', minutesAgo: 2880, author: 'linus' },
    ],
  },
  {
    id: 3,
    name: 'billing-worker',
    status: 'paused',
    region: 'us-east-1',
    requestsPerMinute: 60,
    errorRate: 0.062,
    dashboardUrl: 'https://pub.dev',
    deployments: [{ version: '5.0.0', minutesAgo: 15, author: 'grace' }],
  },
  {
    id: 4,
    name: 'edge-cache',
    status: 'live',
    region: 'global',
    requestsPerMinute: 88400,
    errorRate: 0.0008,
    dashboardUrl: 'https://api.flutter.dev',
    deployments: [{ version: '1.4.1', minutesAgo: 4320, author: 'ada' }],
  },
];

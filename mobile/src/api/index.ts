// The app's single entry to data. Screens import `api` from here only.
// To go live: add ./http.ts implementing `Api` over fetch(), and export it
// below instead of the mock.

import { mockApi } from './mock';
import type { Api } from './types';

export const MOCK = true;
export const api: Api = mockApi;

export * from './types';

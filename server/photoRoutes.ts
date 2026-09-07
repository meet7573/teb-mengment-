import { Router } from 'express';

// Photo Management has been removed from the application.
// Keep this compatibility router so existing server imports do not affect
// the rest of the application or break existing deployments.
export function createPhotoRouter() {
  return Router();
}

// The old points catalogue ("See all rewards") is gone: referrals now earn a
// lucky draw. Anything that still links here goes to the Rewards tab.
// TODO: delete this file and its Stack.Screen in (app)/_layout.tsx.

import { Redirect } from 'expo-router';

export default function RewardsCatalogue() {
  return <Redirect href="/rewards" />;
}

/**
 * Bay Area ZIP codes Avalon Vitality currently serves.
 * Single source of truth — imported by both the ServiceArea page
 * and the Checkout ZIP validation.
 */
export const COVERED_ZIPS = new Set([
  // San Francisco
  '94102','94103','94104','94105','94107','94108','94109','94110','94111',
  '94112','94114','94115','94116','94117','94118','94119','94120','94121',
  '94122','94123','94124','94125','94126','94127','94128','94129','94130',
  '94131','94132','94133','94134','94158',
  // Marin
  '94901','94903','94904','94920','94925','94930','94941','94945','94947','94949','94965',
  // Peninsula / South Bay
  '94002','94010','94019','94020','94021','94025','94026','94027','94028',
  '94030','94040','94041','94043','94044','94061','94062','94063','94065',
  '94066','94080','94401','94402','94403','94404',
  '94301','94302','94303','94304','94305','94306',
  '94085','94086','94087','94088','94089',
  // East Bay
  '94501','94502','94530','94547','94549','94556','94563','94596','94597','94598',
  '94601','94602','94603','94605','94606','94607','94608','94609','94610',
  '94611','94612','94613','94618','94619','94621','94702','94703','94704',
  '94705','94706','94707','94708','94709','94710','94720',
]);

/** Extract a 5-digit US ZIP from any address string. Returns '' if not found. */
export function extractZip(address = '') {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : '';
}

/** Returns true if the address contains a ZIP we serve. */
export function isServiceableAddress(address = '') {
  const zip = extractZip(address);
  return zip ? COVERED_ZIPS.has(zip) : true; // no ZIP found → don't block
}

const READY_VALUE = 'true';

export function bdDataReviewComplete(env = process.env) {
  return String(env?.AVALON_BD_DATA_REVIEWED || '').trim().toLowerCase() === READY_VALUE;
}

export function requireBdDataReview(res, env = process.env) {
  if (bdDataReviewComplete(env)) return true;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(503).json({
    error: 'Avalon BD is unavailable until the production data review is complete.',
    code: 'bd_data_review_required',
  });
  return false;
}

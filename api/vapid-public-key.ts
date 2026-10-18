import type { Request, Response } from 'express';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDbXhM_5O1xdJcldjjBBWtrmUtw_iWWfbiHOQlKjBmo8OvNC68_YJd453m06CRG9wXMm9o3Y2r1Y-PTO6_NqqqE';

export default function handler(_req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
}

import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { createTrade, deleteTrade, listTrades, updateTrade } from './repository.js';
import { parseId, parseTradeInput } from './validation.js';

export const tradesRouter = Router();

tradesRouter.get('/', async (_req, res) => {
  res.json({ trades: await listTrades() });
});

tradesRouter.post('/', requireAuth, async (req, res) => {
  res.status(201).json({ trade: await createTrade(parseTradeInput(req.body)) });
});

tradesRouter.put('/:id', requireAuth, async (req, res) => {
  const trade = await updateTrade(parseId(req.params.id), parseTradeInput(req.body));
  res.json({ trade });
});

tradesRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteTrade(parseId(req.params.id));
  res.status(204).end();
});

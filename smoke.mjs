const BASE = 'http://localhost:8090/api';
const LOGIN = 'admin';
const PASSWORD = 'change_me_admin';

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const call = async (path, init = {}) => {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: response.status, body };
};

const json = (body, token) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

const trades = await call('/trades');
check('GET /trades', trades.status === 200 && trades.body.trades.length === 95, `count=${trades.body.trades?.length}`);
check('кириллица цела', trades.body.trades[0].title === '1-я цель, шорт нефти', trades.body.trades[0].title);
check('дата из сида', trades.body.trades[0].tradeDate === '2026-08-01', trades.body.trades[0].tradeDate);

const anon = await call('/trades', json({ ticker: 'TEST', roe: 1 }));
check('POST без токена → 401', anon.status === 401);

const badLogin = await call('/auth/login', json({ login: LOGIN, password: 'nope' }));
check('логин с плохим паролем → 401', badLogin.status === 401);

const good = await call('/auth/login', json({ login: LOGIN, password: PASSWORD }));
check('логин корректный → токен', good.status === 200 && typeof good.body.token === 'string');
const token = good.body.token;

const session = await call('/auth/session', { headers: { authorization: `Bearer ${token}` } });
check('GET /auth/session', session.status === 200 && session.body.login === LOGIN);

const draft = { ticker: 'SMOKE', title: 'Тест дублей', roe: 3.5, tradeDate: '2026-08-02' };
const created = await call('/trades', json(draft, token));
check('POST /trades → 201', created.status === 201, JSON.stringify(created.body?.trade));
const id = created.body?.trade?.id;

const duplicate = await call('/trades', json(draft, token));
check('POST того же (дата+тикер+ROE) → 409', duplicate.status === 409, duplicate.body?.message);

const otherDate = await call('/trades', json({ ...draft, tradeDate: '2026-08-03' }, token));
check('POST с другой датой → 201', otherDate.status === 201);

const updated = await call(`/trades/${id}`, {
  ...json({ ...draft, roe: 4.25, title: 'Обновлено' }, token),
  method: 'PUT',
});
check('PUT /trades/:id', updated.status === 200 && updated.body.trade.roe === 4.25);

const collide = await call(`/trades/${id}`, {
  ...json({ ...draft, tradeDate: '2026-08-03' }, token),
  method: 'PUT',
});
check('PUT в существующий ключ → 409', collide.status === 409, collide.body?.message);

const invalid = await call('/trades', json({ ticker: 'X', roe: 'abc' }, token));
check('POST с нечисловым ROE → 400', invalid.status === 400, invalid.body?.message);

for (const cleanupId of [id, otherDate.body?.trade?.id]) {
  const removed = await call(`/trades/${cleanupId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  check(`DELETE /trades/${cleanupId} → 204`, removed.status === 204);
}

const final = await call('/trades');
check('после уборки снова 95', final.body.trades.length === 95, `count=${final.body.trades.length}`);

console.log(failures === 0 ? '\nВсе проверки прошли' : `\nПровалено проверок: ${failures}`);
process.exit(failures === 0 ? 0 : 1);

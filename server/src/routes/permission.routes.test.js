import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'permission_test_secret_at_least_32_chars';

const [
  { authRouter },
  { databaseRouter },
  { excelRouter },
  { inspectionQueueRouter },
  { lotRouter },
  { settingsRouter },
  { summaryRouter },
  { userRouter }
] = await Promise.all([
  import('./auth.routes.js'),
  import('./database.routes.js'),
  import('./excel.routes.js'),
  import('./inspection-queue.routes.js'),
  import('./lot.routes.js'),
  import('./settings.routes.js'),
  import('./summary.routes.js'),
  import('./user.routes.js')
]);

const knownRoles = ['head', 'assistant', 'officer'];
const managerRoles = ['head', 'assistant'];
const lotRoutePermissions = [
  { path: '/lookup/by-lot-pack', method: 'get', roles: knownRoles },
  { path: '/approval-queue', method: 'get', roles: managerRoles },
  { path: '/manual', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/attachments', method: 'get', roles: knownRoles },
  { path: '/:lotNumber/attachments', method: 'post', roles: knownRoles },
  { path: '/:lotNumber/attachments/:attachmentId/download', method: 'get', roles: knownRoles },
  { path: '/:lotNumber/attachments/:attachmentId', method: 'delete', roles: managerRoles },
  { path: '/:lotNumber/dimension-inspection', method: 'get', roles: knownRoles },
  { path: '/:lotNumber/dimension-inspection/draft', method: 'post', roles: knownRoles },
  { path: '/:lotNumber/dimension-inspection/complete', method: 'post', roles: knownRoles },
  { path: '/:lotNumber/packing-inspection', method: 'get', roles: knownRoles },
  { path: '/:lotNumber/packing-inspection/draft', method: 'post', roles: knownRoles },
  { path: '/:lotNumber/packing-inspection/complete', method: 'post', roles: knownRoles },
  { path: '/:lotNumber', method: 'get', roles: managerRoles },
  { path: '/:lotNumber', method: 'put', roles: managerRoles },
  { path: '/:lotNumber/void', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/approve', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/cancel-approval', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/send-back', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/review-ng', method: 'post', roles: managerRoles },
  { path: '/:lotNumber/confirm-ng', method: 'post', roles: managerRoles }
];

function getGlobalRoleGuard(router) {
  const middlewareLayers = router.stack.filter((layer) => !layer.route);

  assert.equal(middlewareLayers[0]?.name, 'requireAuth');
  assert.ok(middlewareLayers[1], 'role guard should follow authentication');
  return middlewareLayers[1].handle;
}

function getRouteRoleGuard(router, path, method, guardIndex = 0) {
  const routeLayer = router.stack.find((layer) => (
    layer.route?.path === path && layer.route?.methods?.[method]
  ));

  assert.ok(routeLayer, `${method.toUpperCase()} ${path} should exist`);
  assert.ok(routeLayer.route.stack[guardIndex], `${method.toUpperCase()} ${path} should have a role guard`);
  return routeLayer.route.stack[guardIndex].handle;
}

function assertAllowedRoles(roleGuard, allowedRoles) {
  for (const role of knownRoles) {
    let receivedError;

    roleGuard({ user: { role } }, {}, (error) => {
      receivedError = error;
    });

    if (allowedRoles.includes(role)) {
      assert.equal(receivedError, undefined, `${role} should be allowed`);
    } else {
      assert.equal(receivedError?.statusCode, 403, `${role} should receive 403`);
    }
  }
}

test('protects critical backend routes with the approved role matrix', () => {
  assertAllowedRoles(getGlobalRoleGuard(userRouter), ['head']);
  assertAllowedRoles(getGlobalRoleGuard(settingsRouter), ['head', 'assistant']);
  assertAllowedRoles(getGlobalRoleGuard(excelRouter), ['head', 'assistant']);
  assertAllowedRoles(getGlobalRoleGuard(inspectionQueueRouter), knownRoles);
  assertAllowedRoles(getGlobalRoleGuard(summaryRouter), managerRoles);

  assertAllowedRoles(
    getRouteRoleGuard(databaseRouter, '/health', 'get', 1),
    ['head', 'assistant']
  );
  assertAllowedRoles(
    getRouteRoleGuard(authRouter, '/sessions/retention-status', 'get', 1),
    ['head']
  );

  const configuredLotRoutes = lotRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`)
    .sort();
  const testedLotRoutes = lotRoutePermissions
    .map(({ method, path }) => `${method} ${path}`)
    .sort();

  assert.deepEqual(testedLotRoutes, configuredLotRoutes);

  for (const { path, method, roles } of lotRoutePermissions) {
    assertAllowedRoles(getRouteRoleGuard(lotRouter, path, method), roles);
  }
});

test('keeps frontend page permissions aligned with the approved role matrix', async () => {
  const configUrl = new URL('../../../client/src/config/app.config.js', import.meta.url);
  const configSource = await readFile(configUrl, 'utf8');
  const configDataUrl = `data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`;
  const configModule = await import(configDataUrl);

  assert.deepEqual(configModule.pagePermissions.users, ['head']);
  assert.deepEqual(configModule.pagePermissions.settings, ['head', 'assistant']);
  assert.deepEqual(configModule.pagePermissions.importExcel, ['head', 'assistant']);
  assert.deepEqual(configModule.pagePermissions.approval, ['head', 'assistant']);
  assert.deepEqual(configModule.pagePermissions.summary, managerRoles);
  assert.deepEqual(configModule.pagePermissions.dimension, knownRoles);
  assert.deepEqual(configModule.pagePermissions.packing, knownRoles);
  assert.deepEqual(configModule.pagePermissions.results, knownRoles);

  const layoutUrl = new URL('../../../client/src/components/main-layout.js', import.meta.url);
  const layoutSource = await readFile(layoutUrl, 'utf8');
  const testableLayoutSource = layoutSource.replace('../config/app.config.js', configDataUrl);
  const layoutModule = await import(
    `data:text/javascript;base64,${Buffer.from(testableLayoutSource).toString('base64')}`
  );

  function visibleMenuIds(role) {
    const html = layoutModule.renderMainLayout({
      user: { role, fullName: 'Permission Test', position: 'QC' },
      activePage: 'dashboard',
      pageTitle: 'Permission Test',
      children: ''
    });

    return [...html.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1]);
  }

  assert.deepEqual(visibleMenuIds('head'), [
    'dashboard', 'barcode', 'importExcel', 'manualLot', 'dimension', 'packing', 'approval',
    'history', 'export', 'exportDimension', 'results', 'summary', 'users', 'settings'
  ]);
  assert.deepEqual(visibleMenuIds('assistant'), [
    'dashboard', 'barcode', 'importExcel', 'manualLot', 'dimension', 'packing', 'approval',
    'history', 'export', 'exportDimension', 'results', 'summary', 'settings'
  ]);
  assert.deepEqual(visibleMenuIds('officer'), [
    'dashboard', 'barcode', 'dimension', 'packing', 'history', 'results'
  ]);
});

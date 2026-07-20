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
  { userRouter }
] = await Promise.all([
  import('./auth.routes.js'),
  import('./database.routes.js'),
  import('./excel.routes.js'),
  import('./inspection-queue.routes.js'),
  import('./lot.routes.js'),
  import('./settings.routes.js'),
  import('./user.routes.js')
]);

const knownRoles = ['head', 'assistant', 'officer'];

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

  assertAllowedRoles(
    getRouteRoleGuard(databaseRouter, '/health', 'get', 1),
    ['head', 'assistant']
  );
  assertAllowedRoles(
    getRouteRoleGuard(authRouter, '/sessions/retention-status', 'get', 1),
    ['head']
  );
  assertAllowedRoles(
    getRouteRoleGuard(lotRouter, '/approval-queue', 'get'),
    ['head', 'assistant']
  );
  assertAllowedRoles(
    getRouteRoleGuard(lotRouter, '/:lotNumber/dimension-inspection/draft', 'post'),
    knownRoles
  );
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
    'history', 'export', 'exportDimension', 'results', 'users', 'settings'
  ]);
  assert.deepEqual(visibleMenuIds('assistant'), [
    'dashboard', 'barcode', 'importExcel', 'manualLot', 'dimension', 'packing', 'approval',
    'history', 'export', 'exportDimension', 'results', 'settings'
  ]);
  assert.deepEqual(visibleMenuIds('officer'), [
    'dashboard', 'barcode', 'dimension', 'packing', 'history', 'results'
  ]);
});

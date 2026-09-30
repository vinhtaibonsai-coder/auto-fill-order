import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PermissionService, ROLE_ACTION_MATRIX, ACTION_PERMISSIONS } from '../../src/domain/permission/permission.service.esm.js';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('F01: Permission Catalog - 1. Required action permissions exist in taxonomy and matrix', () => {
  const expectedCodes = [
    'orders.view',
    'orders.edit',
    'orders.submit',
    'labels.print',
    'labels.reprint',
    'customers.view_pii',
    'support.manage',
    'billing.view',
    'billing.manage',
    'team.manage',
    'channels.manage',
    'api_keys.manage',
    'audit.view'
  ];

  for (const code of expectedCodes) {
    assert.ok(ACTION_PERMISSIONS[code], `Missing action permission definition: ${code}`);
  }
});

test('F01: Permission Catalog - 2. Role permission matrix enforces exact action boundary across 5 roles', () => {
  // 1. Owner: has all permissions
  for (const code of Object.keys(ACTION_PERMISSIONS)) {
    assert.equal(PermissionService.evaluateRolePermission('OWNER', code), true, `Owner must have ${code}`);
    assert.equal(PermissionService.evaluateRolePermission('SHOP_OWNER', code), true, `SHOP_OWNER must have ${code}`);
  }

  // 2. Manager: has operational permissions, cannot demote owner
  assert.equal(PermissionService.evaluateRolePermission('MANAGER', 'orders.submit'), true);
  assert.equal(PermissionService.evaluateRolePermission('MANAGER', 'labels.print'), true);
  assert.equal(PermissionService.evaluateRolePermission('MANAGER', 'team.manage'), true);
  assert.equal(PermissionService.evaluateRolePermission('MANAGER', 'billing.manage'), true);

  // 3. Packer: can view/edit/submit orders and print/reprint labels + view PII, cannot billing/team/channels
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'orders.view'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'orders.edit'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'orders.submit'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'labels.print'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'labels.reprint'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'customers.view_pii'), true);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'billing.view'), false);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'billing.manage'), false);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'team.manage'), false);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'api_keys.manage'), false);

  // 4. CSKH: can view orders, view PII and manage support, cannot submit orders or print labels or billing
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'orders.view'), true);
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'customers.view_pii'), true);
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'support.manage'), true);
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'orders.submit'), false);
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'labels.print'), false);
  assert.equal(PermissionService.evaluateRolePermission('CSKH', 'billing.view'), false);

  // 5. Accountant: can view orders (restricted) and billing/COD and financial audit, cannot submit, print, or view PII
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'orders.view'), true);
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'billing.view'), true);
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'audit.view'), true);
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'customers.view_pii'), false);
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'orders.submit'), false);
  assert.equal(PermissionService.evaluateRolePermission('ACCOUNTANT', 'labels.print'), false);

  // 6. Deny-by-default for unknown roles or unknown permissions
  assert.equal(PermissionService.evaluateRolePermission('GUEST', 'orders.view'), false);
  assert.equal(PermissionService.evaluateRolePermission('PACKER', 'unknown.action'), false);
});

test('F01: Permission Catalog - 3. Owner immunity: Manager cannot demote or remove Shop Owner', () => {
  assert.equal(PermissionService.canModifyMemberRole('OWNER', 'OWNER', 'MANAGER'), true, 'Owner can change role');
  assert.equal(PermissionService.canModifyMemberRole('MANAGER', 'PACKER', 'CSKH'), true, 'Manager can change Packer to CSKH');
  assert.equal(PermissionService.canModifyMemberRole('MANAGER', 'OWNER', 'MANAGER'), false, 'Manager CANNOT change Owner role');
  assert.equal(PermissionService.canRemoveMember('MANAGER', 'OWNER'), false, 'Manager CANNOT remove Owner');
  assert.equal(PermissionService.canRemoveMember('OWNER', 'MANAGER'), true, 'Owner can remove Manager');
});

test('F02: Server Authorization Helper - Migration v125 contract and no default overload ambiguity', () => {
  const migrationPath = path.join(root, 'database/migrations/v125_action_rbac_permissions.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v125 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Verify seed permissions
  assert.ok(sql.includes('orders.view'), 'Migration v125 must seed orders.view');
  assert.ok(sql.includes('orders.submit'), 'Migration v125 must seed orders.submit');
  assert.ok(sql.includes('labels.print'), 'Migration v125 must seed labels.print');
  assert.ok(sql.includes('customers.view_pii'), 'Migration v125 must seed customers.view_pii');

  // Verify canonical helper functions
  assert.ok(sql.includes('FUNCTION public.has_shop_permission('), 'Must define has_shop_permission');
  assert.ok(sql.includes('FUNCTION public.has_shop_permission_for_user('), 'Must define has_shop_permission_for_user');

  // Verify no default argument on has_shop_permission to prevent overload ambiguity
  assert.ok(!sql.match(/has_shop_permission\s*\([^)]*DEFAULT/i), 'has_shop_permission must NOT have DEFAULT arguments');

  // Verify profiles.role is NOT used for authorization
  assert.ok(!sql.includes('profiles.role ='), 'profiles.role must not be used as permission source');
});

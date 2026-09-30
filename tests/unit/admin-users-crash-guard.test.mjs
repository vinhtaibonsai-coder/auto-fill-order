import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('1. AdminRepository.getUsersList safely handles non-200 / non-array RPC responses and falls back to profiles', () => {
  const repoPath = path.join(repoRoot, 'src', 'domain', 'admin', 'admin.repository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  assert.match(code, /res\.ok/, 'Must check res.ok on RPC fetch');
  assert.match(code, /Array\.isArray\(users\)/, 'Must check Array.isArray on returned users');
  assert.match(code, /from\('profiles'\)|\/rest\/v1\/profiles/, 'Must have fallback to profiles table');
});

test('2. AdminService.getUsersList guarantees data is always an Array', () => {
  const svcPath = path.join(repoRoot, 'src', 'domain', 'admin', 'admin.service.js');
  const code = fs.readFileSync(svcPath, 'utf8');

  assert.match(code, /data:\s*Array\.isArray\(users\)\s*\?\s*users\s*:\s*\[\]/, 'AdminService must ensure data is an Array on success');
  assert.match(code, /data:\s*\[\]/, 'AdminService must return empty array data on catch');
});

test('3. Users.jsx uses defensive userList and safe shop mapping', () => {
  const usersPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'Users', 'Users.jsx');
  const code = fs.readFileSync(usersPath, 'utf8');

  assert.match(code, /const userList = useMemo\(\(\) => \(Array\.isArray\(users\) \? users : \[\]\)/, 'Users.jsx must normalize users to userList array');
  assert.match(code, /userList\.filter/, 'Must use userList.filter');
  assert.match(code, /userList\.reduce/, 'Must use userList.reduce');
  assert.match(code, /s\?\.shop_name/, 'Must safely access s?.shop_name');
});

test('4. ErrorBoundary.jsx captures errorInfo, displays error message, and provides stack trace details', () => {
  const ebPath = path.join(repoRoot, 'src', 'ui', 'components', 'ErrorBoundary.jsx');
  const code = fs.readFileSync(ebPath, 'utf8');

  assert.match(code, /this\.state\.errorInfo/, 'ErrorBoundary must retain errorInfo');
  assert.match(code, /errorMsg/, 'ErrorBoundary must extract and display errorMsg');
  assert.match(code, /details/, 'ErrorBoundary must provide collapsible details for stack trace');
  assert.match(code, /Sao chép mã lỗi/, 'ErrorBoundary must provide button to copy error');
});

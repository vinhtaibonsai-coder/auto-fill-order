import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const optionsIndex = readSource('src/ui/options/index.jsx');
const optionsApp = readSource('src/ui/options/App.jsx');
const login = readSource('src/ui/options/pages/Auth/Login.jsx');
const serverSettings = readSource('src/ui/options/pages/Server/ServerSettings.jsx');

assert.match(optionsIndex, /application\/config\.js/, 'Options bundle must load base config before Auth/Supabase clients');
assert.match(optionsIndex, /infrastructure\/supabase\/supabase-config\.js/, 'Options bundle must load Supabase default config');
assert.match(optionsIndex, /infrastructure\/supabase\/client\.js/, 'Options bundle must load SupabaseCloud client');
assert.match(optionsIndex, /domain\/auth\/auth\.service\.js/, 'Options bundle must load classic auth service global');

assert.match(serverSettings, /SupabaseCloud\.loadConfig/, 'Server settings must load existing Supabase config');
assert.match(serverSettings, /SupabaseCloud\.saveConfig/, 'Server settings must save Supabase URL and anon key');
assert.match(serverSettings, /SupabaseCloud\.testConnection/, 'Server settings must expose a connection test');
assert.match(serverSettings, /supabaseUrl|Supabase URL/, 'Server settings must expose Supabase URL input');
assert.match(serverSettings, /anonKey|Supabase Anon Key/, 'Server settings must expose Supabase anon key input');

assert.match(login, /ServerSettings compact/, 'Login screen must expose Supabase setup before authentication');
assert.match(optionsApp, /ServerSettings/, 'Authenticated Options app must expose server settings page');
assert.match(optionsApp, /Server Connection/, 'Options sidebar must include a server connection entry');

console.log('Supabase config UI tests passed.');

import { describe, it, expect } from 'vitest';
import '../../src/domain/auth/auth.service.js';
const AuthService = globalThis.AuthService;

describe('AuthService', () => {
  it('should be defined', () => {
    expect(AuthService).toBeDefined();
  });

  it('should have standard methods', () => {
    expect(typeof AuthService.login).toBe('function');
    expect(typeof AuthService.signup).toBe('function');
    expect(typeof AuthService.logout).toBe('function');
    expect(typeof AuthService.resetPassword).toBe('function');
  });
});
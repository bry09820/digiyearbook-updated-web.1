/**
 * services/usersService.js
 * All API calls for the admin User Management module.
 */

import api from "./api";

const BASE = "/admin/users";

const usersService = {
  /**
   * List users with optional filters.
   * @param {{ page?, per_page?, search?, role?, status? }} params
   */
  getUsers: (params = {}) =>
    api.get(BASE, { params }),

  /**
   * Get a single user's full details.
   */
  getUser: (id) =>
    api.get(`${BASE}/${id}`),

  /**
   * Update editable fields (role, profile_visibility, bio, etc.)
   */
  updateUser: (id, data) =>
    api.patch(`${BASE}/${id}`, data),

  /**
   * Suspend a user and revoke all active tokens.
   */
  suspendUser: (id) =>
    api.patch(`${BASE}/${id}/suspend`),

  /**
   * Re-activate a suspended user.
   */
  unsuspendUser: (id) =>
    api.patch(`${BASE}/${id}/unsuspend`),

  /**
   * Approve a pending account so the user can sign in.
   */
  approveUser: (id) =>
    api.patch(`${BASE}/${id}/approve`),

  /**
   * Disapprove an account and revoke its sessions.
   */
  disapproveUser: (id) =>
    api.patch(`${BASE}/${id}/disapprove`),

  /**
   * Mark a user as approved. Kept for older callers.
   */
  verifyUser: (id) =>
    api.patch(`${BASE}/${id}/approve`),

  /**
   * Trigger a password reset email.
   */
  resetPassword: (id) =>
    api.post(`${BASE}/${id}/reset-password`),

  /**
   * Permanently delete a user.
   */
  deleteUser: (id) =>
    api.delete(`${BASE}/${id}`),
};

export default usersService;
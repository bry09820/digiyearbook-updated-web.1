/**
 * services/moderationService.js
 * All API calls for the Content Moderation module.
 */

import api from "./api";

const BASE = "/admin/moderation";

const moderationService = {
  /**
   * Fetch paginated moderation queue.
   * @param {{ type, status, page, per_page }} params
   */
  getQueue: (params = {}) =>
    api.get(`${BASE}/queue`, { params }),

  /**
   * Get pending counts per content type (for tab badges).
   */
  getCounts: () =>
    api.get(`${BASE}/counts`),

  /**
   * Approve a single item.
   * @param {string} type  photo|video|tagged|reported
   * @param {number} id
   */
  approve: (type, id) =>
    api.post(`${BASE}/${type}/${id}/approve`),

  /**
   * Reject a single item with a reason.
   * @param {string} type
   * @param {number} id
   * @param {string} reason
   */
  reject: (type, id, reason) =>
    api.post(`${BASE}/${type}/${id}/reject`, { reason }),

  /**
   * Bulk approve multiple items.
   * @param {string}   type
   * @param {number[]} ids
   */
  bulkApprove: (type, ids) =>
    api.post(`${BASE}/bulk-approve`, { type, ids }),

  /**
   * Bulk reject multiple items.
   * @param {string}   type
   * @param {number[]} ids
   * @param {string}   reason
   */
  bulkReject: (type, ids, reason) =>
    api.post(`${BASE}/bulk-reject`, { type, ids, reason }),
};

export default moderationService;
import api from "@/services/api";

export const announcementsApi = {
  list: (params = {}) => api.get("/admin/announcements", { params }),
  recipientCount: () => api.get("/admin/announcements/recipients/count"),
  create: (payload) => api.post("/admin/announcements", payload),
  update: (id, payload) => api.put(`/admin/announcements/${id}`, payload),
  delete: (id) => api.delete(`/admin/announcements/${id}`),
};

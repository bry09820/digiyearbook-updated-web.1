import client from './client';

export const profileApi = {
  uploadMedia: (formData, config = {}) =>
    client.post('/profile/upload', formData, config),

  getPosts: (userId, page = 1) =>
    client.get(`/students/${userId}/posts`, { params: { page } }),

  // Update caption, visibility, and tagged users on a profile post
  updatePost: (photoId, payload) =>
    client.patch(`/profile/posts/${photoId}`, payload),

  reportPost: (photoId, payload = {}) =>
    client.post(`/profile/posts/${photoId}/report`, payload),

  deletePost: (photoId) =>
    client.delete(`/profile/posts/${photoId}`),
};

export const profileSettingsApi = {
  updateVisibility: (visibility) => client.post('/profile/visibility', { visibility }),
  updateMotto:      (motto)      => client.post('/profile/motto',      { motto }),
};

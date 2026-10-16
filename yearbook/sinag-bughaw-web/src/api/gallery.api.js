import client from './client';

export const galleryApi = {
  list: (type = 'general', category = null) =>
    client.get('/gallery', { params: { type, ...(category ? { category } : {}) } }),

  show: (albumId) => client.get(`/gallery/${albumId}`),

  faceSearch: (formData) =>
    client.post('/gallery/face-search', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // : create a general album via the axios client so auth headers
  //         are automatically injected from the axios interceptor.
  createAlbum: (payload) =>
    client.post('/gallery/albums', payload),
};

export const mediaApi = {
  storageUsage: () => client.get('/profile/storage-usage'),

  bulkUpload: (albumId, files, onProgress, visibility = 'public', caption = '') => {
    const form = new FormData();
    form.append('album_id', albumId);
    form.append('visibility', visibility);
    if (caption) form.append('caption', caption);
    files.forEach((file) => form.append('photos[]', file));
    return client.post('/media/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },

  uploadVideo: (albumId, file, caption = '', onProgress, visibility = 'public') => {
    const form = new FormData();
    form.append('album_id', albumId);
    form.append('video', file);
    form.append('caption', caption);
    form.append('visibility', visibility);
    return client.post('/media/upload-video', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },

  deletePhoto: (photoId) => client.delete(`/gallery/media/${photoId}`),
  bandwidth:   ()        => client.get('/profile/storage-usage'),
};

export const faceApi = {
  studentPhotos: (userId, page = 1) =>
    client.get(`/face/students/${userId}/photos`, { params: { page } }),

  search: (formData) =>
    client.post('/face/search', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  analyzePhoto: (photoId) => client.post(`/face/photos/${photoId}/analyze`),
  analyzeAlbum: (albumId) => client.post(`/face/albums/${albumId}/analyze`),
  photoTags:    (photoId) => client.get(`/face/photos/${photoId}/tags`),
};

export const profileApi = {
  getPosts: (userId) => client.get(`/students/${userId}/posts`),

  uploadMedia: (formData, onProgress) =>
    client.post('/profile/upload', formData, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    }),

  searchClassmates: (params) => client.get('/profile/classmates', { params }),

  updatePost: (photoId, payload) =>
    client.patch(`/profile/posts/${photoId}`, payload),

  deletePost: (photoId) => client.delete(`/profile/posts/${photoId}`),
};

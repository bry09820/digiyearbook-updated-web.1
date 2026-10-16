import { useEffect, useRef, useState } from 'react';

function normalizeStatus(status) {
  if (status === 'done' || status === 'analyzed' || status === 'matched') return 'analyzed';
  if (status === 'no_matches') return 'analyzed';
  if (status === 'failed') return 'error';
  return status ?? 'pending';
}

export function normalizeFaceEvent(event = {}) {
  return {
    photo_id: event.photo_id,
    status: normalizeStatus(event.status),
    face_count: event.face_count ?? 0,
    matches: event.matches ?? [],
  };
}

export function usePhotoFacesBroadcast(onEvent, { photoIds = null, enabled = true } = {}) {
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  const photoIdsRef = useRef(photoIds);
  useEffect(() => { photoIdsRef.current = photoIds; }, [photoIds]);

  useEffect(() => {
    if (!enabled) return undefined;

    if (typeof window === 'undefined' || !window.Echo) {
      return undefined;
    }

    const channel = window.Echo.channel('photos');

    const listener = (payload) => {
      const event = normalizeFaceEvent(payload);
      const ids = photoIdsRef.current;

      if (ids?.length && !ids.includes(event.photo_id)) return;
      handlerRef.current(event);
    };

    channel.listen('.PhotoFacesAnalyzed', listener);

    return () => {
      channel.stopListening('.PhotoFacesAnalyzed', listener);
    };
  }, [enabled]);
}

export function useAlbumFacesBroadcast(photoIds = [], enabled = true) {
  const [tagUpdates, setTagUpdates] = useState(new Map());

  usePhotoFacesBroadcast(
    (event) => {
      setTagUpdates((prev) => {
        const next = new Map(prev);
        next.set(event.photo_id, {
          status: event.status,
          face_count: event.face_count,
          tags: event.matches,
          matches: event.matches,
        });
        return next;
      });
    },
    { photoIds, enabled }
  );

  return {
    tagUpdates,
    clearUpdates: () => setTagUpdates(new Map()),
  };
}

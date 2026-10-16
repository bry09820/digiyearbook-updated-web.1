const positiveId = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
};

/** Directory cards are registered accounts. Open that users.id. */
export function directoryProfilePath(student) {
  const userId = positiveId(student?.account_user_id, student?.user_id, student?.id);
  if (userId) return `/students/${userId}`;

  const recordId = positiveId(student?.student_record_id);
  if (recordId) return `/discover/students/${recordId}?as=record`;

  return '/directory';
}

/**
 * Discovery lists identify a registered student by users.id.
 * Yearbook-only rows use students.id and must be marked as=record so a
 * colliding account id is not loaded instead.
 */
export function discoveryProfilePath(student) {
  const userId = positiveId(student?.account_user_id, student?.user_id);
  if (userId) return `/discover/students/${userId}?as=user`;

  const recordId = positiveId(student?.student_record_id, student?.id);
  if (recordId) return `/discover/students/${recordId}?as=record`;

  return '/discover';
}

export function discoveryRecordPath(recordId) {
  const id = positiveId(recordId);
  return id ? `/discover/students/${id}?as=record` : '/discover';
}

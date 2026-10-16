export function graduationYearOf(person) {
  const year = Number(
    person?.graduation_year
    ?? person?.student_record?.graduation_year
    ?? person?.studentRecord?.graduation_year
  );
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function isAlumniAccount(person) {
  if (!person) return false;
  const role = String(person.role || '').toLowerCase();
  if (role === 'alumni') return true;
  if (person.is_alumni === true || person.is_alumni === 1 || person.is_alumni === '1') return true;
  if (role === 'student') return false;
  const status = String(person.academic_status || '').toLowerCase();
  if (status === 'alumni') return true;
  if (status === 'current student') return false;
  const year = graduationYearOf(person);
  return year !== null && year <= new Date().getFullYear();
}

export function academicStatusLabel(person) {
  const role = String(person?.role || '').toLowerCase();
  if (role === 'faculty') return 'Faculty';
  if (role === 'admin') return 'Admin';
  if (person?.academic_status === 'Alumni' || person?.academic_status === 'Current Student') {
    return person.academic_status;
  }
  return isAlumniAccount(person) ? 'Alumni' : 'Current Student';
}

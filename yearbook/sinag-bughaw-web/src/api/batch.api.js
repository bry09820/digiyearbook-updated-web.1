import client from './client';

// NU Lipa constants (mirrors BatchService)

export const DEPARTMENTS = ['SACE', 'SAHS', 'SABM', 'SHS'];

export const DEPARTMENT_COURSES = {
  SACE: [
    'Bachelor of Science in Architecture',
    'Bachelor of Multimedia Arts',
    'Bachelor of Science in Civil Engineering',
    'Bachelor of Science in Computer Science',
    'Bachelor of Science in Information Technology',
  ],
  SAHS: [
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Medical Technology',
    'Bachelor of Science in Psychology',
  ],
  SABM: [
    'Bachelor of Science in Accountancy',
    'Bachelor of Science in Business Administration - Financial Management',
    'Bachelor of Science in Business Administration - Marketing Management',
    'Bachelor of Science in Tourism Management',
    'Master in Management',
  ],
  SHS:  ['ABM', 'STEM', 'HUMSS'],
};

export const COURSES = [
  { value: '', label: 'All Programs' },
  ...Object.values(DEPARTMENT_COURSES).flat().map(c => ({ value: c, label: c })),
];

export const COURSE_LABELS = Object.fromEntries(
  COURSES.filter(c => c.value).map(c => [c.value, c.label])
);

export const MIN_BATCH_YEAR = 2022;

/** Latest selectable batch is the current calendar year. */
export const MAX_BATCH_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS = Array.from(
  { length: MAX_BATCH_YEAR - MIN_BATCH_YEAR + 1 },
  (_, i) => MAX_BATCH_YEAR - i
).filter((year) => year >= MIN_BATCH_YEAR && year <= MAX_BATCH_YEAR);

// Batch API

export const batchApi = {
  /** GET /api/batchmates?course=&year= */
  batchmates: (params = {}) =>
    client.get('/batchmates', { params }),

  /** GET /api/discover/sectionmates */
  sectionmates: (params = {}) =>
    client.get('/discover/sectionmates', { params }),

  /** GET /api/discover/school?search=&course=&department=&year=&page= */
  wholeSchool: (params = {}) =>
    client.get('/discover/school', { params }),

  /** GET /api/discover/cross-program?course=&department=&year=&page= */
  crossProgram: (params = {}) =>
    client.get('/discover/cross-program', { params }),

  /** GET /api/batches */
  index: (params = {}) =>
    client.get('/batches', { params }),

  /** GET /api/batches (grouped by department) */
  all: (params = {}) =>
    client.get('/batches', { params }),

  /** GET /api/batches/:batch */
  show: (batch) =>
    client.get(`/batches/${batch}`),

  /** GET /api/batches/:batch/students */
  students: (batch, params = {}) =>
    client.get(`/batches/${batch}/students`, { params }),

  /** GET /api/discover/department/:dept */
  byDepartment: (department, params = {}) =>
    client.get(`/discover/department/${encodeURIComponent(department)}`, { params }),
};

// Sections API

export const sectionsApi = {
  /** GET /api/sections */
  list: (params = {}) =>
    client.get('/sections', { params }),

  /** GET /api/sections/:id */
  show: (id) =>
    client.get(`/sections/${id}`),
};

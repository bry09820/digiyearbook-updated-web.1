import { useState, useEffect, useCallback, useRef } from "react";
import api, { notifyAdminAccountsChanged } from "../services/api";
import { PageHdr, Flash, Card, CardHead, EmptyState } from "../components/shared/Card";
import { Pager } from "../components/shared/Table";
import Btn from "../components/shared/Btn";
import ConfirmModal from "../components/shared/ConfirmModal";

const PER_PAGE = 10;
const FIELD_KEYS = ["name", "title", "department", "email", "bio"];

const defaultFacultyForm = (fac = {}) => ({
  name: fac.name ?? "",
  title: fac.title ?? "",
  department: fac.department ?? "",
  email: fac.email ?? "",
  bio: fac.bio ?? "",
});

const appendFacultyFields = (fd, data) => {
  FIELD_KEYS.forEach((key) => fd.append(key, data[key] ?? ""));
};

const FField = ({ label, optional = false, children }) => (
  <div className="mb-3">
    <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
      {label} {optional && <span className="font-semibold normal-case text-slate-400">(Optional)</span>}
    </label>
    {children}
  </div>
);

const FInput = (props) => (
  <input
    {...props}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
  />
);

const FTextarea = ({ rows = 3, ...props }) => (
  <textarea
    rows={rows}
    {...props}
    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
  />
);

function FacultyPhotoUploadZone({ fileRef, previewUrl, fileName, helperText, onSelect, onRemove }) {
  const chooseFile = () => fileRef.current?.click();
  const handleDrop = (e) => {
    e.preventDefault();
    onSelect?.(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onSelect?.(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={chooseFile}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected faculty"
            className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-700">Click to upload or drag & drop</p>
          <p className="mt-1 truncate text-xs text-slate-400">{fileName || helperText || "PNG, JPG, or WEBP image"}</p>
        </div>
      </button>

      {fileName && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="truncate text-xs font-semibold text-slate-600">{fileName}</span>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Remove selected photo"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function makeFacultyPhotoFile({ file, previewUrl, zoom, x, y }) {
  const size = 512;
  const image = await loadImage(previewUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (size / 2) + ((x / 100) * size) - (drawWidth / 2);
  const drawY = (size / 2) + ((y / 100) * size) - (drawHeight / 2);

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not prepare faculty photo.");

  const name = file?.name?.replace(/\.[^.]+$/, "") || "faculty-photo";
  return new File([blob], `${name}-faculty.jpg`, { type: "image/jpeg" });
}

function createPhotoDraft(file) {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    zoom: 1,
    x: 0,
    y: 0,
    aspect: 1,
  };
}

function initialsFor(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("") || "NU";
}

export default function FacultyPage({ showToast }) {
  const [list, setList] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState({ msg: "", type: "success" });
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(defaultFacultyForm());
  const [addPreview, setAddPreview] = useState(null);
  const [addPhotoFile, setAddPhotoFile] = useState(null);
  const [addPhotoDraft, setAddPhotoDraft] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const timer = useRef(null);
  const formRef = useRef(null);
  const addFileRef = useRef(null);
  const csvRef = useRef(null);

  const showFlash = (msg, type = "success") => {
    setFlash({ msg, type });
    setTimeout(() => setFlash({ msg: "", type: "success" }), 3000);
  };

  const load = useCallback(async (p, q) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/faculty", {
        params: { page: p, search: q, per_page: PER_PAGE },
      });
      setList(res.data.data ?? []);
      setMeta(res.data.meta ?? res.data);
    } catch (err) {
      showFlash(err.response?.data?.message ?? "Failed to load faculty.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, search);
  }, [load, page, search]);

  const handleSearch = (value) => {
    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPage(1), 400);
  };

  const clearAddPhoto = () => {
    setAddPreview(null);
    setAddPhotoFile(null);
    setAddPhotoDraft(null);
    if (addFileRef.current) addFileRef.current.value = "";
  };

  const handleAddPhotoSelected = (file) => {
    if (!file) {
      clearAddPhoto();
      return;
    }
    setAddPhotoDraft(createPhotoDraft(file));
  };

  const applyAddPhotoDraft = async () => {
    if (!addPhotoDraft) return;
    try {
      const cropped = await makeFacultyPhotoFile(addPhotoDraft);
      setAddPhotoFile(cropped);
      setAddPreview(URL.createObjectURL(cropped));
      setAddPhotoDraft(null);
    } catch {
      showFlash("Could not prepare selected photo.", "error");
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    appendFacultyFields(fd, addForm);
    if (addPhotoFile) fd.append("image", addPhotoFile);

    try {
      await api.post("/admin/faculty", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showFlash("Faculty profile added successfully.");
      notifyAdminAccountsChanged();
      formRef.current?.reset();
      setAddForm(defaultFacultyForm());
      clearAddPhoto();
      setShowAddForm(false);
      setPage(1);
      load(1, search);
    } catch (err) {
      const errors = err.response?.data?.errors;
      const first = errors ? Object.values(errors).flat()[0] : null;
      showFlash(first ?? err.response?.data?.message ?? "Failed to add faculty.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, fd) => {
    setSaving(true);
    fd.append("_method", "PUT");
    try {
      await api.post(`/admin/faculty/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showFlash("Faculty profile updated successfully.");
      notifyAdminAccountsChanged();
      setEditing(null);
      load(page, search);
    } catch (err) {
      const errors = err.response?.data?.errors;
      const first = errors ? Object.values(errors).flat()[0] : null;
      showFlash(first ?? err.response?.data?.message ?? "Failed to update faculty.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/faculty/${confirm.id}`);
      showToast?.(`${confirm.name} deleted`, "error");
      notifyAdminAccountsChanged();
      setConfirm(null);
      const newPage = list.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      load(newPage, search);
    } catch (err) {
      showFlash(err.response?.data?.message ?? "Failed to delete faculty.", "error");
      setConfirm(null);
    }
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      showFlash("Choose a CSV file first.", "error");
      return;
    }

    const fd = new FormData();
    fd.append("file", csvFile);
    setImporting(true);

    try {
      const res = await api.post("/admin/faculty/import-csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imported = res.data?.imported ?? 0;
      const skipped = res.data?.skipped ?? 0;
      showFlash(`CSV imported: ${imported} added, ${skipped} skipped.`);
      notifyAdminAccountsChanged();
      setCsvFile(null);
      if (csvRef.current) csvRef.current.value = "";
      setPage(1);
      load(1, search);
    } catch (err) {
      const errors = err.response?.data?.errors;
      const first = errors ? Object.values(errors).flat()[0] : null;
      showFlash(first ?? err.response?.data?.message ?? "Failed to import CSV.", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-6 py-7">
      <PageHdr
        title="Faculty Yearbook Profiles"
        sub="Curate photo-forward faculty profiles for the Sinag-Bughaw yearbook."
        action={
          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            {showAddForm ? "Close Form" : "+ Add Faculty"}
          </button>
        }
      />

      <Flash msg={flash.msg} type={flash.type} onClose={() => setFlash({ msg: "", type: "success" })} />

      <Card>
        <div className="border-b border-slate-200 p-4">
          {showAddForm && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <CardHead
                  title="Add Faculty Profile"
                  sub="Keep it short and presentation-ready for the yearbook."
                />
              </div>

              <form ref={formRef} onSubmit={handleAdd} className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <FField label="Photo">
                  <FacultyPhotoUploadZone
                    fileRef={addFileRef}
                    previewUrl={addPreview || addPhotoDraft?.previewUrl}
                    fileName={addPhotoFile?.name || addPhotoDraft?.file?.name}
                    helperText="Square faculty portrait preferred"
                    onSelect={handleAddPhotoSelected}
                    onRemove={clearAddPhoto}
                  />
                </FField>

                <div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <FField label="Full Name">
                      <FInput name="name" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Dr. Maria Santos" required />
                    </FField>
                    <FField label="Position / Title">
                      <FInput name="title" value={addForm.title} onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))} placeholder="Assistant Professor" required />
                    </FField>
                    <FField label="Department / Program">
                      <FInput name="department" value={addForm.department} onChange={(e) => setAddForm((p) => ({ ...p, department: e.target.value }))} placeholder="BS Information Technology" required />
                    </FField>
                    <FField label="Email" optional>
                      <FInput name="email" type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} placeholder="faculty@nu-lipa.edu.ph" />
                    </FField>
                  </div>
                  <FField label="Short Biography" optional>
                    <FTextarea
                      name="bio"
                      value={addForm.bio}
                      onChange={(e) => setAddForm((p) => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      placeholder="Two to four sentences for the yearbook profile."
                    />
                  </FField>
                  <Btn type="submit" variant="primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Faculty Profile"}
                  </Btn>
                </div>
              </form>
            </div>
          )}

          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="m-0 text-sm font-black">Import faculty CSV</p>
                <p className="m-0 mt-1 text-xs font-semibold text-blue-700">
                  Columns: name, title, department, email, bio
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700 sm:w-80"
                />
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={importing}
                  className="rounded-xl bg-[#1b2a4a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#273a63] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importing ? "Importing..." : "Import CSV"}
                </button>
              </div>
            </div>
          </div>

          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5">
            <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search faculty by name, title, or program"
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="text-slate-400 transition hover:text-slate-600"
              >
                x
              </button>
            )}
          </label>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="p-6">
              <EmptyState msg="No faculty profiles found." />
            </div>
          ) : (
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-black">Faculty</th>
                  <th className="px-5 py-3 font-black">Position</th>
                  <th className="px-5 py-3 font-black">Program</th>
                  <th className="px-5 py-3 font-black">Email</th>
                  <th className="px-5 py-3 font-black">Biography</th>
                  <th className="px-5 py-3 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((fac) => (
                  <FacultyRow
                    key={fac.id}
                    fac={fac}
                    isEditing={editing === fac.id}
                    saving={saving}
                    onToggleEdit={() => setEditing(editing === fac.id ? null : fac.id)}
                    onUpdate={(fd) => handleUpdate(fac.id, fd)}
                    onDelete={() => setConfirm({ id: fac.id, name: fac.name })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pager
          from={meta?.from ?? 0}
          to={meta?.to ?? 0}
          total={meta?.total ?? 0}
          hasPrev={page > 1}
          hasNext={meta ? page < meta.last_page : false}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </Card>

      <ConfirmModal
        open={!!confirm}
        title="Delete Faculty Profile"
        message={`Are you sure you want to delete "${confirm?.name}"? This profile will be moved to trash.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />

      <FacultyPhotoEditor
        draft={addPhotoDraft}
        setDraft={setAddPhotoDraft}
        fileRef={addFileRef}
        saving={saving}
        onCancel={clearAddPhoto}
        onApply={applyAddPhotoDraft}
      />
    </div>
  );
}

function FacultyPhotoEditor({ draft, setDraft, fileRef, saving, onCancel, onApply }) {
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const clamp = (value) => Math.max(-45, Math.min(45, Math.round(value)));

  if (!draft) return null;

  const previewStyle = {
    left: `${50 + draft.x}%`,
    top: `${50 + draft.y}%`,
    transform: `translate(-50%, -50%) scale(${draft.zoom})`,
    width: draft.aspect >= 1 ? "auto" : "100%",
    height: draft.aspect >= 1 ? "100%" : "auto",
  };

  const startDrag = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: draft.x,
      originY: draft.y,
    };
  };

  const moveDrag = (e) => {
    if (!dragRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nextX = dragRef.current.originX + ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const nextY = dragRef.current.originY + ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    setDraft((current) => current ? { ...current, x: clamp(nextX), y: clamp(nextY) } : current);
  };

  const stopDrag = (e) => {
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="m-0 text-base font-black text-slate-800">Position Faculty Photo</h3>
            <p className="m-0 mt-0.5 text-xs text-slate-500">Drag and zoom the portrait before saving it.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Cancel photo"
          >
            x
          </button>
        </div>

        <div className="px-5 py-5">
          <div
            className="relative mx-auto h-56 w-56 touch-none cursor-grab overflow-hidden rounded-2xl border-4 border-indigo-100 bg-slate-100 shadow-inner active:cursor-grabbing"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <img
              src={draft.previewUrl}
              alt="Faculty photo preview"
              className="absolute max-w-none select-none"
              style={previewStyle}
              onLoad={(e) => {
                const image = e.currentTarget;
                const aspect = image.naturalWidth / image.naturalHeight;
                setDraft((current) => current ? { ...current, aspect } : current);
              }}
              draggable="false"
            />
          </div>

          <label className="mt-5 block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Zoom</span>
              <span className="text-[11px] font-bold text-slate-700">{Math.round(draft.zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="2.4"
              step="0.01"
              value={draft.zoom}
              onChange={(e) => setDraft((current) => current ? { ...current, zoom: Number(e.target.value) } : current)}
              className="w-full accent-indigo-600"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Choose Another
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              Use Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacultyRow({ fac, isEditing, saving, onToggleEdit, onUpdate, onDelete }) {
  const [form, setForm] = useState(defaultFacultyForm(fac));
  const [editPreview, setEditPreview] = useState(null);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoDraft, setEditPhotoDraft] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(defaultFacultyForm(fac));
  }, [fac]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const clearEditPhoto = () => {
    setEditPreview(null);
    setEditPhotoFile(null);
    setEditPhotoDraft(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleEditPhotoSelected = (file) => {
    if (!file) {
      clearEditPhoto();
      return;
    }
    setEditPhotoDraft(createPhotoDraft(file));
  };

  const applyEditPhotoDraft = async () => {
    if (!editPhotoDraft) return;
    try {
      const cropped = await makeFacultyPhotoFile(editPhotoDraft);
      setEditPhotoFile(cropped);
      setEditPreview(URL.createObjectURL(cropped));
      setEditPhotoDraft(null);
    } catch {
      setEditPhotoDraft(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    appendFacultyFields(fd, form);
    if (editPhotoFile) fd.append("image", editPhotoFile);
    onUpdate(fd);
    clearEditPhoto();
  };

  const handleToggleEdit = () => {
    if (isEditing) clearEditPhoto();
    onToggleEdit();
  };

  return (
    <>
      <tr className="border-b border-slate-200 bg-white align-middle transition hover:bg-slate-50">
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            {fac.photo ? (
              <img src={fac.photo} alt={fac.name} className="h-12 w-12 shrink-0 rounded-full border-2 border-amber-300 object-cover" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-amber-300 bg-[#1b2a4a] text-sm font-black text-amber-400">
                {initialsFor(fac.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-black text-[#1b2a4a]">{fac.name}</p>
              <p className="m-0 mt-0.5 text-xs font-semibold text-slate-400">Yearbook faculty profile</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-4 text-sm font-bold text-slate-700">{fac.title || "—"}</td>
        <td className="px-5 py-4">
          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            {fac.department || "—"}
          </span>
        </td>
        <td className="px-5 py-4 text-sm text-slate-500">
          {fac.email ? <a href={`mailto:${fac.email}`} className="text-slate-600 no-underline hover:text-indigo-700">{fac.email}</a> : "—"}
        </td>
        <td className="max-w-md px-5 py-4 text-sm leading-relaxed text-slate-500">
          <span className="line-clamp-2">{fac.bio || "—"}</span>
        </td>
        <td className="px-5 py-4 text-right">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleEdit}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
            {!isEditing && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>

      {isEditing && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td colSpan={6} className="px-5 py-5">
            <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <FField label="Photo">
                <FacultyPhotoUploadZone
                  fileRef={fileRef}
                  previewUrl={editPreview || editPhotoDraft?.previewUrl}
                  fileName={editPhotoFile?.name || editPhotoDraft?.file?.name}
                  helperText={fac.photo ? "Pick a new portrait to replace the current photo." : "Square faculty portrait preferred."}
                  onSelect={handleEditPhotoSelected}
                  onRemove={clearEditPhoto}
                />
              </FField>
              <div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FField label="Full Name">
                    <FInput value={form.name} onChange={(e) => set("name", e.target.value)} required />
                  </FField>
                  <FField label="Position / Title">
                    <FInput value={form.title} onChange={(e) => set("title", e.target.value)} required />
                  </FField>
                  <FField label="Department / Program">
                    <FInput value={form.department} onChange={(e) => set("department", e.target.value)} required />
                  </FField>
                  <FField label="Email" optional>
                    <FInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </FField>
                </div>
                <FField label="Short Biography" optional>
                  <FTextarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} />
                </FField>
                <div className="flex gap-2 pt-1">
                  <Btn type="submit" variant="primary" disabled={saving}>
                    {saving ? "Saving..." : "Update Profile"}
                  </Btn>
                  <Btn type="button" variant="danger" onClick={onDelete}>
                    Delete
                  </Btn>
                </div>
              </div>
              <FacultyPhotoEditor
                draft={editPhotoDraft}
                setDraft={setEditPhotoDraft}
                fileRef={fileRef}
                saving={saving}
                onCancel={clearEditPhoto}
                onApply={applyEditPhotoDraft}
              />
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

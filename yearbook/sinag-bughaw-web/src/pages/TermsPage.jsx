import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">Sinag-Bughaw</p>
        <h1 className="mt-2 text-3xl font-black text-[#1d2b4b]">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-slate-500">National University Lipa digital yearbook. Last updated October 14, 2026.</p>

        <section className="mt-8 space-y-3 text-sm leading-7">
          <h2 className="text-lg font-black text-[#1d2b4b]">Using the yearbook</h2>
          <p>
            Sinag-Bughaw is a private yearbook for enrolled students, alumni, and faculty of National University Lipa.
            You may create one account for yourself. Sharing your password, or signing in on more devices than the
            platform allows, can end your other sessions.
          </p>
          <p>
            Photos, captions, and tags you post must be your own or shared with permission. Do not upload content that
            harasses, exposes private information, or includes someone who asked not to be shown.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-7">
          <h2 className="text-lg font-black text-[#1d2b4b]">Privacy and data use</h2>
          <p>
            The yearbook stores the account and student details you submit at registration: name, student number,
            email, course, batch, graduation year, and the time you accepted these terms. Yearbook records prepared
            by the school (section, honors, portrait) may be linked to that account after verification.
          </p>
          <p>
            Photos you upload, including Share Memories posts, are stored so classmates can view them according to the
            visibility you choose: Public, Batchmates, or Only Me. Tagging a classmate stores the connection between
            that photo and their account and may send them a notification. A tagged person only sees a photo when its
            visibility allows it.
          </p>
          <p>
            Face recognition, when enabled by the school, compares portraits already on file with photos in the
            yearbook so classmates can be suggested or found. It is used for yearbook discovery inside this platform,
            not sold, and not used for advertising. You can ask the yearbook office to review or remove a portrait
            association.
          </p>
          <p>
            Profile views, content views, and yearbook downloads are counted so administrators can see real activity.
            Those counts come from the actions stored in the database.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-sm leading-7">
          <h2 className="text-lg font-black text-[#1d2b4b]">Accounts and alumni status</h2>
          <p>
            A graduate is marked as an alumnus from the graduation year on the verified student record or from the
            year you enter at registration when that year is the current year or earlier. Alumni-only pages and
            alumni-only profiles stay limited to those accounts.
          </p>
        </section>

        <p className="mt-10 text-sm">
          <Link to="/register" className="font-bold text-[#3f51b5]">Back to registration</Link>
        </p>
      </div>
    </main>
  );
}

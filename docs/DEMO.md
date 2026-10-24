# Student Saathi: demo guide

A 5 to 7 minute click-through that touches every role: admin setup, faculty attendance and marks, an assignment
(posted, handed in early and late, graded) and what the student sees back.

## Before you start

```powershell
# terminal 1: backend
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_demo --reset     # clean demo data (also deletes old demo files)
python manage.py runserver

# terminal 2: frontend
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

If you run the frontend on another port, add it to `CORS_ALLOWED_ORIGINS` in `backend/.env` and restart the backend.

## Accounts

All passwords are `demo1234`.

| Role | Usernames | Notes |
| --- | --- | --- |
| Admin | `admin` | Sets up subjects, sections, teaching and enrollments |
| Faculty | `faculty1` (Data Structures, Databases), `faculty2` (OS, Discrete Maths), `faculty3` (Communication) | Each teaches sections A and B |
| Students | `student01`-`student15` (section A), `student16`-`student30` (section B) | |

Students worth knowing: `student01` healthy, `student03` low attendance, `student07` failing, `student12` sharp score
drop, `student18` attendance warning, `student25` low attendance and failing.

Use the **Student / Faculty / Admin** switch on the login page that matches the account. Choosing the wrong one
shows "This account is not a … account" and does not log you in.

## The script

### 1. Admin: set up a new subject (1 min)

1. Log in as `admin`. The Overview shows live counts (30 students, 3 faculty, ...).
2. **Subjects** → *New subject*: code `DEMO-101`, name `Demo Seminar`, credits `2`, semester `3` → *Create subject*.
   Try the same code again to see the friendly duplicate message on the field.
3. **Teaching assignments** → *New assignment*: faculty `Anita Rao (DMF001)`, subject `DEMO-101`, section **A**.
4. **Enrollments** → choose `DEMO-101` → *Enrol a whole section* → section **A** → *Enrol section*. It reports how
   many students were added; run it again to see it is harmless ("all 15 students are already in DEMO-101").
5. Log out (sidebar).

### 2. Faculty: attendance and marks (2 min)

1. Log in as `faculty1`. The dashboard shows class averages, the at-risk students and **Submissions to grade**.
2. **Attendance** → class `DEMO-101 (A)`, today, any period → *Start / open session*. Everyone starts Present.
   Mark `student02` **Absent** and `student03` **Late** → *Save*. The summary tiles update live; the history table
   below lists the session.
3. **Assessments** → *New assessment*: `Quiz 1`, Quiz, today, max `20` → *Create assessment*. In *Enter marks* give
   `student01` `18`, `student02` `9`, tick **Absent** for `student03` → *Save marks*. (A mark above 20 is refused
   inline; a blank means "not graded yet".)
4. **Students** → `DEMO-101 (A)`. Each row shows the student's attendance and average marks with a "vs class"
   difference (icon plus +/- points), and the class average is in the column headers.

### 3. Faculty: post an assignment (1 min)

1. **Assignments** → class `DEMO-101 (A)` → *New assignment*: title `Reflection essay`, due **in about 10 minutes**
   (IST), max marks `20`, leave *Accept late submissions* on → *Post assignment*.
2. Open it (*Submissions*): every enrolled student is listed, all **Not submitted**. Leave this tab open.

### 4. Student: hand in early, then see lateness (1.5 min)

1. In a private window log in as `student01`. **Assignments** → *Upcoming* → *Reflection essay* shows the due time
   in IST with "in 10 minutes". *Submit work* → drop a PDF (try a `.exe` first to see the instant type check) →
   *Submit*. The card now says **Submitted** and, for example, "Submitted 9 minutes before the deadline".
2. Log in as `student02` in another window and submit as well.
3. Back in the faculty window, refresh the submissions page: both rows show the time they were submitted and the
   timing wording, with a **Download** button each. The file is fetched with your login; there is no public link.
4. **Make one late:** *Assignments* → *Edit* the essay and move the due time to **15 minutes ago** → save. Timing is
   recalculated for the existing submissions: `student01` now reads, for example, "11 minutes late" with a **Late**
   chip. No resubmission needed.

### 5. Faculty grades, student sees the result (1 min)

1. On the submissions page enter marks (for example `17`) and feedback for `student01` → *Save*. The row confirms
   "Saved." and the status becomes **Graded**. Try `25`: it is refused, because the maximum is 20.
2. As `student01`: **Assignments → Graded** shows the marks, the maximum and the feedback. *Replace submission* is
   gone, because graded work can't be changed.
3. **Dashboard**: the new *Assignments* panel shows "Recently graded". The subject card reads
   "You: 85% | Class avg: …" for marks and for attendance, with an up or down arrow and the number of points.
   **Performance** and **My attendance** show the same comparison per subject.

### 6. Extra, if there is time

- Log in as `student03` (low attendance) or `student07` (failing): critical alerts on the dashboard, with the
  "attend N more classes in a row" guidance.
- Faculty **Export CSV** on Students (attendance/marks) and on an assignment (submissions with IST timestamps).
- Dark mode toggle in any top bar; resize to phone width to see the sidebar become a drawer.
- Strict deadlines: in the seeded data *Problem Set 2* does not accept late work, so a student who missed it sees
  "no longer accepts submissions" instead of an upload form.

## Resetting

```powershell
python manage.py seed_demo --reset     # restores the seeded data and replaces the demo files
```

This removes only the seeded demo data (subjects `DM-*`, the demo users, their assignments and files). The `DEMO-101`
subject you created above is not part of it, and once it has attendance, marks or assignments the server refuses to
delete it (that protects real records). For a completely clean slate delete `backend/db.sqlite3` and
`backend/media/`, then run `python manage.py migrate` and `python manage.py seed_demo` again.

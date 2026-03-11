import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./CgpaCalculator.module.css";

// ── Constants ──
const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const AVAILABLE_GRADES = ["A", "B", "C", "D", "E", "F"];
const SEMESTER_NAMES = { 1: "First", 2: "Second" };

function gradePoint(g) {
  return GRADE_POINTS[g] ?? 0;
}

function getHonours(cgpa) {
  if (cgpa === null) return { label: "", emoji: "" };
  if (cgpa >= 4.5) return { label: "First Class Honours", emoji: "🥇" };
  if (cgpa >= 3.5) return { label: "Second Class Upper (2:1)", emoji: "🥈" };
  if (cgpa >= 2.4) return { label: "Second Class Lower (2:2)", emoji: "🥉" };
  if (cgpa >= 1.5) return { label: "Third Class Honours", emoji: "📋" };
  return { label: "Pass", emoji: "📄" };
}

// ── ID Generators ──
let _semId = Date.now();
let _crsId = Date.now();

const newCourse = () => ({ id: ++_crsId, code: "", unit: "", grade: "A" });
const newSemester = (year, sem) => ({
  id: ++_semId,
  year,
  semesterNum: sem,
  gpa: null,
  courses: [newCourse()],
});

function CgpaCalculator() {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([newSemester(1, 1)]);
  const [cgpa, setCgpa] = useState(null);
  const [cgpaError, setCgpaError] = useState(false);
  const [scrollToSemId, setScrollToSemId] = useState(null);
  const [shouldScrollToCgpa, setShouldScrollToCgpa] = useState(false);
  const cgpaCardRef = useRef(null);
  const semCardRefs = useRef({});

  // Scroll to semester header after GPA is calculated
  useEffect(() => {
    if (scrollToSemId == null) return;
    const el = semCardRefs.current[scrollToSemId];
    if (el) {
      const topbarH = 56 + 12;
      const y = el.getBoundingClientRect().top + window.scrollY - topbarH;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setScrollToSemId(null);
  }, [semesters, scrollToSemId]);

  // Scroll to CGPA card after it renders
  useEffect(() => {
    if (!shouldScrollToCgpa) return;
    if (cgpaCardRef.current) {
      const topbarH = 56 + 12;
      const y = cgpaCardRef.current.getBoundingClientRect().top + window.scrollY - topbarH;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setShouldScrollToCgpa(false);
  }, [cgpa, shouldScrollToCgpa]);

  const honours = getHonours(cgpa);

  // ── Semester Actions ──
  const addSemester = () => {
    setSemesters((prev) => {
      const last = prev[prev.length - 1];
      const nextNum = last.semesterNum === 1 ? 2 : 1;
      const nextYear = last.semesterNum === 2 ? last.year + 1 : last.year;
      return [...prev, newSemester(nextYear, nextNum)];
    });
  };

  const removeSemester = () => {
    setSemesters((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // ── Course Actions ──
  const addCourse = (semId) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semId ? { ...s, courses: [...s.courses, newCourse()] } : s
      )
    );
  };

  const deleteCourse = (semId, courseId) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semId
          ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) }
          : s
      )
    );
  };

  const deleteAllCourses = (semId) => {
    if (!window.confirm("Delete all courses in this semester?")) return;
    setSemesters((prev) =>
      prev.map((s) => (s.id === semId ? { ...s, courses: [] } : s))
    );
  };

  const updateCourse = (semId, courseId, field, val) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semId
          ? {
              ...s,
              courses: s.courses.map((c) =>
                c.id === courseId ? { ...c, [field]: val } : c
              ),
            }
          : s
      )
    );
  };

  // ── GPA per semester ──
  const calculateGPA = (semId) => {
    setSemesters((prev) =>
      prev.map((s) => {
        if (s.id !== semId) return s;
        if (s.courses.length === 0) return { ...s, gpa: null };
        const totalUnits = s.courses.reduce((acc, c) => acc + (Number(c.unit) || 0), 0);
        const hasInvalid = s.courses.some(
          (c) => !c.unit || isNaN(Number(c.unit)) || Number(c.unit) <= 0
        );
        if (hasInvalid || totalUnits === 0) return { ...s, gpa: "error" };
        const weighted = s.courses.reduce(
          (acc, c) => acc + (Number(c.unit) || 0) * gradePoint(c.grade),
          0
        );
        return { ...s, gpa: weighted / totalUnits };
      })
    );
    setScrollToSemId(semId);
  };

  // ── CGPA ──
  const calculateCGPA = () => {
    setCgpaError(false);
    let valid = true;

    for (const s of semesters) {
      if (s.courses.length === 0) continue;
      const totalUnits = s.courses.reduce((acc, c) => acc + (Number(c.unit) || 0), 0);
      const hasInvalid = s.courses.some(
        (c) => !c.unit || isNaN(Number(c.unit)) || Number(c.unit) <= 0
      );
      if (hasInvalid || totalUnits === 0) {
        valid = false;
        break;
      }
    }

    if (!valid) {
      setCgpa(null);
      setCgpaError(true);
      alert("Please fill all course units with valid numbers first.");
      return;
    }

    const validSems = semesters.filter((s) => s.courses.length > 0);
    if (validSems.length === 0) { setCgpa(null); return; }

    const totalUnitsAll = validSems.reduce(
      (acc, s) => acc + s.courses.reduce((a, c) => a + (Number(c.unit) || 0), 0),
      0
    );
    const weightedAll = validSems.reduce(
      (acc, s) =>
        acc + s.courses.reduce((a, c) => a + (Number(c.unit) || 0) * gradePoint(c.grade), 0),
      0
    );

    if (totalUnitsAll === 0) { setCgpa(null); return; }
    setCgpa(weightedAll / totalUnitsAll);
    setShouldScrollToCgpa(true);
  };

  // ── Group by year ──
  const byYear = semesters.reduce((acc, s) => {
    if (!acc[s.year]) acc[s.year] = [];
    acc[s.year].push(s);
    return acc;
  }, {});

  return (
    <div className={styles.homeContainer}>
      <SideBar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.mainContent}>
          <div className={styles.page}>

            {/* Page Header */}
            <div className={styles.pageHeader}>
              <div className={styles.pageEyebrow}>CGPA Suite</div>
              <h1 className={styles.pageTitle}>
                CGPA <em>Calculator</em>
              </h1>
            </div>

            {/* CGPA Result Card */}
            {cgpa !== null && (
              <div className={styles.cgpaResultCard} ref={cgpaCardRef}>
                <div className={styles.cgpaResultLeft}>
                  <div className={styles.cgpaResultLabel}>Cumulative GPA</div>
                  <div className={styles.cgpaResultValue}>{cgpa.toFixed(2)}</div>
                  <div className={styles.cgpaHonours}>{honours.label}</div>
                </div>
                <div className={styles.cgpaEmoji}>{honours.emoji}</div>
              </div>
            )}

            {/* Semesters by Year */}
            {Object.entries(byYear).map(([year, yearSems]) => (
              <div key={year} className={styles.yearBlock}>
                <div className={styles.yearLabel}>Year {year}</div>

                {yearSems.map((sem) => {
                  const totalUnits = sem.courses.reduce(
                    (acc, c) => acc + (Number(c.unit) || 0),
                    0
                  );
                  const weightedTotal = sem.courses.reduce(
                    (acc, c) => acc + (Number(c.unit) || 0) * gradePoint(c.grade),
                    0
                  );
                  const gpaVisible = sem.gpa !== null && sem.gpa !== "error";
                  const gpaError = sem.gpa === "error";

                  return (
                    <div
                      key={sem.id}
                      className={styles.semesterCard}
                      ref={(el) => { semCardRefs.current[sem.id] = el; }}
                    >
                      {/* Semester Header */}
                      <div className={styles.semesterHeader}>
                        <span className={styles.semesterTitle}>
                          {SEMESTER_NAMES[sem.semesterNum]} Semester
                        </span>
                        <span
                          className={`${styles.semesterGpaPill}${gpaVisible ? ` ${styles.visible}` : ""}${gpaError ? ` ${styles.error}` : ""}`}
                        >
                          {gpaError
                            ? "Check inputs"
                            : gpaVisible
                            ? `GPA: ${sem.gpa.toFixed(2)}`
                            : ""}
                        </span>
                      </div>

                      {/* Courses Table */}
                      <div className={styles.coursesTableWrap}>
                        {sem.courses.length > 0 ? (
                          <table className={styles.coursesTable}>
                            <thead>
                              <tr>
                                <th style={{ width: "36px", textAlign: "center" }}>S/N</th>
                                <th>CODE</th>
                                <th style={{ width: "64px", textAlign: "center" }}>UNITS</th>
                                <th style={{ width: "58px", textAlign: "center" }}>GRADE</th>
                                <th style={{ width: "50px", textAlign: "center" }}>TCU</th>
                                <th style={{ width: "32px" }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sem.courses.map((c, idx) => (
                                <tr key={c.id}>
                                  <td className={styles.cellSn}>{idx + 1}</td>
                                  <td>
                                    <input
                                      className={styles.cellInput}
                                      type="text"
                                      placeholder="e.g. ENG 301"
                                      value={c.code}
                                      onChange={(e) => {
                                        const upper = e.target.value.toUpperCase();
                                        updateCourse(sem.id, c.id, "code", upper);
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className={styles.cellInput}
                                      type="number"
                                      min="1"
                                      max="6"
                                      placeholder="e.g. 1"
                                      value={c.unit}
                                      onChange={(e) =>
                                        updateCourse(sem.id, c.id, "unit", e.target.value)
                                      }
                                    />
                                  </td>
                                  <td>
                                    <select
                                      className={styles.cellSelect}
                                      value={c.grade}
                                      onChange={(e) =>
                                        updateCourse(sem.id, c.id, "grade", e.target.value)
                                      }
                                    >
                                      {AVAILABLE_GRADES.map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className={styles.cellTcu}>
                                    {(Number(c.unit) || 0) * gradePoint(c.grade)}
                                  </td>
                                  <td className={styles.cellDel}>
                                    <button
                                      className={styles.deleteRowBtn}
                                      onClick={() => deleteCourse(sem.id, c.id)}
                                      title="Remove course"
                                    >
                                      <i className="fa-solid fa-xmark"></i>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className={styles.summaryRow}>
                                <td colSpan={2} style={{ textAlign: "left" }}>TOTAL</td>
                                <td style={{ textAlign: "left" }}><strong>{totalUnits}</strong></td>
                                <td></td>
                                <td style={{ textAlign: "center" }}><strong>{weightedTotal}</strong></td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        ) : (
                          <div className={styles.noCourses}>
                            <i className="fa-regular fa-circle-dot"></i> No courses added yet.
                          </div>
                        )}
                      </div>

                      {/* Semester Controls */}
                      <div className={styles.semesterControls}>
                        <button
                          className={`${styles.btn} ${styles.btnAddCourse}`}
                          onClick={() => addCourse(sem.id)}
                        >
                          <i className="fa-solid fa-plus"></i> Add Course
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnDeleteAll}`}
                          onClick={() => deleteAllCourses(sem.id)}
                        >
                          <i className="fa-solid fa-trash"></i> Delete All
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnCalcGpa}`}
                          onClick={() => calculateGPA(sem.id)}
                        >
                          <i className="fa-solid fa-equals"></i> Calculate GPA
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* CGPA Controls */}
            <div className={styles.cgpaControlsWrap}>
              <div className={styles.cgpaControlsLabel}>Manage Semesters</div>
              <div className={styles.cgpaControls}>
                <button
                  className={`${styles.btn} ${styles.btnAddSem}`}
                  onClick={addSemester}
                >
                  <i className="fa-solid fa-plus"></i> Add Semester
                </button>
                <button
                  className={`${styles.btn} ${styles.btnRemoveSem}`}
                  onClick={removeSemester}
                  disabled={semesters.length <= 1}
                >
                  <i className="fa-solid fa-minus"></i> Remove Last
                </button>
                <button
                  className={`${styles.btn} ${styles.btnCalcCgpa}`}
                  onClick={calculateCGPA}
                >
                  <i className="fa-solid fa-chart-simple"></i> Calculate CGPA
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* Floating Summary Button */}
      <button
        className={styles.floatBtn}
        title="View Summary"
        onClick={() => navigate("/cgpa-summary")}
      >
        <i className="fa-solid fa-chart-pie"></i>
        <span>SUMMARY</span>
      </button>
    </div>
  );
}

export default CgpaCalculator;

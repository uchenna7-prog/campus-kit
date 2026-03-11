import { useNavigate } from "react-router-dom";
import SideBar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./CgpaCalculator.module.css";
import { useGpa } from "../../contexts/GpaContext";
import { useSettings } from "../../contexts/SettingsContext";
import FloatingSummaryButton from "./FloatingSummaryButton"; // Assuming you keep this logic

const SEMESTER_NAMES = { 1: "First", 2: "Second" };

function getHonours(cgpa) {
  if (cgpa === null) return { label: "", emoji: "" };
  if (cgpa >= 4.5) return { label: "First Class Honours", emoji: "🥇" };
  if (cgpa >= 3.5) return { label: "Second Class Upper (2:1)", emoji: "🥈" };
  if (cgpa >= 2.4) return { label: "Second Class Lower (2:2)", emoji: "🥉" };
  if (cgpa >= 1.5) return { label: "Third Class Honours", emoji: "📋" };
  return { label: "Pass", emoji: "📄" };
}

function CgpaCalculator() {
  const navigate = useNavigate();
  const {
    semesters,
    cgpa,
    addSemester,
    removeSemester,
    calculateCGPA,
    updateCourse,
    addCourse,
    deleteCourse,
    deleteAllCourses,
    calculateSemesterGPA,
  } = useGpa();

  const { decimalPlaces, showGradePoints, confirmDelete, gradePoints, availableGrades } = useSettings();

  const dp = Number(decimalPlaces);
  const honours = getHonours(cgpa);

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
              <div className={`${styles.cgpaResultCard} ${styles.visible}`}>
                <div className={styles.cgpaResultLeft}>
                  <div className={styles.cgpaResultLabel}>Cumulative GPA</div>
                  <div className={styles.cgpaResultValue}>{cgpa.toFixed(dp)}</div>
                  <div className={styles.cgpaHonours}>{honours.label}</div>
                </div>
                <div className={styles.cgpaEmoji}>{honours.emoji}</div>
              </div>
            )}

            {/* Year/Semester Blocks */}
            {Object.entries(byYear).map(([year, yearSemesters]) => (
              <div key={year} className={styles.yearBlock}>
                <div className={styles.yearLabel}>Year {year}</div>
                {yearSemesters.map((sem) => {
                  const totalUnits = sem.courses.reduce((s, c) => s + (Number(c.unit) || 0), 0);
                  const weightedTotal = sem.courses.reduce((s, c) => s + (Number(c.unit) || 0) * gradePoints(c.grade), 0);
                  const isGpaValid = sem.gpa !== null && sem.gpa !== "error";

                  return (
                    <div key={sem.id} className={styles.semesterCard}>
                      <div className={styles.semesterHeader}>
                        <span className={styles.semesterTitle}>{SEMESTER_NAMES[sem.semesterNum]} Semester</span>
                        {isGpaValid && (
                          <span className={styles.semesterGpaPill}>
                            GPA: {sem.gpa.toFixed(dp)}
                          </span>
                        )}
                        {sem.gpa === "error" && (
                          <span className={`${styles.semesterGpaPill} ${styles.error}`}>Check inputs</span>
                        )}
                      </div>

                      <div className={styles.coursesTableWrap}>
                        <table className={styles.coursesTable}>
                          <thead>
                            <tr>
                              <th style={{ width: "36px", textAlign: "center" }}>S/N</th>
                              <th>CODE</th>
                              <th style={{ width: "64px", textAlign: "center" }}>UNITS</th>
                              <th style={{ width: "58px", textAlign: "center" }}>GRADE</th>
                              {showGradePoints && <th style={{ width: "50px", textAlign: "center" }}>TCU</th>}
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
                                    onChange={(e) => updateCourse(sem.id, c.id, "code", e.target.value.toUpperCase())}
                                  />
                                </td>
                                <td>
                                  <input
                                    className={styles.cellInput}
                                    type="number"
                                    value={c.unit}
                                    onChange={(e) => updateCourse(sem.id, c.id, "unit", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <select
                                    className={styles.cellSelect}
                                    value={c.grade}
                                    onChange={(e) => updateCourse(sem.id, c.id, "grade", e.target.value)}
                                  >
                                    {availableGrades.map((g) => (
                                      <option key={g} value={g}>{g}</option>
                                    ))}
                                  </select>
                                </td>
                                {showGradePoints && (
                                  <td className={styles.cellTcu}>{(Number(c.unit) || 0) * gradePoints(c.grade)}</td>
                                )}
                                <td className={styles.cellDel}>
                                  <button 
                                    className={styles.deleteRowBtn} 
                                    onClick={() => deleteCourse(sem.id, c.id)}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={styles.summaryRow}>
                              <td colSpan="2" style={{ textAlign: "left" }}>TOTAL</td>
                              <td style={{ textAlign: "center" }}><strong>{totalUnits}</strong></td>
                              <td></td>
                              {showGradePoints && <td style={{ textAlign: "center" }}><strong>{weightedTotal}</strong></td>}
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className={styles.semesterControls}>
                        <button className={`${styles.btn} ${styles.btnAddCourse}`} onClick={() => addCourse(sem.id)}>
                          <i className="fa-solid fa-plus"></i> Add Course
                        </button>
                        <button className={`${styles.btn} ${styles.btnDeleteAll}`} onClick={() => deleteAllCourses(sem.id)}>
                          <i className="fa-solid fa-trash"></i> Delete All
                        </button>
                        <button className={`${styles.btn} ${styles.btnCalcGpa}`} onClick={() => calculateSemesterGPA(sem.id)}>
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
                <button className={`${styles.btn} ${styles.btnAddSem}`} onClick={addSemester}>
                  <i className="fa-solid fa-plus"></i> Add Semester
                </button>
                <button
                  className={`${styles.btn} ${styles.btnRemoveSem}`}
                  onClick={removeSemester}
                  disabled={semesters.length <= 1}
                >
                  <i className="fa-solid fa-minus"></i> Remove Last
                </button>
                <button className={`${styles.btn} ${styles.btnCalcCgpa}`} onClick={calculateCGPA}>
                  <i className="fa-solid fa-chart-simple"></i> Calculate CGPA
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
      <FloatingSummaryButton onClick={() => navigate("/summary")} />
    </div>
  );
}

export default CgpaCalculator;

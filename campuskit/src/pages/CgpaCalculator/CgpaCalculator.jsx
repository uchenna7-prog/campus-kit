import { useState, useCallback, useRef } from "react";
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
  // Initialize with one semester so the page isn't empty
  const [semesters, setSemesters] = useState([newSemester(1, 1)]);
  const [cgpa, setCgpa] = useState(null);
  const semesterRefs = useRef({});

  const honours = getHonours(cgpa);

  // ── Handlers ──
  const addSemester = () => {
    setSemesters((prev) => {
      const last = prev[prev.length - 1];
      const nextNum = last.semesterNum === 1 ? 2 : 1;
      const nextYear = last.semesterNum === 2 ? last.year + 1 : last.year;
      return [...prev, newSemester(nextYear, nextNum)];
    });
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

  const calculateCGPA = () => {
    let totalWeightedPoints = 0;
    let totalUnits = 0;

    semesters.forEach((s) => {
      s.courses.forEach((c) => {
        const units = Number(c.unit) || 0;
        totalUnits += units;
        totalWeightedPoints += units * gradePoint(c.grade);
      });
    });

    if (totalUnits > 0) {
      setCgpa(totalWeightedPoints / totalUnits);
    }
  };

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
            <div className={styles.pageHeader}>
              <div className={styles.pageEyebrow}>CGPA Suite</div>
              <h1 className={styles.pageTitle}>
                CGPA <em>Calculator</em>
              </h1>
            </div>

            {cgpa !== null && (
              <div className={styles.cgpaResultCard}>
                <div className={styles.cgpaResultLeft}>
                  <div className={styles.cgpaResultLabel}>Cumulative GPA</div>
                  <div className={styles.cgpaResultValue}>{cgpa.toFixed(2)}</div>
                  <div className={styles.cgpaHonours}>{honours.label}</div>
                </div>
                <div className={styles.cgpaEmoji}>{honours.emoji}</div>
              </div>
            )}

            {Object.entries(byYear).map(([year, yearSemesters]) => (
              <div key={year} className={styles.yearBlock}>
                <div className={styles.yearLabel}>Year {year}</div>
                {yearSemesters.map((sem) => (
                  <div key={sem.id} className={styles.semesterCard}>
                    <div className={styles.semesterHeader}>
                      <span className={styles.semesterTitle}>
                        {SEMESTER_NAMES[sem.semesterNum]} Semester
                      </span>
                    </div>
                    <div className={styles.coursesTableWrap}>
                      <table className={styles.coursesTable}>
                        <thead>
                          <tr>
                            <th>S/N</th>
                            <th>CODE</th>
                            <th>UNITS</th>
                            <th>GRADE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sem.courses.map((c, idx) => (
                            <tr key={c.id}>
                              <td className={styles.cellSn}>{idx + 1}</td>
                              <td>
                                <input
                                  className={styles.cellInput}
                                  value={c.code}
                                  onChange={(e) => updateCourse(sem.id, c.id, "code", e.target.value)}
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
                                  {AVAILABLE_GRADES.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className={styles.cgpaControls}>
              <button className={styles.btn} onClick={addSemester}>Add Semester</button>
              <button className={styles.btn} onClick={calculateCGPA}>Calculate CGPA</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CgpaCalculator;

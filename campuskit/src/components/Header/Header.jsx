import { useLocation } from "react-router-dom";
import styles from "./Header.module.css";

const PAGE_META = {
  "/":             { title: "CGPA Calculator",    sub: "Academic Tools"    },
  "/gpa-predictor":{ title: "GPA Predictor",      sub: "Academic Tools"    },
  "/timetable":    { title: "Study Timetable",    sub: "Academic Tools"    },
  "/passport":     { title: "Passport Maker",     sub: "Student Utilities" },
  "/scanner":      { title: "Document Scanner",   sub: "Student Utilities" },
  "/pdf":          { title: "PDF Tools",          sub: "Student Utilities" },
  "/scholarships": { title: "Scholarship Finder", sub: "Opportunities"     },
  "/internships":  { title: "Internship Finder",  sub: "Opportunities"     },
  "/ai":           { title: "CampusKit AI",       sub: null                },
  "/settings":     { title: "Settings",           sub: null                },
  "/help":         { title: "Help & Feedback",    sub: null                },
  "/summary":      { title: "Summary",            sub: "CGPA Calculator"   },
};

export default function Header() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? { title: "CampusKit", sub: null };

  const openSidebar = () => {
    window.dispatchEvent(new Event("sidebar:open"));
  };

  return (
    <header className={styles.topbar}>
      {/* Mobile hamburger — only visible on small screens */}
      <button
        className={styles.menuBtn}
        onClick={openSidebar}
        aria-label="Open menu"
      >
        <i className="fa-solid fa-bars" />
      </button>

      {/* Page title */}
      <div className={styles.titleWrap}>
        <span className={styles.title}>{meta.title}</span>
        {meta.sub && <span className={styles.sub}>{meta.sub}</span>}
      </div>

      {/* Right actions */}
      <div className={styles.actions}>
        <button className={styles.iconBtn} aria-label="Settings">
          <i className="fa-solid fa-sliders" />
        </button>
        <button className={styles.iconBtn} aria-label="Notifications">
          <i className="fa-regular fa-bell" />
          <span className={styles.notifDot} />
        </button>
        <button className={styles.avatarBtn} aria-label="Profile">UC</button>
      </div>
    </header>
  );
}

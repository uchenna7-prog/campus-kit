import { Link, useLocation } from "react-router-dom";
import styles from "./SideBar.module.css";
import { useSideBarContext } from "../../contexts/SidebarContext";

export default function SideBar() {
  const { isCollapsed, isMobile, isOpen, toggleSideBar } = useSideBarContext();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {isMobile && isOpen && (
        <div className={styles.sidebarOverlay} onClick={toggleSideBar} />
      )}

      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""} ${isMobile && isOpen ? styles.open : ""}`}>
        <div className={styles.sidebarHeader}>
          <Link className={styles.logo} to="/">
            <div className={styles.logoMark}>
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <span className={styles.logoName}>CampusKit</span>
          </Link>
          {!isMobile && (
            <button className={styles.collapseBtn} onClick={toggleSideBar}>
              <i
                className="fa-solid fa-chevron-left"
                style={{ transform: isCollapsed ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.28s" }}
              ></i>
            </button>
          )}
        </div>

        <div className={styles.sidebarBody}>
          <div className={styles.navGroupTitle} style={{ paddingTop: "4px" }}>General</div>
          <Link className={`${styles.navItem} ${isActive("/home") ? styles.active : ""}`} to="/home">
            <i className={`fa-solid fa-house ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Home</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/ai") ? styles.active : ""}`} to="/ai">
            <i className={`fa-solid fa-wand-magic-sparkles ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>CampusKit AI</span>
          </Link>

          <div className={styles.navDivider}></div>
          <div className={styles.navGroupTitle}>Academic Tools</div>
          <Link className={`${styles.navItem} ${isActive("/") ? styles.active : ""}`} to="/">
            <i className={`fa-solid fa-chart-simple ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>CGPA Calculator</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/gpa-predictor") ? styles.active : ""}`} to="/gpa-predictor">
            <i className={`fa-solid fa-chart-line ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>GPA Predictor</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/study-timetable") ? styles.active : ""}`} to="/study-timetable">
            <i className={`fa-solid fa-calendar-days ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Study Timetable</span>
          </Link>

          <div className={styles.navDivider}></div>
          <div className={styles.navGroupTitle}>Student Utilities</div>
          <Link className={`${styles.navItem} ${isActive("/passport-maker") ? styles.active : ""}`} to="/passport-maker">
            <i className={`fa-regular fa-id-card ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Passport Maker</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/document-scanner") ? styles.active : ""}`} to="/document-scanner">
            <i className={`fa-solid fa-camera ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Document Scanner</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/pdf-tools") ? styles.active : ""}`} to="/pdf-tools">
            <i className={`fa-regular fa-file-pdf ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>PDF Tools</span>
          </Link>

          <div className={styles.navDivider}></div>
          <div className={styles.navGroupTitle}>Opportunities</div>
          <Link className={`${styles.navItem} ${isActive("/scholarships") ? styles.active : ""}`} to="/scholarships">
            <i className={`fa-solid fa-trophy ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Scholarship Finder</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/internships") ? styles.active : ""}`} to="/internships">
            <i className={`fa-solid fa-briefcase ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Internship Finder</span>
          </Link>

          <div className={styles.navDivider}></div>
          <Link className={`${styles.navItem} ${isActive("/settings") ? styles.active : ""}`} to="/settings">
            <i className={`fa-solid fa-gear ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Settings</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive("/help") ? styles.active : ""}`} to="/help">
            <i className={`fa-regular fa-circle-question ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Help & Feedback</span>
          </Link>
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.userAvatar}>UC</div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.userName}>Uchendu</div>
            <div className={styles.userSchool}>UNIZIK · 300L</div>
          </div>
        </div>
      </aside>
    </>
  );
}

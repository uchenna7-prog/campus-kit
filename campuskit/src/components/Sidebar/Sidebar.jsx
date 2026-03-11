// SideBar.jsx
import { Link, useLocation } from "react-router-dom";
import styles from "./SideBar.module.css";
import { useSideBarContext } from "../../contexts/SideBarContext";

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
            <span className={styles.logoName}>UniHub</span>
          </Link>
          {!isMobile && (
            <button className={styles.collapseBtn} onClick={toggleSideBar}>
              <i className="fa-solid fa-chevron-left" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0)' }}></i>
            </button>
          )}
        </div>

        <div className={styles.sidebarBody}>
          <div className={styles.navGroupTitle} style={{ paddingTop: "4px" }}>General</div>
          <Link className={`${styles.navItem} ${isActive('/home') ? styles.active : ''}`} to="/home">
            <i className={`fa-solid fa-house ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Home</span>
          </Link>

          <div className={styles.navDivider}></div>
          <div className={styles.navGroupTitle}>CGPA Suite</div>
          <Link className={`${styles.navItem} ${isActive('/') ? styles.active : ''}`} to="/">
            <i className={`fa-solid fa-chart-simple ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>CGPA Calculator</span>
          </Link>
          <Link className={`${styles.navItem} ${isActive('/gpaCalculator') ? styles.active : ''}`} to="/gpaCalculator">
            <i className={`fa-solid fa-calculator ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>GPA Calculator</span>
          </Link>

          <div className={styles.navDivider}></div>
          <div className={styles.navGroupTitle}>Settings</div>
          <Link className={`${styles.navItem} ${isActive('/settings') ? styles.active : ''}`} to="/settings">
            <i className={`fa-solid fa-gear ${styles.navIcon}`}></i>
            <span className={styles.navLabel}>Settings</span>
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

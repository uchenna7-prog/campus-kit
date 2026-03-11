// Header.jsx
import styles from "./Header.module.css";
import { useSideBarContext } from "../../contexts/SideBarContext";

function Header() {
  const { isMobile, toggleSideBar, isCollapsed } = useSideBarContext();

  return (
    <header className={`${styles.topbar} ${isCollapsed ? styles.shifted : ""}`}>
      {isMobile && (
        <button className={styles.menuBtn} onClick={toggleSideBar}>
          <i className="fa-solid fa-bars"></i>
        </button>
      )}

      <div className={styles.topbarLeft}>
        <button className={styles.topbarBack}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div>
          <div className={styles.topbarTitle}>CGPA Calculator</div>
          <div className={styles.topbarSub}>5.0 Grading Scale</div>
        </div>
      </div>

      <div className={styles.topbarActions}>
        <button className={styles.iconBtn} title="Settings">
          <i className="fa-solid fa-sliders"></i>
        </button>
        <button className={styles.iconBtn}>
          <i className="fa-regular fa-bell"></i>
          <span className={styles.notifDot}></span>
        </button>
        <button className={styles.avatarBtn}>UC</button>
      </div>
    </header>
  );
}

export default Header;

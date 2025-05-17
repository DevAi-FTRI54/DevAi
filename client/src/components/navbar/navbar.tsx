import React from 'react';
import { Link } from 'react-router-dom';
import styles from './navbar.module.css';

const NavBar: React.FC = () => {
  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.navIcon}>
          {/* prettier-ignore */}
          <ul>
            <li>
            <Link to="/Profile" className={styles.profile}>Profile </Link></li>
            <li><Link to="/FAQ" className={styles.faq}></Link></li>
            <li><Link to="/Sign up" className={styles.signup} >Sign Up</Link> </li>
            <li><Link to="/Login" className={styles.login}>Login</Link></li>
          </ul>
          <div className={styles.navRight}>//*might add something in here at some point.</div>
        </div>
      </nav>
    </>
  );
};

export default NavBar;
